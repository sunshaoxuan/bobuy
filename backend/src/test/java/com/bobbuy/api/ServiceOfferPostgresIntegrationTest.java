package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.PublicRecommendationBrowseService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityManager;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.context.*;
import org.springframework.test.context.transaction.*;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Same API/fact factories as H2, against an explicitly admitted existing synthetic PG target. */
@SpringBootTest
@AutoConfigureMockMvc(print=org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint.NONE)
@ActiveProfiles("service-offer-pg")
@EnabledIfEnvironmentVariable(named="BOBBUY_SERVICE_OFFER_PG",matches="true")
@Transactional
@Rollback
class ServiceOfferPostgresIntegrationTest {
 static final String LOCAL="jdbc:postgresql://postgres:5432/bobuy?currentSchema=c2_qa_82b8daf7";
 static final String HOSTED="jdbc:postgresql://127.0.0.1:5432/bobbuy";
 static String targetUrl,targetSchema,targetUser;
 @DynamicPropertySource static void isolatedTarget(DynamicPropertyRegistry registry){
  if(!"true".equals(System.getenv("BOBBUY_SERVICE_OFFER_PG")))throw new IllegalStateException("Explicit synthetic PG opt-in required");
  targetUrl=System.getProperty("bobbuy.test.serviceOffer.jdbcUrl","");
  boolean local=LOCAL.equals(targetUrl);
  boolean hosted=HOSTED.equals(targetUrl)&&"true".equals(System.getenv("GITHUB_ACTIONS"))&&"postgres-migration-verify".equals(System.getenv("GITHUB_JOB"))&&"true".equals(System.getenv("BOBBUY_ISOLATED_CI_POSTGRES"));
  if(!local&&!hosted)throw new IllegalStateException("Only the existing local synthetic schema or explicitly isolated existing CI PG service is accepted");
  targetSchema=local?"c2_qa_82b8daf7":"public";targetUser=local?"bobuy":"bobbuy";
  String user=System.getenv("BOBBUY_SERVICE_TEST_DB_USER"),password=System.getenv("BOBBUY_SERVICE_TEST_DB_PASSWORD");
  if(!targetUser.equals(user)||password==null||password.isBlank())throw new IllegalStateException("Existing synthetic DB identity must be supplied without logging it");
  registry.add("spring.datasource.url",()->targetUrl);registry.add("spring.datasource.username",()->user);registry.add("spring.datasource.password",()->password);
  registry.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");registry.add("spring.jpa.properties.hibernate.default_schema",()->targetSchema);
  registry.add("spring.jpa.hibernate.ddl-auto",()->"validate");registry.add("spring.jpa.generate-ddl",()->false);registry.add("spring.flyway.enabled",()->false);registry.add("spring.sql.init.mode",()->"never");registry.add("bobbuy.seed.enabled",()->false);registry.add("bobbuy.seed.force-reset-on-invoke",()->false);
 }
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired JwtTokenService tokens;@Autowired UserRepository users;
 @Autowired RecommendationPostRepository posts;@Autowired RecommendationItemRepository items;@Autowired ProductRepository products;
 @Autowired PublicRecommendationBrowseService browse;@Autowired JdbcTemplate jdbc;@Autowired EntityManager entityManager;
 Map<String,String> beforeRows;String beforeShape;String token,foreign,customer;long ownerId;String tag;
 @BeforeTransaction void inspectBeforeAnyFixtureWrite(){
  jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Void>)c->{assertThat(c.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");assertThat(c.getMetaData().getURL()).isEqualTo(targetUrl);return null;});
  assertThat(jdbc.queryForObject("select current_database()",String.class)).isEqualTo(targetSchema.equals("public")?"bobbuy":"bobuy");
  assertThat(jdbc.queryForObject("select current_schema()",String.class)).isEqualTo(targetSchema);assertThat(jdbc.queryForObject("select current_user",String.class)).isEqualTo(targetUser);
  assertThat(jdbc.queryForObject("select current_setting('server_version_num')::int",Integer.class)).isBetween(180000,189999);
  assertThat(jdbc.queryForObject("select version from flyway_schema_history where success order by installed_rank desc limit 1",String.class)).isEqualTo("28.1");
  assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where not success",Integer.class)).isZero();
  beforeRows=fingerprints();beforeShape=shape();
 }
 @BeforeEach void onlyOwnTransactionalFixtures(){
  tag="service-pg-"+UUID.randomUUID();var owner=user(Role.AGENT);ownerId=owner.getId();token=tokens.createAccessToken(owner);foreign=tokens.createAccessToken(user(Role.AGENT));customer=tokens.createAccessToken(user(Role.CUSTOMER));
 }
 User user(Role role){long id=900_000_000_000L+Integer.toUnsignedLong(UUID.randomUUID().hashCode());assertThat(users.existsById(id)).isFalse();var u=new User(id,"Synthetic "+tag,role,0);u.setUsername(tag+"-"+id);return users.saveAndFlush(u);}
 @AfterTransaction void rollbackKeepsExistingRowsAndShape(){if(beforeRows!=null){assertThat(fingerprints()).isEqualTo(beforeRows);assertThat(shape()).isEqualTo(beforeShape);}}
 Map<String,String> fingerprints(){
  var result=new TreeMap<String,String>();for(String schema:new LinkedHashSet<>(List.of("public",targetSchema))){
   for(String table:jdbc.queryForList("select tablename from pg_catalog.pg_tables where schemaname=? order by tablename",String.class,schema)){
    assertThat(schema).matches("[a-z0-9_]+");assertThat(table).matches("[a-z0-9_]+");
    result.put(schema+"."+table,jdbc.queryForObject("select count(*)::text||':'||md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from \""+schema+"\".\""+table+"\" t",String.class));
   }
  }return result;
 }
 String shape(){return jdbc.queryForObject("select md5(coalesce(string_agg(row_to_json(c)::text,'' order by table_schema,table_name,ordinal_position),'')) from (select table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema in ('public',?)) c",String.class,targetSchema);}
 ObjectNode legacy(){var offer=ServiceOfferIntegrationTest.offer(json);offer.put("sourceUrl","https://example.invalid/"+tag+"/legacy");return offer;}
 ObjectNode packages(){var offer=ServiceOfferIntegrationTest.packageOffer(json);offer.put("sourceUrl","https://example.invalid/"+tag+"/packages");return offer;}
 JsonNode data(ResultActions action)throws Exception{return json.readTree(action.andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).path("data");}
 ResultActions create(ObjectNode offer,String auth)throws Exception{return mvc.perform(post("/api/merchant/recommendations/service-offers").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(offer)));}
 ResultActions save(JsonNode post,ObjectNode offer,String auth)throws Exception{return mvc.perform(put("/api/merchant/recommendations/"+post.at("/post/id").asLong()+"/service-offer").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("offer",offer,"version",post.at("/post/version").asLong()))));}
 JsonNode reopen(JsonNode post)throws Exception{entityManager.flush();entityManager.clear();return data(mvc.perform(get("/api/merchant/recommendations/"+post.at("/post/id").asLong()).header("Authorization","Bearer "+token)));}
 JsonNode raw(JsonNode post)throws Exception{return json.readTree(jdbc.queryForObject("select service_offer::text from bb_recommendation_post where id=? and merchant_id=?",String.class,post.at("/post/id").asLong(),ownerId));}
 void publish(JsonNode post)throws Exception{data(mvc.perform(post("/api/merchant/recommendations/"+post.at("/post/id").asLong()+"/publish").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("version",post.at("/post/version").asLong())))));}
 @Test void sameCandidateReopensOldAndPackageJsonAndPublishesAccurateCards()throws Exception{
  long productCount=products.count(),itemCount=items.count();
  var old=reopen(data(create(legacy(),token)));var oldJson=raw(old);assertThat(oldJson.has("basis")).isFalse();assertThat(oldJson.has("packages")).isFalse();assertThat(oldJson.at("/staff").asInt()).isEqualTo(2);assertThat(oldJson.at("/hours").asInt()).isEqualTo(3);assertThat(oldJson.at("/price").asInt()).isEqualTo(26400);
  var next=reopen(data(create(packages(),token)));assertThat(raw(old)).isEqualTo(oldJson);var stored=raw(next);
  assertThat(stored.path("basis").asText()).isEqualTo("TASK_PACKAGES");assertThat(stored.path("currency").asText()).isEqualTo("JPY");assertThat(stored.path("taxIncluded").asBoolean()).isTrue();for(String field:List.of("staff","hours","price","originalPrice","applicationStart","serviceStart"))assertThat(stored.path(field).isNull()).as(field).isTrue();
  assertThat(stored.at("/fees/0/amount").isNull()).isTrue();assertThat(stored.at("/fees/0/kind").asText()).isEqualTo("CONDITIONAL");
  int[] prices={64900,89100,35200,30080};assertThat(stored.path("packages").size()).isEqualTo(prices.length);for(int i=0;i<prices.length;i++){var option=stored.path("packages").get(i);assertThat(option.path("price").asInt()).isEqualTo(prices[i]);assertThat(option.path("originalPrice").isNull()).isTrue();for(String locale:RecommendationServiceOffer.LOCALES)assertThat(option.at("/terms/"+locale+"/scope").asText()).isNotBlank();}
  publish(old);publish(next);entityManager.flush();entityManager.clear();
  for(var saved:List.of(old,next)){var publicView=data(mvc.perform(get("/api/storefront/recommendations/"+saved.at("/post/id").asLong())));assertThat(publicView.at("/serviceOffer/sourceUrl").isNull()).isTrue();assertThat(publicView.at("/serviceOffer/sourceText").isNull()).isTrue();assertThat(publicView.path("items")).isEmpty();}
  var cards=browse.page(0,ownerId,null,"en-US","all","","",null);assertThat(cards.serviceCards()).isEqualTo(2);assertThat(cards.productOccurrences()).isZero();assertThat(cards.items()).allMatch(c->c.item()==null);
  var summary=cards.items().stream().filter(c->c.post().id().equals(next.at("/post/id").asLong())).findFirst().orElseThrow().serviceSummary();assertThat(summary.basis()).isEqualTo(RecommendationServiceOffer.Basis.TASK_PACKAGES);assertThat(summary.price()).isNull();assertThat(summary.packages()).extracting(p->p.price().intValueExact()).containsExactly(64900,89100,35200,30080);assertThat(json.valueToTree(summary).has("sourceText")).isFalse();
  assertThat(raw(old)).isEqualTo(oldJson);assertThat(products.count()).isEqualTo(productCount);assertThat(items.count()).isEqualTo(itemCount);
 }
 @Test void packageSourceRetryVersionOwnershipAndPrivateSourceRemainBound()throws Exception{
  var input=packages();var first=data(create(input,token));assertThat(data(create(input,token)).at("/post/id")).isEqualTo(first.at("/post/id"));assertThat(jdbc.queryForObject("select count(*) from bb_recommendation_post where merchant_id=?",Integer.class,ownerId)).isEqualTo(1);
  String originalBody=input.path("sourceText").asText(),originalUrl=input.path("sourceUrl").asText();String sourceKey=jdbc.queryForObject("select service_source_key from bb_recommendation_post where id=?",String.class,first.at("/post/id").asLong());((ObjectNode)input.at("/packages/0/terms/en-US")).put("scope","New independently reviewed synthetic scope");var current=data(save(first,input,token));assertThat(data(save(first,input,token)).at("/post/version")).isEqualTo(current.at("/post/version"));assertThat(reopen(current).at("/serviceOffer/sourceText").asText()).isEqualTo(originalBody);
  ((ObjectNode)input.at("/packages/0")).put("price",64000);save(first,input,token).andExpect(status().isBadRequest());save(current,input,foreign).andExpect(status().isNotFound());
  create(input,customer).andExpect(status().isForbidden());mvc.perform(post("/api/merchant/recommendations/service-offers").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(input))).andExpect(status().isUnauthorized());
  input.put("sourceText","Changed original must conflict");save(current,input,token).andExpect(status().isBadRequest());create(input,token).andExpect(status().isBadRequest());var reopened=reopen(current);assertThat(reopened.at("/serviceOffer/sourceText").asText()).isEqualTo(originalBody);assertThat(reopened.at("/serviceOffer/sourceUrl").asText()).isEqualTo(originalUrl);assertThat(jdbc.queryForObject("select service_source_key from bb_recommendation_post where id=?",String.class,first.at("/post/id").asLong())).isEqualTo(sourceKey);
 }
}
