package com.bobbuy.service;

import com.bobbuy.model.CategoryTreeNode;
import com.bobbuy.model.ProductPrimaryCategoryPath;
import com.bobbuy.repository.CategoryTreeNodeRepository;
import com.bobbuy.repository.ProductPrimaryCategoryPathRepository;
import com.bobbuy.repository.ProductRepository;
import org.apache.poi.ss.usermodel.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Service
public class CategoryPathImportService {
    public record Row(int rowNumber, String sku, String breadcrumb, String productId, String outcome, String reason) {}
    public record Preview(String importId, String fileName, String status, long productCountBefore,
                          Long productCountAfter, int matched, int newNodes, int unmatched,
                          Instant createdAt, Instant confirmedAt, List<Row> rows) {}

    private final JdbcTemplate jdbc;
    private final ProductRepository products;
    private final CategoryTreeNodeRepository nodes;
    private final ProductPrimaryCategoryPathRepository paths;

    public CategoryPathImportService(JdbcTemplate jdbc, ProductRepository products,
            CategoryTreeNodeRepository nodes, ProductPrimaryCategoryPathRepository paths) {
        this.jdbc=jdbc; this.products=products; this.nodes=nodes; this.paths=paths;
    }

    @Transactional
    public Preview preview(long actorId, boolean platformAdmin, MultipartFile file) {
        String filename=Optional.ofNullable(file.getOriginalFilename()).orElse("import.csv");
        byte[] bytes;
        try { bytes=file.getBytes(); } catch(IOException e) { throw new IllegalArgumentException("Cannot read file", e); }
        List<String[]> input=parse(filename, bytes);
        if(input.isEmpty() || input.get(0).length != 2
                || !Set.of("SKU", "商品编号").contains(input.get(0)[0])
                || !Set.of("Costco breadcrumb", "官网面包屑路径", "分类路径").contains(input.get(0)[1]))
            throw new IllegalArgumentException("Required headers: SKU / 商品编号, Costco breadcrumb / 官网面包屑路径 / 分类路径");
        String id=UUID.randomUUID().toString();
        Set<String> planned=new HashSet<>();
        int matched=0, unmatched=0;
        List<Row> rows=new ArrayList<>();
        for(int i=1;i<input.size();i++) {
            String sku=input.get(i)[0].trim(), crumb=input.get(i)[1];
            String reason=null, productId=null, outcome="MATCHED";
            if(input.get(i).length>2) {
                outcome="UNMATCHED"; reason=input.get(i)[2];
            } else if(crumb.contains("\n") || crumb.contains("\r")) {
                outcome="UNMATCHED"; reason="Breadcrumb names must not contain line breaks";
            } else if(sku.isEmpty() || Arrays.stream(segments(crumb)).anyMatch(String::isEmpty)) {
                outcome="UNMATCHED"; reason="SKU and every breadcrumb name are required";
            } else {
                var found=platformAdmin?products.findAllByItemNumber(sku):products.findAllByMerchantIdAndItemNumber(actorId,sku);
                if(found.size()!=1) { outcome="UNMATCHED"; reason=found.isEmpty()?"Unknown SKU":"SKU is not unique"; }
                else productId=found.get(0).getId();
            }
            rows.add(new Row(i+1,sku,crumb,productId,outcome,reason));
        }
        Map<String,Set<String>> assignments=new HashMap<>();
        for(Row row:rows) if("MATCHED".equals(row.outcome()))
            assignments.computeIfAbsent(row.productId(),key->new HashSet<>()).add(String.join("＞",segments(row.breadcrumb())));
        rows.replaceAll(row->row.productId()!=null && assignments.getOrDefault(row.productId(),Set.of()).size()>1
            ?new Row(row.rowNumber(),row.sku(),row.breadcrumb(),row.productId(),"UNMATCHED","Conflicting paths for the same product") :row);
        for(Row row:rows) {
            if("UNMATCHED".equals(row.outcome())) unmatched++;
            else {matched++;planned.addAll(missingPrefixes(row.breadcrumb()));}
        }
        long before=products.count();
        jdbc.update("insert into bb_category_path_import(id,actor_id,file_name,file_sha256,status,product_count_before,matched_count,new_node_count,unmatched_count) values (?,?,?,?,?,?,?,?,?)",
                id,actorId,filename,sha256(bytes),"PREVIEWED",before,matched,planned.size(),unmatched);
        rows.forEach(r->jdbc.update("insert into bb_category_path_import_row(import_id,row_number,sku,breadcrumb,product_id,outcome,reason) values (?,?,?,?,?,?,?)",
                id,r.rowNumber(),r.sku(),r.breadcrumb(),r.productId(),r.outcome(),r.reason()));
        return get(actorId,id);
    }

    @Transactional
    public Preview confirm(long actorId, String id) {
        nodes.lockTree().orElseThrow(() -> new IllegalStateException("Category tree is unavailable"));
        Preview p=get(actorId,id);
        if("CONFIRMED".equals(p.status())) return p;
        if(!"PREVIEWED".equals(p.status())) throw new IllegalStateException("Import cannot be confirmed");
        for(Row row:p.rows()) if(!"UNMATCHED".equals(row.outcome())) {
            String parent=null; List<String> full=new ArrayList<>();
            for(String name:segments(row.breadcrumb())) {
                final String expectedParent=parent;
                CategoryTreeNode node=nodes.findAllByParentId(parent).stream()
                    .filter(n->n.getSystemKey()==null && name.equals(n.getName().get("ja-JP"))).findFirst().orElse(null);
                if(node==null) {
                    String nodeId=UUID.randomUUID().toString();
                    full.add(nodeId);
                    Map<String,String> display=Map.of("ja-JP",name);
                    int order=nodes.findAllByParentId(parent).stream().filter(n->n.getSystemKey()==null).mapToInt(CategoryTreeNode::getSortOrder).max().orElse(-1)+1;
                    node=nodes.save(new CategoryTreeNode(nodeId,expectedParent,display,new ArrayList<>(full),order,null));
                } else full=new ArrayList<>(node.getFullPath());
                parent=node.getId();
            }
            paths.save(new ProductPrimaryCategoryPath(row.productId(),parent));
        }
        long after=products.count();
        if(after!=p.productCountBefore()) throw new IllegalStateException("Product count changed during import");
        jdbc.update("update bb_category_path_import set status='CONFIRMED',product_count_after=?,confirmed_at=now() where id=? and actor_id=?",after,id,actorId);
        return get(actorId,id);
    }

    public Preview get(long actorId,String id) {
        var headers=jdbc.query("select * from bb_category_path_import where id=? and actor_id=?",(rs,n)->new Object[]{rs.getString("file_name"),rs.getString("status"),rs.getLong("product_count_before"),rs.getObject("product_count_after",Long.class),rs.getInt("matched_count"),rs.getInt("new_node_count"),rs.getInt("unmatched_count"),rs.getTimestamp("created_at").toInstant(),rs.getTimestamp("confirmed_at")},id,actorId);
        if(headers.isEmpty()) throw new NoSuchElementException("Import not found"); Object[] h=headers.get(0);
        List<Row> rows=jdbc.query("select * from bb_category_path_import_row where import_id=? order by row_number",(rs,n)->new Row(rs.getInt("row_number"),rs.getString("sku"),rs.getString("breadcrumb"),rs.getString("product_id"),rs.getString("outcome"),rs.getString("reason")),id);
        return new Preview(id,(String)h[0],(String)h[1],(long)h[2],(Long)h[3],(int)h[4],(int)h[5],(int)h[6],(Instant)h[7],h[8]==null?null:((java.sql.Timestamp)h[8]).toInstant(),rows);
    }
    public List<Preview> audit(long actorId) { return jdbc.queryForList("select id from bb_category_path_import where actor_id=? order by created_at desc",String.class,actorId).stream().map(id->get(actorId,id)).toList(); }
    public byte[] unmatchedCsv(long actorId,String id) { StringBuilder out=new StringBuilder("SKU,Costco breadcrumb,Reason\r\n"); get(actorId,id).rows().stream().filter(r->"UNMATCHED".equals(r.outcome())).forEach(r->out.append(csv(r.sku())).append(',').append(csv(r.breadcrumb())).append(',').append(csv(r.reason())).append("\r\n")); return out.toString().getBytes(StandardCharsets.UTF_8); }
    private static String[] segments(String crumb) {return Arrays.stream(crumb.split("＞",-1)).map(String::strip).toArray(String[]::new);}
    private Set<String> missingPrefixes(String crumb) { Set<String> result=new HashSet<>(); String parent=null,path=""; for(String name:segments(crumb)){path=path.isEmpty()?name:path+"＞"+name; String p=parent; var existing=nodes.findAllByParentId(p).stream().filter(n->name.equals(n.getName().get("ja-JP"))).findFirst(); if(existing.isPresent())parent=existing.get().getId();else {result.add(path);parent="planned:"+path;}} return result; }
    static List<String[]> parse(String name,byte[] bytes) {
        if(name.toLowerCase(Locale.ROOT).endsWith(".xlsx")) return xlsx(bytes);
        if(!name.toLowerCase(Locale.ROOT).endsWith(".csv")) throw new IllegalArgumentException("Only CSV or XLSX is supported");
        return CategoryPathCsvParser.parse(new String(bytes,StandardCharsets.UTF_8));
    }
    private static List<String[]> xlsx(byte[] bytes) {
        List<String[]> out = new ArrayList<>();
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            DataFormatter formatter = new DataFormatter();
            Sheet sheet = workbook.getSheetAt(0);
            for (int index = 0; index <= sheet.getLastRowNum(); index++) {
                var row = sheet.getRow(index);
                String sku = row == null ? "" : formatter.formatCellValue(row.getCell(0));
                String path = row == null ? "" : formatter.formatCellValue(row.getCell(1));
                boolean extra = false;
                if (row != null) for (int column = 2; column < row.getLastCellNum(); column++)
                    if (!formatter.formatCellValue(row.getCell(column)).isEmpty()) extra = true;
                out.add(extra ? new String[]{sku, path, "Exactly two columns are required"} : new String[]{sku, path});
            }
        } catch (Exception e) { throw new IllegalArgumentException("Invalid XLSX", e); }
        return out;
    }
    private static String sha256(byte[] b){try{return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));}catch(Exception e){throw new IllegalStateException(e);}}
    private static String csv(String s){String v=Objects.toString(s,"");return '"'+v.replace("\"","\"\"")+'"';}
}
