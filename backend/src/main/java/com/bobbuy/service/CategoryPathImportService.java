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
import com.fasterxml.jackson.databind.ObjectMapper;
import com.bobbuy.model.Product;
import org.apache.commons.csv.*;
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

    private final ObjectMapper json=new ObjectMapper();
    private static final List<String> MAPPING_HEADER=List.of("productId","itemNumber","version","categoryNodeId","categoryPath","sortOrder","operation");
    private final JdbcTemplate jdbc;
    private final ProductRepository products;
    private final CategoryTreeNodeRepository nodes;
    private final ProductPrimaryCategoryPathRepository paths;

    public CategoryPathImportService(JdbcTemplate jdbc, ProductRepository products,
            CategoryTreeNodeRepository nodes, ProductPrimaryCategoryPathRepository paths, CategoryReviewedNames reviewedNames) {
        this.jdbc=jdbc; this.products=products; this.nodes=nodes; this.paths=paths;
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
        if(bytes.length==0||bytes.length>2_000_000)throw new IllegalArgumentException("File must be between 1 byte and 2 MB");
        String raw=new String(bytes,StandardCharsets.UTF_8).replaceFirst("^\uFEFF", "");
        if((raw.startsWith("productId,")||raw.startsWith("\"productId\",")))return stablePreview(actorId,platformAdmin,filename,bytes,raw,deferred);
        List<String[]> input=parse(filename, bytes);
        if(input.size()>2001)throw new IllegalArgumentException("At most 2000 rows per import");
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
            } else if(sourceColumn>=0 && (sourceTier==null||sourceTier.length()>200||sourceTier.chars().anyMatch(Character::isISOControl))) {
                outcome="UNMATCHED"; reason="Path source must be at most 200 characters without control characters";
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
        saveState(id,state(actorId,platformAdmin,rows,Map.of()));
        return get(actorId,id);
    }

    @Transactional
    public Preview confirm(long actorId, String id) {return confirm(actorId,false,id);}

    @Transactional
    public Preview confirm(long actorId, boolean platformAdmin, String id) {
        nodes.lockTree().orElseThrow(() -> new IllegalStateException("Category tree is unavailable"));
        Preview p=get(actorId,id);
        if("CONFIRMED".equals(p.status())) return p;
        if(!"PREVIEWED".equals(p.status())) throw new CategoryImportConflict("Import cannot be confirmed");
        if(p.unmatched()>0){if(p.matched()>0)throw new CategoryImportConflict("Resolve all invalid rows and preview again before confirming");return p;}
        Map<String,String> expected=readState(id);
        // Lock and validate the complete batch before creating nodes or changing any assignment.
        for(String productId:p.rows().stream().filter(r->"MATCHED".equals(r.outcome())).map(Row::productId).distinct().sorted().toList()) {
            Product product=products.lockById(productId).orElseThrow(()->new CategoryImportConflict("Product removed; preview again"));
            if(!platformAdmin&&!Objects.equals(product.getMerchantId(),actorId))throw new CategoryImportConflict("Product access changed; preview again");
        }
        Map<String,String> actual=state(actorId,platformAdmin,p.rows(),Map.of());
        List<String> conflicts=new ArrayList<>();
        for(var entry:expected.entrySet())if(!entry.getKey().startsWith("target:")&&!Objects.equals(entry.getValue(),actual.get(entry.getKey())))conflicts.add(entry.getKey());
        if(!conflicts.isEmpty())throw new CategoryImportConflict("Preview changed ("+String.join(", ",conflicts)+"); preview again before confirming");
        for(Row row:p.rows()) if("MATCHED".equals(row.outcome())) {
            String target=expected.get("target:"+row.productId());
            if(target!=null){paths.save(new ProductPrimaryCategoryPath(row.productId(),target));continue;}
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
    public byte[] unmatchedCsv(long actorId,String id) { StringBuilder out=new StringBuilder("SKU,分类路径,路径来源,Flag,Reason\r\n"); get(actorId,id).rows().stream().filter(r->!"MATCHED".equals(r.outcome())).forEach(r->out.append(csv(r.sku())).append(',').append(csv(r.breadcrumb())).append(',').append(csv(r.sourceTier())).append(',').append(csv(r.flag())).append(',').append(csv(r.reason())).append("\r\n")); return out.toString().getBytes(StandardCharsets.UTF_8); }
    private String encoded(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
    private Map<String,String> state(long actorId,boolean admin,List<Row> rows,Map<String,String> targets){
        Map<String,String> result=new TreeMap<>();
        result.put("category structure/order",sha256(encoded(nodes.findAll().stream().sorted(Comparator.comparing(CategoryTreeNode::getId)).map(n->Arrays.asList(n.getId(),n.getParentId(),new TreeMap<>(n.getName()),n.getFullPath(),n.getSortOrder(),n.isExplicitOrder(),n.getSystemKey(),n.getImageUrl())).toList()).getBytes(StandardCharsets.UTF_8)));
        for(var row:rows)if("MATCHED".equals(row.outcome())){
            var p=products.findById(row.productId()).orElseThrow(()->new IllegalArgumentException("Product unavailable; preview again"));
            if(!admin&&!Objects.equals(p.getMerchantId(),actorId))throw new IllegalArgumentException("Product outside current merchant scope");
            result.put("product row "+row.rowNumber(),encoded(Arrays.asList(p.getId(),p.getMerchantId(),p.getItemNumber(),p.getRecordVersion(),p.getCategoryId(),p.getCategoryImportFlag(),p.getCategoryPathSource(),paths.findById(p.getId()).map(ProductPrimaryCategoryPath::getCategoryNodeId).orElse(null))));
            if(!targets.containsKey(p.getId()))result.put("identity row "+row.rowNumber(),encoded((admin?products.findAllByItemNumber(row.sku()):products.findAllByMerchantIdAndItemNumber(actorId,row.sku())).stream().map(Product::getId).sorted().toList()));
        }
        targets.forEach((id,target)->result.put("target:"+id,target));return result;
    }
    private void saveState(String id,Map<String,String> state){jdbc.update("update bb_category_path_import set preview_state=? where id=?",encoded(state),id);}
    private Map<String,String> readState(String id){String raw=jdbc.queryForObject("select preview_state from bb_category_path_import where id=?",String.class,id);if(raw==null)throw new CategoryImportConflict("Preview predates conflict protection; preview again");try{return json.readValue(raw,new com.fasterxml.jackson.core.type.TypeReference<Map<String,String>>(){});}catch(IOException e){throw new IllegalStateException("Invalid preview; preview again",e);}}
    @Transactional(readOnly=true) public byte[] exportMappings(long actorId,boolean admin,boolean template){
        try(var out=new StringWriter();var csv=new CSVPrinter(out,CSVFormat.RFC4180)){
            csv.printRecord(MAPPING_HEADER);
            if(!template){var tree=new HashMap<String,CategoryTreeNode>();nodes.findAll().forEach(n->tree.put(n.getId(),n));
                for(var p:(admin?products.findAll():products.findAllByMerchantId(actorId)).stream().sorted(Comparator.comparing(Product::getId)).toList()){
                    var node=paths.findById(p.getId()).map(path->tree.get(path.getCategoryNodeId())).orElse(null);
                    csv.printRecord(p.getId(),p.getItemNumber(),Objects.toString(p.getRecordVersion(),"0"),node==null?"":node.getId(),node==null?"":node.getFullPath().stream().map(tree::get).filter(Objects::nonNull).map(n->n.getName().getOrDefault("ja-JP","")).collect(java.util.stream.Collectors.joining(" > ")),node==null?"":node.getSortOrder(),node==null?"KEEP":"ASSIGN");
                }
            }csv.flush();return out.toString().getBytes(StandardCharsets.UTF_8);
        }catch(IOException e){throw new IllegalStateException(e);}
    }
    private Preview stablePreview(long actor,boolean admin,String filename,byte[] bytes,String text,Set<String> deferred){
        List<Row> rows=new ArrayList<>();Map<String,String> targets=new HashMap<>();Set<String> seen=new HashSet<>();
        try(var csv=CSVParser.parse(text,CSVFormat.RFC4180)){
            var records=csv.getRecords();if(records.isEmpty()||!records.get(0).toList().equals(MAPPING_HEADER))throw new IllegalArgumentException("Use the downloaded mapping template");
            if(records.size()<2||records.size()>2001)throw new IllegalArgumentException("Use 1–2000 mapping rows");
            for(int i=1;i<records.size();i++){
                var r=records.get(i);String error=null,sku=r.size()>1?r.get(1):"",crumb=r.size()>4?r.get(4):"",id=r.size()>0?r.get(0):"",outcome="MATCHED";
                if(r.size()!=7)error="Expected seven columns";
                else if(!seen.add(id))error="Duplicate product identity";
                else{
                    var product=products.findById(id).filter(p->admin||Objects.equals(actor,p.getMerchantId())).orElse(null);
                    if(product==null)error="Unknown or inaccessible product; no product will be created";
                    else if(!Objects.equals(Objects.toString(product.getItemNumber(),""),sku)||!Objects.toString(product.getRecordVersion(),"0").equals(r.get(2)))error="Product identity/version changed; export or preview again";
                    else if(deferred.contains(sku)||"KEEP".equals(r.get(6)))outcome="DEFERRED";
                    else if(!"ASSIGN".equals(r.get(6)))error="Operation must be KEEP or ASSIGN";
                    else{
                        var node=nodes.findById(r.get(3)).orElse(null);
                        String existing=paths.findById(id).map(ProductPrimaryCategoryPath::getCategoryNodeId).orElse(null);
                        if(node==null)error="Unknown category; import the structure first";
                        else if(node.getSystemKey()!=null&&!"UNCATEGORIZED".equals(node.getSystemKey()))error="Unsupported system category";
                        else if(nodes.existsByParentId(node.getId())&&!node.getId().equals(existing))error="Choose a leaf category or retain the existing assignment";
                        else targets.put(id,node.getId());
                    }
                }
                rows.add(new Row(i+1,sku,crumb,id,error==null?outcome:"UNMATCHED",error,null,null));
            }
        }catch(IOException e){throw new IllegalArgumentException("Invalid CSV quoting",e);}
        String id=UUID.randomUUID().toString();int matched=(int)rows.stream().filter(r->"MATCHED".equals(r.outcome())).count(),unmatched=(int)rows.stream().filter(r->"UNMATCHED".equals(r.outcome())).count();
        jdbc.update("insert into bb_category_path_import(id,actor_id,file_name,file_sha256,status,product_count_before,matched_count,new_node_count,unmatched_count) values (?,?,?,?,?,?,?,?,?)",id,actor,filename,sha256(bytes),"PREVIEWED",products.count(),matched,0,unmatched);
        for(var r:rows)jdbc.update("insert into bb_category_path_import_row(import_id,row_number,sku,breadcrumb,product_id,outcome,reason,flag,source_tier) values (?,?,?,?,?,?,?,?,?)",id,r.rowNumber(),r.sku(),r.breadcrumb(),r.productId(),r.outcome(),r.reason(),r.flag(),r.sourceTier());
        saveState(id,state(actor,admin,rows,targets));return get(actor,id);
    }
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
