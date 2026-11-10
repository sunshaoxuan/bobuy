package com.bobbuy.api;

import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import java.sql.*;
import java.util.*;
import org.flywaydb.core.Flyway;

/** Reuses the two transactional HTTP scenarios on a fresh task-owned namespace in the existing local test PG. */
@EnabledIfEnvironmentVariable(named="BOBBUY_PRODUCT_RATING_PG",matches="true")
class ProductRatingPostgresIntegrationTest extends ProductRatingIntegrationTest {
 @DynamicPropertySource static void postgres(DynamicPropertyRegistry properties){
  if(Runtime.version().feature()!=17)throw new IllegalStateException("This acceptance requires actual Java17");
  String schema=System.getenv("BOBBUY_PRODUCT_RATING_SCHEMA"),password=System.getenv("BOBBUY_PRODUCT_RATING_DB_PASSWORD");
  if(schema==null||!schema.matches("cards_rating_[a-z0-9_]{1,40}")||password==null||password.isBlank())throw new IllegalStateException("Explicit isolated local test schema and synthetic credential required");
  String url="jdbc:postgresql://postgres:5432/bobuy?currentSchema="+schema;
  preservePopulatedMigration(url,schema,password);
  // The existing local Docker test service only. No arbitrary production/external URL is accepted.
  properties.add("spring.datasource.url",()->url);
  properties.add("spring.datasource.username",()->"bobuy");properties.add("spring.datasource.password",()->password);
  properties.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
  properties.add("spring.jpa.hibernate.ddl-auto",()->"validate");properties.add("spring.jpa.properties.hibernate.default_schema",()->schema);
  properties.add("spring.flyway.enabled",()->"true");properties.add("spring.flyway.schemas",()->schema);properties.add("spring.flyway.default-schema",()->schema);
  properties.add("spring.flyway.target",()->"28.2");properties.add("spring.flyway.clean-disabled",()->"true");
  properties.add("spring.sql.init.mode",()->"never");
 }
 private static void preservePopulatedMigration(String url,String schema,String password){
  try(var connection=DriverManager.getConnection(url,"bobuy",password)){
   try(var query=connection.prepareStatement("select count(*) from pg_namespace where nspname=?")){query.setString(1,schema);try(var row=query.executeQuery()){row.next();if(row.getInt(1)!=0)throw new IllegalStateException("Fresh owned namespace required; existing schema is retained, never reset");}}
   Flyway.configure().dataSource(url,"bobuy",password).schemas(schema).defaultSchema(schema).cleanDisabled(true).target("28.1").load().migrate();
   try(var sql=connection.createStatement()){
    sql.execute("insert into bb_user(id,name,username,roles) values(98732099,'Synthetic migration sentinel','rating-migration-synthetic','[\"AGENT\"]'::jsonb)");
    sql.execute("insert into bb_product(id,merchant_id,name,description,base_price,attributes,media_gallery) values('rating-migration-sentinel',98732099,'{\"ja-JP\":\"Synthetic retained product\"}'::jsonb,'{}'::jsonb,321,'{}'::jsonb,'[]'::jsonb)");
   }
   var tables=new ArrayList<String>();try(var query=connection.prepareStatement("select tablename from pg_tables where schemaname=? and tablename<>'flyway_schema_history' order by tablename")){query.setString(1,schema);try(var rows=query.executeQuery()){while(rows.next())tables.add(rows.getString(1));}}
   var before=fingerprint(connection,schema,tables);
   Flyway.configure().dataSource(url,"bobuy",password).schemas(schema).defaultSchema(schema).cleanDisabled(true).target("28.2").load().migrate();
   if(!before.equals(fingerprint(connection,schema,tables)))throw new IllegalStateException("Rating migration changed an existing table shape or retained row");
   try(var query=connection.createStatement();var rows=query.executeQuery("select count(*) from bb_product_rating")){rows.next();if(rows.getLong(1)!=0)throw new IllegalStateException("Old products must not acquire synthetic ratings");}
   System.out.println("RATING_POPULATED_MIGRATION_PASS oldTables="+tables.size()+" retainedSyntheticProduct=1 defaultRatingRows=0");
  }catch(SQLException failure){throw new IllegalStateException("Isolated rating migration check failed; retain owned schema and failure",failure);}
 }
 private static Map<String,String> fingerprint(Connection connection,String schema,List<String> tables)throws SQLException{
  var values=new TreeMap<String,String>();
  for(var table:tables){
   String name="\""+schema+"\".\""+table.replace("\"","\"\"")+"\"";
   try(var query=connection.createStatement();var rows=query.executeQuery("select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from "+name+" t")){rows.next();values.put(table+":rows",rows.getString(1));}
   try(var query=connection.prepareStatement("select md5(coalesce(jsonb_agg(to_jsonb(c) order by ordinal_position)::text,'[]')) from information_schema.columns c where table_schema=? and table_name=?")){query.setString(1,schema);query.setString(2,table);try(var rows=query.executeQuery()){rows.next();values.put(table+":columns",rows.getString(1));}}
  }
  return values;
 }
}
