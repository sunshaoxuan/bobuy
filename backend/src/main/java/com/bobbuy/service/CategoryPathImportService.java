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
    public record Row(int rowNumber, String sku, String breadcrumb, String productId, String outcome, String reason, String flag, String sourceTier) {}
    public record Preview(String importId, String fileName, String status, long productCountBefore,
                          Long productCountAfter, int matched, int newNodes, int unmatched,
                          Instant createdAt, Instant confirmedAt, List<Row> rows) {
        public long getDeferred() { return rows.stream().filter(r -> "DEFERRED".equals(r.outcome())).count(); }
    }
    public static final String DEFAULT_DEFERRED_SKUS = "";
    public static final Set<String> SOURCE_TIERS = Set.of("官网面包屑（原文）", "推定（官网无可用面包屑）", "推定（官网无页面）");

    private final CategoryReviewedNames reviewedNames;
    private final JdbcTemplate jdbc;
    private final ProductRepository products;
    private final CategoryTreeNodeRepository nodes;
    private final ProductPrimaryCategoryPathRepository paths;

    public CategoryPathImportService(JdbcTemplate jdbc, ProductRepository products,
            CategoryTreeNodeRepository nodes, ProductPrimaryCategoryPathRepository paths, CategoryReviewedNames reviewedNames) {
        this.reviewedNames=reviewedNames; this.jdbc=jdbc; this.products=products; this.nodes=nodes; this.paths=paths;
    }

    @Transactional
    public Preview preview(long actorId, boolean platformAdmin, MultipartFile file) {
        return preview(actorId, platformAdmin, file, null);
    }

    @Transactional
    public Preview preview(long actorId, boolean platformAdmin, MultipartFile file, String deferredSkus) {
        Set<String> deferred = new HashSet<>(Arrays.asList((deferredSkus == null ? DEFAULT_DEFERRED_SKUS : deferredSkus).split("[,，\\s]+")));
        deferred.remove("");
        String filename=Optional.ofNullable(file.getOriginalFilename()).orElse("import.csv");
        byte[] bytes;
        try { bytes=file.getBytes(); } catch(IOException e) { throw new IllegalArgumentException("Cannot read file", e); }
        List<String[]> input=parse(filename, bytes);
        if(input.isEmpty()) throw new IllegalArgumentException("Required CSV header");
        String[] header=input.get(0);
        if(header.length<2 || header.length>4 || !Set.of("SKU", "商品编号").contains(header[0])
                || !Set.of("Costco breadcrumb", "官网面包屑路径", "分类路径", "costco分类路径").contains(header[1]))
            throw new IllegalArgumentException("Required headers: SKU / 商品编号, costco分类路径 / Costco breadcrumb / 官网面包屑路径 / 分类路径");
        int sourceColumn=-1, flagColumn=-1;
        for(int c=2;c<header.length;c++) {
            if("路径来源".equals(header[c]) && sourceColumn==-1) sourceColumn=c;
            else if(Set.of("备注", "标记", "note", "flag").contains(header[c].toLowerCase(Locale.ROOT)) && flagColumn==-1) flagColumn=c;
            else throw new IllegalArgumentException("Optional columns: 路径来源 and 备注 / 标记 / Note / Flag, each at most once");
        }
        String id=UUID.randomUUID().toString();
        Set<String> planned=new HashSet<>();
        int matched=0, unmatched=0;
        List<Row> rows=new ArrayList<>();
        for(int i=1;i<input.size();i++) {
            String sku=input.get(i)[0].trim(), crumb=input.get(i)[1];
            boolean malformed=input.get(i).length>4;
            // The strict parser keeps reliably parsed optional cells even when a trailing
            // column makes the record malformed. Retain a pending flag so another row for
            // the same identity cannot bypass it.
            String flag=flagColumn<0 || input.get(i).length<=flagColumn?null:input.get(i)[flagColumn];
            String sourceTier=sourceColumn<0 || malformed?null:input.get(i)[sourceColumn];
            String reason=null, productId=null, outcome="MATCHED";
            if(malformed) {
                outcome="UNMATCHED"; reason=input.get(i)[4];
            } else if(sourceColumn>=0 && !SOURCE_TIERS.contains(sourceTier)) {
                outcome="UNMATCHED"; reason="Unknown path source; select one of the three documented tiers";
            } else if(crumb.contains("\n") || crumb.contains("\r")) {
                outcome="UNMATCHED"; reason="Breadcrumb names must not contain line breaks";
            } else if(sku.isEmpty() || Arrays.stream(segments(crumb,sourceTier)).anyMatch(String::isBlank)) {
                outcome="UNMATCHED"; reason="SKU and every breadcrumb name are required";
            } else {
                var found=platformAdmin?products.findAllByItemNumber(sku):products.findAllByMerchantIdAndItemNumber(actorId,sku);
                if(found.size()!=1) { outcome="UNMATCHED"; reason=found.isEmpty()?"Unknown SKU":"SKU is not unique"; }
                else productId=found.get(0).getId();
            }
            if ("待核".equals(flag == null ? null : flag.strip())) {
                // Even an invalid path must block a second row from categorizing this identity.
                if(productId==null && !sku.isEmpty()) {
                    var found=platformAdmin?products.findAllByItemNumber(sku):products.findAllByMerchantIdAndItemNumber(actorId,sku);
                    if(found.size()==1) productId=found.get(0).getId();
                }
                outcome="UNMATCHED"; reason="Identity unverified (待核); verify identity before assigning a category" + (reason==null?"":"; "+reason);
            }
            if(deferred.contains(sku)) {
                if(productId==null && !sku.isEmpty()) {
                    var found=platformAdmin?products.findAllByItemNumber(sku):products.findAllByMerchantIdAndItemNumber(actorId,sku);
                    if(found.size()==1) productId=found.get(0).getId();
                }
                outcome="DEFERRED"; reason="Deferred by operations; current category and visibility retained";
            }
            rows.add(new Row(i+1,sku,crumb,productId,outcome,reason,flag,sourceTier));
        }
        Set<String> deferredProducts=new HashSet<>();
        for(String sku:deferred) {
            var found=platformAdmin?products.findAllByItemNumber(sku):products.findAllByMerchantIdAndItemNumber(actorId,sku);
            found.forEach(product->deferredProducts.add(product.getId()));
        }
        rows.replaceAll(row->row.productId()!=null && deferredProducts.contains(row.productId())
            ?new Row(row.rowNumber(),row.sku(),row.breadcrumb(),row.productId(),"DEFERRED","Deferred by operations; current category and visibility retained",row.flag(),row.sourceTier()):row);
        Map<String,Set<List<String>>> assignments=new HashMap<>();
        Set<String> pendingProducts=new HashSet<>();
        for(Row row:rows) if(row.productId()!=null && "待核".equals(row.flag()==null?null:row.flag().strip())) pendingProducts.add(row.productId());
        for(Row row:rows) if("MATCHED".equals(row.outcome()))
            assignments.computeIfAbsent(row.productId(),key->new HashSet<>()).add(List.of(String.join("＞",segments(row.breadcrumb(),row.sourceTier())),Objects.toString(row.flag(),""),Objects.toString(row.sourceTier(),"")));
        rows.replaceAll(row->row.productId()!=null && "MATCHED".equals(row.outcome()) && (pendingProducts.contains(row.productId()) || assignments.getOrDefault(row.productId(),Set.of()).size()>1)
            ?new Row(row.rowNumber(),row.sku(),row.breadcrumb(),row.productId(),"UNMATCHED","Conflicting paths, flags or source tiers for the same product",row.flag(),row.sourceTier()) :row);
        for(Row row:rows) {
            if("UNMATCHED".equals(row.outcome())) unmatched++;
            else if("MATCHED".equals(row.outcome())) {matched++;planned.addAll(missingPrefixes(row.breadcrumb(),row.sourceTier()));}
        }
        long before=products.count();
        jdbc.update("insert into bb_category_path_import(id,actor_id,file_name,file_sha256,status,product_count_before,matched_count,new_node_count,unmatched_count) values (?,?,?,?,?,?,?,?,?)",
                id,actorId,filename,sha256(bytes),"PREVIEWED",before,matched,planned.size(),unmatched);
        rows.forEach(r->jdbc.update("insert into bb_category_path_import_row(import_id,row_number,sku,breadcrumb,product_id,outcome,reason,flag,source_tier) values (?,?,?,?,?,?,?,?,?)",
                id,r.rowNumber(),r.sku(),r.breadcrumb(),r.productId(),r.outcome(),r.reason(),r.flag(),r.sourceTier()));
        return get(actorId,id);
    }

    @Transactional
    public Preview confirm(long actorId, String id) {
        nodes.lockTree().orElseThrow(() -> new IllegalStateException("Category tree is unavailable"));
        Preview p=get(actorId,id);
        if("CONFIRMED".equals(p.status())) return p;
        if(!"PREVIEWED".equals(p.status())) throw new IllegalStateException("Import cannot be confirmed");
        if(p.unmatched()>0){if(p.matched()>0)throw new IllegalStateException("Resolve all invalid rows and preview again before confirming");return p;}
        for(Row row:p.rows()) if("MATCHED".equals(row.outcome())) {
            String parent=null; List<String> full=new ArrayList<>(); List<String> japanesePath=new ArrayList<>();
            for(String name:segments(row.breadcrumb(),row.sourceTier())) {
                japanesePath.add(name);
                final String expectedParent=parent;
                CategoryTreeNode node=nodes.findAllByParentId(parent).stream()
                    .filter(n->n.getSystemKey()==null && name.equals(n.getName().get("ja-JP"))).findFirst().orElse(null);
                if(node==null) {
                    String nodeId=UUID.randomUUID().toString();
                    full.add(nodeId);
                    Map<String,String> display=Map.of("ja-JP",name);
                    int order=nodes.findAllByParentId(parent).stream().filter(n->n.getSystemKey()==null).mapToInt(CategoryTreeNode::getSortOrder).max().orElse(-1)+1;
                    node=new CategoryTreeNode(nodeId,expectedParent,display,new ArrayList<>(full),order,null);
                    node.setExplicitOrder(nodes.findAllByParentId(parent).stream()
                            .filter(n -> n.getSystemKey() == null).anyMatch(CategoryTreeNode::isExplicitOrder));
                    node=nodes.save(node);
                } else {
                    full=new ArrayList<>(node.getFullPath());

                }
                parent=node.getId();
            }
            paths.save(new ProductPrimaryCategoryPath(row.productId(),parent));
            // A targeted update cannot overwrite price, stock or publication fields.
            // Missing/blank flags retain existing provenance on two-column reimports.
            if(row.flag()!=null && !row.flag().isBlank())
                jdbc.update("update bb_product set category_import_flag=? where id=?",row.flag(),row.productId());
            // Source describes this assignment. A legacy file must not retain a stale tier.
            jdbc.update("update bb_product set category_path_source=? where id=?",row.sourceTier(),row.productId());
        }
        long after=products.count();
        if(after!=p.productCountBefore()) throw new IllegalStateException("Product count changed during import");
        jdbc.update("update bb_category_path_import set status='CONFIRMED',product_count_after=?,confirmed_at=now() where id=? and actor_id=?",after,id,actorId);
        return get(actorId,id);
    }

    public Preview get(long actorId,String id) {
        var headers=jdbc.query("select * from bb_category_path_import where id=? and actor_id=?",(rs,n)->new Object[]{rs.getString("file_name"),rs.getString("status"),rs.getLong("product_count_before"),rs.getObject("product_count_after",Long.class),rs.getInt("matched_count"),rs.getInt("new_node_count"),rs.getInt("unmatched_count"),rs.getTimestamp("created_at").toInstant(),rs.getTimestamp("confirmed_at")},id,actorId);
        if(headers.isEmpty()) throw new NoSuchElementException("Import not found"); Object[] h=headers.get(0);
        List<Row> rows=jdbc.query("select * from bb_category_path_import_row where import_id=? order by row_number",(rs,n)->new Row(rs.getInt("row_number"),rs.getString("sku"),rs.getString("breadcrumb"),rs.getString("product_id"),rs.getString("outcome"),rs.getString("reason"),rs.getString("flag"),rs.getString("source_tier")),id);
        return new Preview(id,(String)h[0],(String)h[1],(long)h[2],(Long)h[3],(int)h[4],(int)h[5],(int)h[6],(Instant)h[7],h[8]==null?null:((java.sql.Timestamp)h[8]).toInstant(),rows);
    }
    public List<Preview> audit(long actorId) { return jdbc.queryForList("select id from bb_category_path_import where actor_id=? order by created_at desc",String.class,actorId).stream().map(id->get(actorId,id)).toList(); }
    public byte[] unmatchedCsv(long actorId,String id) { StringBuilder out=new StringBuilder("SKU,costco分类路径,路径来源,Flag,Reason\r\n"); get(actorId,id).rows().stream().filter(r->!"MATCHED".equals(r.outcome())).forEach(r->out.append(csv(r.sku())).append(',').append(csv(r.breadcrumb())).append(',').append(csv(r.sourceTier())).append(',').append(csv(r.flag())).append(',').append(csv(r.reason())).append("\r\n")); return out.toString().getBytes(StandardCharsets.UTF_8); }
    private static String[] segments(String crumb,String sourceTier) {
        String[] parts=crumb.split("[>＞]",-1);
        return sourceTier==null?Arrays.stream(parts).map(String::strip).toArray(String[]::new):parts;
    }
    private Set<String> missingPrefixes(String crumb,String sourceTier) { Set<String> result=new HashSet<>(); String parent=null,path=""; for(String name:segments(crumb,sourceTier)){path=path.isEmpty()?name:path+"＞"+name; String p=parent; var existing=nodes.findAllByParentId(p).stream().filter(n->name.equals(n.getName().get("ja-JP"))).findFirst(); if(existing.isPresent())parent=existing.get().getId();else {result.add(path);parent="planned:"+path;}} return result; }
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
            int columns = sheet.getRow(0)==null ? 0 : sheet.getRow(0).getLastCellNum();
            for (int index = 0; index <= sheet.getLastRowNum(); index++) {
                var row = sheet.getRow(index);
                int width = Math.max(Math.max(columns, 2), row == null ? 0 : row.getLastCellNum());
                String[] cells = new String[width];
                for(int column=0;column<width;column++) cells[column]=row==null?"":formatter.formatCellValue(row.getCell(column));
                if(index>0 && width!=columns)
                    out.add(new String[]{cells[0],String.join(",",cells),width>2?cells[2]:"","","Column count must match the header"});
                else out.add(cells);
            }
        } catch (Exception e) { throw new IllegalArgumentException("Invalid XLSX", e); }
        return out;
    }
    private static String sha256(byte[] b){try{return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));}catch(Exception e){throw new IllegalStateException(e);}}
    private static String csv(String s){String v=Objects.toString(s,"");return '"'+v.replace("\"","\"\"")+'"';}
}
