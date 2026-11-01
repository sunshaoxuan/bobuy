package com.bobbuy.service;
import org.junit.jupiter.api.Test;
import java.sql.*;
import static org.assertj.core.api.Assertions.*;
/** SQL contract on synthetic H2 PostgreSQL mode; NOT a real PG/Flyway restore proof. */
class ReferenceMigrationTest {
 @Test void retainsLegacyRowsAndSeparatesWindowsFromImageIdentity()throws Exception{
  try(var connection=DriverManager.getConnection("jdbc:h2:mem:referenceMigration;MODE=PostgreSQL")){var statement=connection.createStatement();
   statement.execute("create table bb_recommendation_item(id bigint primary key,post_id bigint,product_id varchar(255),image_hash varchar(64),reference_price numeric(14,2),constraint uq_recommendation_item unique(post_id,product_id,image_hash))");
   statement.execute("insert into bb_recommendation_item values(1,5,'same-product','same-image',100)");
   String sql;try(var input=getClass().getResourceAsStream("/db/migration/V23__reference_offer_windows.sql")){sql=new String(java.util.Objects.requireNonNull(input).readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);}
   for(String command:sql.split(";"))if(!command.isBlank())statement.execute(command);
   var rows=statement.executeQuery("select product_id,image_hash,reference_price,offer_identity from bb_recommendation_item where id=1");assertThat(rows.next()).isTrue();assertThat(rows.getString(1)).isEqualTo("same-product");assertThat(rows.getString(2)).isEqualTo("same-image");assertThat(rows.getBigDecimal(3)).isEqualByComparingTo("100");assertThat(rows.getString(4)).isNull();
   statement.execute("insert into bb_recommendation_item(id,post_id,product_id,image_hash,reference_price,offer_identity) values(2,5,'same-product','same-image',80,'new-window')");
   assertThatThrownBy(()->statement.execute("insert into bb_recommendation_item(id,post_id,product_id,image_hash,reference_price,offer_identity) values(3,5,'same-product','other-image',80,'new-window')")).isInstanceOf(SQLException.class);
  }
 }
}
