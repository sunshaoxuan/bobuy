package com.bobbuy.service;
import java.nio.file.*;import java.sql.*;import org.junit.jupiter.api.Test;import static org.assertj.core.api.Assertions.*;
class ServiceOfferMigrationTest {
 @Test void nullableAdditionsPreserveLegacyIssuesAndEnforceSourcePairAndIdempotency()throws Exception{
  try(var c=DriverManager.getConnection("jdbc:h2:mem:service_v26;MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa","");var s=c.createStatement()){
   s.execute("create table bb_recommendation_post(id bigint primary key,merchant_id bigint not null,body text)");s.execute("insert into bb_recommendation_post values(1,10,'retained old body'),(2,10,'second legacy body')");
   try(var source=ServiceOfferMigrationTest.class.getResourceAsStream("/db/migration/V26__recommendation_service_offers.sql")){assertThat(source).isNotNull();s.execute(new String(source.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));}
   try(var r=s.executeQuery("select count(*) from bb_recommendation_post where service_offer is null and service_source_key is null")){r.next();assertThat(r.getInt(1)).isEqualTo(2);}
   assertThatThrownBy(()->s.execute("update bb_recommendation_post set service_source_key='a' where id=1")).isInstanceOf(SQLException.class);
   s.execute("update bb_recommendation_post set service_offer='{}',service_source_key='a' where id=1");assertThatThrownBy(()->s.execute("update bb_recommendation_post set service_offer='{}',service_source_key='a' where id=2")).isInstanceOf(SQLException.class);
   try(var r=s.executeQuery("select body from bb_recommendation_post where id=1")){r.next();assertThat(r.getString(1)).isEqualTo("retained old body");}
  }
 }
}
