package com.bobbuy.api;

import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Reuses the two transactional HTTP scenarios on a fresh task-owned namespace in the existing local test PG. */
@EnabledIfEnvironmentVariable(named="BOBBUY_PRODUCT_RATING_PG",matches="true")
class ProductRatingPostgresIntegrationTest extends ProductRatingIntegrationTest {
 @DynamicPropertySource static void postgres(DynamicPropertyRegistry properties){
  if(Runtime.version().feature()!=17)throw new IllegalStateException("This acceptance requires actual Java17");
  String schema=System.getenv("BOBBUY_PRODUCT_RATING_SCHEMA"),password=System.getenv("BOBBUY_PRODUCT_RATING_DB_PASSWORD");
  if(schema==null||!schema.matches("cards_rating_[a-z0-9_]{1,40}")||password==null||password.isBlank())throw new IllegalStateException("Explicit isolated local test schema and synthetic credential required");
  // The existing local Docker test service only. No arbitrary production/external URL is accepted.
  properties.add("spring.datasource.url",()->"jdbc:postgresql://postgres:5432/bobuy?currentSchema="+schema);
  properties.add("spring.datasource.username",()->"bobuy");properties.add("spring.datasource.password",()->password);
  properties.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
  properties.add("spring.jpa.hibernate.ddl-auto",()->"validate");properties.add("spring.jpa.properties.hibernate.default_schema",()->schema);
  properties.add("spring.flyway.enabled",()->"true");properties.add("spring.flyway.schemas",()->schema);properties.add("spring.flyway.default-schema",()->schema);
  properties.add("spring.flyway.target",()->"28.2");properties.add("spring.flyway.clean-disabled",()->"true");
  properties.add("spring.sql.init.mode",()->"never");
 }
}
