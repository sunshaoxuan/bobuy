package com.bobbuy.service;

import com.bobbuy.model.CategoryTreeNode;
import com.bobbuy.model.RecommendationImage;
import com.bobbuy.repository.CategoryTreeNodeRepository;
import com.bobbuy.repository.RecommendationImageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.csv.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** CSV upsert in the existing shared category tree; no deletes or product writes. */
@Service
public class CategoryStructureTransferService {
 public record Row(int row,String id,String parentId,Map<String,String> name,Integer sortOrder,String imageUrl,String action,List<String> errors){}
 public record Preview(String revision,String fileHash,List<Row> rows,boolean valid){}
 private static final List<String> HEADER=List.of("id","parentId","ja-JP","zh-CN","zh-TW","en-US","sortOrder","imageUrl");
 private final CategoryTreeNodeRepository nodes;private final RecommendationImageRepository images;private final ObjectMapper json;
 public CategoryStructureTransferService(CategoryTreeNodeRepository nodes,RecommendationImageRepository images,ObjectMapper json){this.nodes=nodes;this.images=images;this.json=json;}
 private String hash(byte[] data){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));}catch(Exception e){throw new IllegalStateException(e);}}
 private String revision(List<CategoryTreeNode> tree){try{return hash(json.writeValueAsBytes(tree.stream().sorted(Comparator.comparing(CategoryTreeNode::getId)).map(n->Arrays.asList(n.getId(),n.getParentId(),n.getName(),n.getSortOrder(),n.getImageUrl(),n.getFullPath())).toList()));}catch(Exception e){throw new IllegalStateException(e);}}
 @Transactional(readOnly=true) public byte[] export(boolean template){
  try(var out=new StringWriter();var csv=new CSVPrinter(out,CSVFormat.RFC4180)){
   csv.printRecord(HEADER);
   if(!template)for(var n:nodes.findAll().stream().filter(n->n.getSystemKey()==null).sorted(Comparator.comparing(CategoryTreeNode::getId)).toList())csv.printRecord(n.getId(),n.getParentId(),n.getName().get("ja-JP"),n.getName().get("zh-CN"),n.getName().get("zh-TW"),n.getName().get("en-US"),n.getSortOrder(),n.getImageUrl());
   csv.flush();return out.toString().getBytes(StandardCharsets.UTF_8);
  }catch(IOException e){throw new IllegalStateException(e);}
 }
 @Transactional(readOnly=true) public Preview preview(byte[] bytes){return preview(bytes,nodes.findAll());}
 private Preview preview(byte[] bytes,List<CategoryTreeNode> current){
  if(bytes.length==0||bytes.length>2_000_000)throw new IllegalArgumentException("CSV must be between 1 byte and 2 MB");
  var existing=new HashMap<String,CategoryTreeNode>();current.forEach(n->existing.put(n.getId(),n));
  var rows=new ArrayList<Row>();var seen=new HashSet<String>();
  String text=new String(bytes,StandardCharsets.UTF_8);if(text.startsWith("\uFEFF"))text=text.substring(1);
  try(var csv=CSVParser.parse(text,CSVFormat.RFC4180)){
   var records=csv.getRecords();if(records.isEmpty()||!records.get(0).toList().equals(HEADER))throw new IllegalArgumentException("Use the downloaded CSV template header");
   if(records.size()>2001)throw new IllegalArgumentException("At most 2000 category rows per import");
   for(int i=1;i<records.size();i++){
    var r=records.get(i);var errors=new ArrayList<String>();
    if(r.size()!=8){rows.add(new Row(i+1,"",null,Map.of(),null,null,"INVALID",List.of("Expected 8 columns")));continue;}
    String id=r.get(0),parent=r.get(1).isBlank()?null:r.get(1),image=r.get(7).isBlank()?null:r.get(7);Integer order=null;
    if(!id.matches("[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}")||!seen.add(id))errors.add("Invalid or duplicate ID");
    if(existing.containsKey(id)&&existing.get(id).getSystemKey()!=null)errors.add("System category cannot be changed");
    var names=new LinkedHashMap<String,String>();for(int c=2;c<6;c++){String value=r.get(c).strip();if(value.length()>200||value.contains("＞")||value.chars().anyMatch(Character::isISOControl))errors.add("Invalid name: "+HEADER.get(c));if(!value.isEmpty())names.put(HEADER.get(c),value);}
    if(!names.containsKey("ja-JP"))errors.add("Japanese name is required");
    try{order=Integer.valueOf(r.get(6));if(order<0)throw new NumberFormatException();}catch(NumberFormatException e){errors.add("sortOrder must be a nonnegative integer");}
    if(image!=null){String prefix="/api/storefront/recommendation-images/";if(parent!=null||!image.startsWith(prefix)||!image.substring(prefix.length()).matches("[a-zA-Z0-9-]+")||images.findById(image.substring(prefix.length())).filter(v->"PUBLIC".equals(v.accessScope)).isEmpty())errors.add("Use an existing public on-site image on a root category");}
    rows.add(new Row(i+1,id,parent,names,order,image,existing.containsKey(id)?"UPDATE":"CREATE",errors));
   }
  }catch(IOException e){throw new IllegalArgumentException("Invalid CSV quoting",e);}
  if(rows.isEmpty())throw new IllegalArgumentException("CSV contains no category rows");
  if(rows.stream().allMatch(r->r.errors().isEmpty())){
   try{planned(current,rows);}catch(IllegalArgumentException e){rows.replaceAll(r->new Row(r.row(),r.id(),r.parentId(),r.name(),r.sortOrder(),r.imageUrl(),r.action(),List.of(e.getMessage())));}
  }
  return new Preview(revision(current),hash(bytes),List.copyOf(rows),rows.stream().allMatch(r->r.errors().isEmpty()));
 }
 private List<CategoryTreeNode> planned(List<CategoryTreeNode> current,List<Row> rows){
  Map<String,CategoryTreeNode> result=new LinkedHashMap<>();
  for(var n:current){var copy=new CategoryTreeNode(n.getId(),n.getParentId(),n.getName(),n.getFullPath(),n.getSortOrder(),n.getSystemKey());copy.setImageUrl(n.getImageUrl());copy.setExplicitOrder(n.isExplicitOrder());result.put(n.getId(),copy);}
  for(var r:rows){var n=new CategoryTreeNode(r.id(),r.parentId(),r.name(),List.of(r.id()),r.sortOrder(),null);n.setImageUrl(r.imageUrl());n.setExplicitOrder(true);result.put(r.id(),n);}
  var names=new HashSet<List<String>>();
  for(var n:result.values()){
   if(n.getSystemKey()!=null)continue;
   if(!names.add(Arrays.asList(n.getParentId(),n.getName().get("ja-JP"))))throw new IllegalArgumentException("Duplicate sibling name");
   var path=new LinkedList<String>();var visiting=new HashSet<String>();var cursor=n;
   while(cursor!=null){if(!visiting.add(cursor.getId()))throw new IllegalArgumentException("Category cycle");path.addFirst(cursor.getId());String parent=cursor.getParentId();cursor=parent==null?null:result.get(parent);if(parent!=null&&(cursor==null||cursor.getSystemKey()!=null))throw new IllegalArgumentException("Unknown or system parent");}
   n.setFullPath(path);
  }
  var values=new ArrayList<>(result.values());new ShoppingTreeProjection(values);return values;
 }
 @Transactional public Preview confirm(byte[] bytes,String revision,String fileHash,boolean confirmed){
  if(!confirmed)throw new IllegalArgumentException("Explicit confirmation required");
  nodes.lockTree().orElseThrow(()->new IllegalStateException("Tree unavailable"));
  var current=nodes.findAll();var p=preview(bytes,current);
  if(!p.valid())throw new IllegalArgumentException("Resolve all row errors before confirming");
  if(!p.fileHash().equals(fileHash))throw new IllegalArgumentException("File changed; preview again");
  var planned=planned(current,p.rows());
  // Exact repeats are no-ops; a changed tree needs a fresh preview before any write.
  if(revision(current).equals(revision(planned)))return p;
  if(!p.revision().equals(revision))throw new IllegalStateException("Category tree changed; preview again");
  nodes.saveAll(planned.stream().filter(n->n.getSystemKey()==null).toList());return preview(bytes,planned);
 }
}
