package com.bobbuy.service;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.flywaydb.core.Flyway;
import java.nio.file.*;
import java.sql.*;
import static org.assertj.core.api.Assertions.*;

/** Real SQL/Flyway/H2 recovery exercise. This is not a PostgreSQL production restore. */
class IdentityMigrationRecoveryTest {
 @TempDir Path temp;
 @Test void additiveMigrationOldVersionValidationAndBackupRestoreKeepSidecars() throws Exception {
  String url="jdbc:h2:mem:identity_migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()){
   s.execute("create table bb_user(id bigint primary key)");s.execute("insert into bb_user values(1)");
   s.execute("create table bb_product(id varchar(255) primary key)");s.execute("insert into bb_product values('p')");
   s.execute("create table bb_order_header(id bigint primary key,lines jsonb)");s.execute("insert into bb_order_header values(1,'[]' format json)");
  }
  Path current=Files.createDirectory(temp.resolve("current")),old=Files.createDirectory(temp.resolve("old"));
  try(var source=IdentityMigrationRecoveryTest.class.getResourceAsStream("/db/migration/V25__reversible_product_identity.sql")){assertThat(source).isNotNull();Files.copy(source,current.resolve("V25__reversible_product_identity.sql"));}
  var next=Flyway.configure().dataSource(url,"sa","").locations("filesystem:"+current).baselineVersion("24").baselineOnMigrate(true).load();
  assertThat(next.migrate().migrationsExecuted).isEqualTo(1);
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()){
   s.execute("update bb_order_header set product_identities='{\"1\":{\"brand\":\"Synthetic\"}}' format json where id=1");
   s.execute("insert into bb_product_catalog_recovery(id,merchant_id,product_id,version_after,created_at,original) values('checkpoint',1,'p',2,current_timestamp,'{\"catalogData\":null}' format json)");
  }
  // Same Flyway library and unmodified default future-migration policy as the baseline.
  var previous=Flyway.configure().dataSource(url,"sa","").locations("filesystem:"+old).load();
  assertThat(previous.validateWithResult().validationSuccessful).isTrue();
  Path backup=temp.resolve("synthetic-backup.sql");
  try(var c=DriverManager.getConnection(url,"sa","");var s=c.createStatement()){s.execute("SCRIPT TO '"+backup.toString().replace("'","''")+"'");}
  String restored="jdbc:h2:mem:identity_restore;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
  try(var c=DriverManager.getConnection(restored,"sa","");var s=c.createStatement()){
   s.execute("RUNSCRIPT FROM '"+backup.toString().replace("'","''")+"'");
   try(var r=s.executeQuery("select lines,product_identities from bb_order_header where id=1")){assertThat(r.next()).isTrue();assertThat(r.getString(1)).isEqualTo("[]");assertThat(r.getString(2)).contains("Synthetic");}
   try(var r=s.executeQuery("select original from bb_product_catalog_recovery where id='checkpoint'")){assertThat(r.next()).isTrue();assertThat(r.getString(1)).contains("\"catalogData\":null");}
  }
 }
}
