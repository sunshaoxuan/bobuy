package com.bobbuy.service;

import javax.sql.DataSource;
import java.sql.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Read-only, streaming authoritative PG inventory and independent CAS reconciliation.
 * No object/row deletion, source write or credential/URL serialization. */
public final class MediaMigrationAudit {
 private final DataSource data;private final MediaObjectStore objects;
 public MediaMigrationAudit(DataSource data,MediaObjectStore objects){this.data=data;this.objects=objects;}
 public record Summary(long mediaRows,long rawBytes,long uniqueBlobs,long uniqueBytes,long sharedBytes,
  long boundRows,long verifiedRows,long pendingRows,long metadataErrors,long objectErrors,
  long listedObjects,long listedBytes,long extraObjects,boolean schemaReady,boolean sourceStable,
  boolean complete,String sourceFingerprint,List<String> problemMediaIds,long pgRetainedRows,long pgRetainedBytes,long objectOnlyRows){}
 private record Blob(String key,long bytes,String type){}
 public String identity()throws SQLException{
  try(var c=data.getConnection()){
   String value=c.getMetaData().getURL()+"|"+c.getCatalog();
   if(c.getMetaData().getDatabaseProductName().equals("PostgreSQL"))try(var s=c.createStatement();var r=s.executeQuery("select oid from pg_database where datname=current_database()")){if(r.next())value+="|"+r.getLong(1);}
   return MediaBinaryService.sha(value.getBytes(StandardCharsets.UTF_8));
  }
 }
 private static void field(MessageDigest digest,String value){byte[] bytes=String.valueOf(value).getBytes(StandardCharsets.UTF_8);digest.update(java.nio.ByteBuffer.allocate(4).putInt(bytes.length).array());digest.update(bytes);}
 private static MessageDigest digest(){try{return MessageDigest.getInstance("SHA-256");}catch(Exception e){throw new IllegalStateException(e);}}
 private static boolean table(Connection c,String name)throws SQLException{try(var r=c.getMetaData().getTables(null,null,null,new String[]{"TABLE"})){while(r.next())if(name.equalsIgnoreCase(r.getString("TABLE_NAME")))return true;}return false;}
 private static boolean metadata(Connection c)throws SQLException{try(var r=c.getMetaData().getColumns(null,null,null,null)){while(r.next())if("bb_recommendation_image".equalsIgnoreCase(r.getString("TABLE_NAME"))&&"raw_sha256".equalsIgnoreCase(r.getString("COLUMN_NAME")))return true;}return false;}
 public Summary inspect(boolean verify,long deadlineNanos)throws SQLException{
  long rows=0,raw=0,uniqueBytes=0,bound=0,verified=0,pending=0,metadataErrors=0,objectErrors=0,listedCount=0,listedBytes=0,extras=0,pgRows=0,pgBytes=0,objectOnlyRows=0;
  var problems=new ArrayList<String>();var blobs=new LinkedHashMap<String,Blob>();var checked=new HashMap<String,Boolean>();var fingerprint=digest();boolean ready;
  try(var c=data.getConnection()){
   c.setReadOnly(true);c.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);c.setAutoCommit(false);
   ready=table(c,"bb_media_transfer")&&table(c,"bb_media_reference")&&table(c,"bb_media_blob");
   if(verify&&!ready)throw new IllegalStateException("Media schema V21 is required before verification");
   boolean modern=metadata(c);String sourceMetadata=modern?",i.raw_sha256 as source_hash,i.byte_length as source_length":",null as source_hash,null as source_length";
   String joins=ready?",t.raw_sha256,t.object_key,t.byte_length,t.content_type,t.state,r.blob_sha256,b.byte_length,b.content_type"+sourceMetadata+" from bb_recommendation_image i left join bb_media_transfer t on t.image_id=i.id left join bb_media_reference r on r.image_id=i.id left join bb_media_blob b on b.sha256=r.blob_sha256":sourceMetadata+" from bb_recommendation_image i";
   try(var s=c.prepareStatement("select i.id,i.merchant_id,i.access_scope,i.content_type,i.content"+joins+" order by i.id")){
    s.setFetchSize(50);try(var r=s.executeQuery()){
     while(r.next()){
      if(System.nanoTime()>deadlineNanos)throw new IllegalStateException("Audit deadline reached; no completion claimed");
      String id=r.getString(1),scope=r.getString(3),type=r.getString(4);byte[] bytes=r.getBytes(5);
      rows++;long length=bytes==null?r.getLong("source_length"):bytes.length;String hash=bytes==null?r.getString("source_hash"):MediaBinaryService.sha(bytes);raw+=length;if(bytes!=null){pgRows++;pgBytes+=bytes.length;}else objectOnlyRows++;
      field(fingerprint,id);field(fingerprint,r.getString(2));field(fingerprint,scope);field(fingerprint,type);field(fingerprint,String.valueOf(length));field(fingerprint,hash);
      if(hash==null||!hash.matches("[0-9a-f]{64}")||length<1||length>RecommendationImageValidator.MAX_BYTES||(modern&&(!hash.equals(r.getString("source_hash"))||length!=r.getLong("source_length")))||type==null||!type.startsWith("image/")||scope==null||!Set.of("PUBLIC","PRIVATE").contains(scope)){metadataErrors++;if(problems.size()<20)problems.add(id);continue;}
      String key="blobs/v1/sha256/"+hash.substring(0,2)+"/"+hash;
      var prior=blobs.putIfAbsent(hash,new Blob(key,length,type));if(prior==null)uniqueBytes+=length;
      else if(prior.bytes()!=length||!prior.type().equals(type)){metadataErrors++;if(problems.size()<20)problems.add(id);}
      boolean metadata=ready&&hash.equals(r.getString(11))&&r.getLong(12)==length&&type.equals(r.getString(13));if(metadata)bound++;
      boolean copied=metadata&&hash.equals(r.getString(6))&&key.equals(r.getString(7))&&r.getLong(8)==length&&type.equals(r.getString(9))&&"VERIFIED".equals(r.getString(10));
      if(copied)verified++;else pending++;
      if(verify){
       boolean good=checked.computeIfAbsent(hash,h->{try{var value=objects.get(key);return value.bytes().length==length&&hash.equals(MediaBinaryService.sha(value.bytes()))&&type.equals(value.contentType())&&hash.equals(value.metadata().get("raw-sha256"));}catch(RuntimeException error){return false;}});
       if(!good){objectErrors++;if(problems.size()<20)problems.add(id);}
      }
     }
    }
   }
   c.commit();
  }
  String first=HexFormat.of().formatHex(fingerprint.digest());
  if(verify){
   var expected=new HashMap<String,Blob>();blobs.values().forEach(blob->expected.put(blob.key(),blob));var seen=new HashSet<String>();String token=null;var tokens=new HashSet<String>();
   do{
    if(System.nanoTime()>deadlineNanos)throw new IllegalStateException("Object inventory deadline reached; no completion claimed");
    var page=objects.list("blobs/v1/sha256/",token);
    for(var item:page.objects()){
     if(!seen.add(item.key())||item.bytes()<0)throw new IllegalStateException("Object inventory contains invalid duplicate entries");
     listedCount++;listedBytes+=item.bytes();var want=expected.get(item.key());if(want==null)extras++;else if(want.bytes()!=item.bytes())objectErrors++;
    }
    token=page.nextToken();if(token!=null&&(!tokens.add(token)||tokens.size()>10000))throw new IllegalStateException("Object inventory cursor did not advance");
   }while(token!=null);
   for(var blob:blobs.values())if(!seen.contains(blob.key()))objectErrors++;
  }
  boolean stable=first.equals(fingerprint(deadlineNanos));
  boolean complete=verify&&ready&&stable&&rows==bound&&rows==verified&&pending==0&&metadataErrors==0&&objectErrors==0;
  return new Summary(rows,raw,blobs.size(),uniqueBytes,raw-uniqueBytes,bound,verified,pending,metadataErrors,objectErrors,listedCount,listedBytes,extras,ready,stable,complete,first,List.copyOf(problems),pgRows,pgBytes,objectOnlyRows);
 }
 private String fingerprint(long deadline)throws SQLException{
  var d=digest();try(var c=data.getConnection()){
   c.setReadOnly(true);c.setAutoCommit(false);boolean modern=metadata(c);try(var s=c.prepareStatement("select id,merchant_id,access_scope,content_type,content"+(modern?",raw_sha256,byte_length":",null,null")+" from bb_recommendation_image order by id")){
    s.setFetchSize(50);try(var r=s.executeQuery()){while(r.next()){if(System.nanoTime()>deadline)throw new IllegalStateException("Source stability check deadline reached");byte[] bytes=r.getBytes(5);for(int i=1;i<=4;i++)field(d,r.getString(i));field(d,String.valueOf(bytes==null?r.getLong(7):bytes.length));field(d,bytes==null?r.getString(6):MediaBinaryService.sha(bytes));}}
   }c.commit();
  }return HexFormat.of().formatHex(d.digest());
 }
}
