package com.bobbuy.service;

import com.bobbuy.api.BobbuyApplication;
import com.bobbuy.model.RecommendationImage;
import com.bobbuy.repository.RecommendationImageRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.SpringApplication;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.nio.file.*;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Synthetic PG15 fixture only. Excluded from application jar; never a production importer. */
public final class MediaMigrationFixture {
 private static void require(boolean good,String message){if(!good)throw new AssertionError(message);}
 public static void main(String[] args)throws Exception{
  require("true".equals(System.getenv("BOBUY_SYNTHETIC_RUSTFS_PROBE")),"Synthetic guard required");
  String url=System.getenv("SPRING_DATASOURCE_URL");require("jdbc:postgresql://postgres:5432/bobuy_migration_pg15_20261028".equals(url),"Only the owned disposable PG15 database is permitted");
  require("bobuy-media-test".equals(System.getenv("BOBBUY_MEDIA_RUSTFS_BUCKET")),"Only approved test bucket permitted");
  var source=new DriverManagerDataSource(url,System.getenv("SPRING_DATASOURCE_USERNAME"),System.getenv("SPRING_DATASOURCE_PASSWORD"));
  try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("show server_version")){r.next();require(r.getString(1).startsWith("15.19"),"Exact current-production PG15.19 combination required");}
  String phase=args.length==0?"":args[0];var report=new LinkedHashMap<String,Object>();
  if(phase.equals("prepare")){
   org.flywaydb.core.Flyway.configure().dataSource(source).target("20").load().migrate();
   try(var c=source.getConnection()){
    c.setAutoCommit(false);try(var check=c.createStatement();var rows=check.executeQuery("select count(*) from bb_recommendation_image")){rows.next();require(rows.getLong(1)==0,"Do not repeat fixture creation");}
    try(var s=c.createStatement()){s.executeUpdate("insert into bb_user(id,name,enabled,rating,roles) values(1000,'Disabled synthetic migration owner',false,0,'[\"CUSTOMER\"]'::jsonb)");}
    var cache=new HashMap<Integer,byte[]>();try(var insert=c.prepareStatement("insert into bb_recommendation_image(id,merchant_id,image_hash,content_type,content,access_scope) values(?,1000,?,'image/png',?,?)")){
     for(int i=0;i<566;i++){String id="synthetic-"+String.format("%05d",i);int image=i%500;byte[] bytes=cache.computeIfAbsent(image,MediaMigrationFixture::png);insert.setString(1,id);insert.setString(2,MediaBinaryService.sha(id.getBytes(java.nio.charset.StandardCharsets.UTF_8)));insert.setBytes(3,bytes);insert.setString(4,i%2==0?"PUBLIC":"PRIVATE");insert.addBatch();if(i%50==49)insert.executeBatch();}insert.executeBatch();
    }c.commit();
   }
   report.put("pg15V20SyntheticBaseline",true);report.put("inventory",new MediaMigrationAudit(source,null).inspect(false,System.nanoTime()+TimeUnit.SECONDS.toNanos(90)));
  }else if(phase.equals("migrate")){
   try(var context=SpringApplication.run(BobbuyApplication.class,"--bobbuy.seed.enabled=false","--spring.jpa.hibernate.ddl-auto=validate","--server.port=8080")){
    report.put("actualPg15FlywayV21AndHibernateStartup",true);report.put("inventory",new MediaMigrationAudit(source,null).inspect(false,System.nanoTime()+TimeUnit.SECONDS.toNanos(90)));
   }
  }else if(phase.equals("increment")){
   try(var context=new AnnotationConfigApplicationContext()){
    context.getEnvironment().setActiveProfiles("media-migration-command");context.registerBean(javax.sql.DataSource.class,()->source);context.register(MediaMigrationCommand.Configuration.class);context.refresh();
    var binary=context.getBean(MediaBinaryService.class);var images=context.getBean(RecommendationImageRepository.class);
    var checkpoint=new ObjectMapper().readTree(Files.readString(Path.of("/run/migration-state/checkpoint.json")));String cursor=checkpoint.path("after").asText();require(!cursor.isBlank(),"A real persisted partial cursor is required");
    report.put("firstWriteAt",Instant.now().toString());
    for(int i=0;i<20;i++){var image=new RecommendationImage();image.id="synthetic-00000-increment-"+String.format("%03d",i);require(image.id.compareTo(cursor)<0,"Increment must fall behind saved cursor");require(!images.existsById(image.id),"Do not repeat increment creation");image.merchantId=1000L;image.accessScope=i%2==0?"PRIVATE":"PUBLIC";image.imageHash=MediaBinaryService.sha(image.id.getBytes(java.nio.charset.StandardCharsets.UTF_8));image.contentType="image/png";image.content=png(1000+i);binary.persist(image);}
    for(int i=0;i<5;i++){var image=images.findById("synthetic-"+String.format("%05d",i)).orElseThrow();image.content=png(2000+i);binary.persist(image);}
    report.put("newRowsBehindCursor",20);report.put("sourceUpdates",5);report.put("lastWriteAt",Instant.now().toString());
   }
   report.put("inventory",new MediaMigrationAudit(source,null).inspect(false,System.nanoTime()+TimeUnit.SECONDS.toNanos(90)));
  }else throw new IllegalArgumentException("Unknown synthetic fixture phase");
  report.put("productionChanged",false);report.put("at",Instant.now().toString());Files.writeString(Path.of("/run/migration-state/fixture-"+phase+".json"),new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(report));System.out.println("SYNTHETIC_FIXTURE "+phase+" complete");System.exit(0);
 }
 private static byte[] png(int seed){try{var image=new java.awt.image.BufferedImage(200,200,java.awt.image.BufferedImage.TYPE_INT_RGB);var random=new Random(2026102800L+seed);for(int y=0;y<200;y++)for(int x=0;x<200;x++)image.setRGB(x,y,random.nextInt());var output=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(image,"png",output);return output.toByteArray();}catch(Exception e){throw new IllegalStateException("Synthetic PNG generation failed");}}
}
