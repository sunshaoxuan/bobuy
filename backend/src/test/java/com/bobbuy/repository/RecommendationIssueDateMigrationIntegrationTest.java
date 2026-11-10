package com.bobbuy.repository;

import com.bobbuy.compat.PreviousRecommendationPost;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.postgresql.ds.PGSimpleDataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.*;

/** The existing hosted CI PG service only. This is mapping/Flyway compatibility, not an old application boot. */
@EnabledIfEnvironmentVariable(named="BOBBUY_ISOLATED_CI_POSTGRES",matches="true")
class RecommendationIssueDateMigrationIntegrationTest {
    static final String URL="jdbc:postgresql://127.0.0.1:5432/bobbuy";
    static final String BASELINE_SHA="48bbcc808d0a0761e112b720c276592afe52f9979031a9975247065efeb277ba";
    static final String MIGRATION_SHA="d742bea25cb8ef3d205c9e2a4992d25024a372b5ab9dc38dc915f0ebbb91224e";
    static PGSimpleDataSource datasource;
    JdbcTemplate jdbc;
    Long id;
    String username;
    @TempDir Path oldResources;
    static String sha(byte[] bytes)throws Exception{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}
    @BeforeAll static void requireExactHostedIsolation(){
        assertThat(System.getenv("GITHUB_ACTIONS")).isEqualTo("true");assertThat(System.getenv("GITHUB_EVENT_NAME")).isEqualTo("workflow_dispatch");assertThat(System.getenv("GITHUB_JOB")).isEqualTo("postgres-migration-verify");
        assertThat(System.getProperty("spring.datasource.url")).isEqualTo(URL);
        datasource=new PGSimpleDataSource();datasource.setURL(URL);datasource.setUser("bobbuy");datasource.setPassword("bobbuypassword");
    }
    @BeforeEach void ownSyntheticPost(){
        jdbc=new JdbcTemplate(datasource);assertThat(jdbc.queryForObject("select version from flyway_schema_history order by installed_rank desc limit 1",String.class)).isEqualTo("28.1");
        id=20_000_000_000L+Integer.toUnsignedLong(UUID.randomUUID().hashCode());username="ci-old-post-"+UUID.randomUUID();
        jdbc.update("insert into bb_user(id,name,username,roles) values(?,?,?,'[\"AGENT\"]'::jsonb)",id,"SYNTHETIC old mapping",username);
        jdbc.update("insert into bb_recommendation_post(id,merchant_id,title,body) values(?,?,?,?)",id,id,"SYNTHETIC original title","SYNTHETIC original body");
    }
    @AfterEach void removeOnlyOwnRows(){
        if(jdbc==null||id==null)return;
        assertThat(jdbc.update("delete from bb_recommendation_post where id=? and merchant_id=?",id,id)).isBetween(0,1);
        assertThat(jdbc.update("delete from bb_user where id=? and username=?",id,username)).isBetween(0,1);
    }
    String reviewColumns(){return jdbc.queryForObject("select json_build_object('issueDate',issue_date,'sourceRef',issue_date_source_ref,'sourceHash',issue_date_source_hash,'reviewedBy',issue_date_reviewed_by,'reviewedAt',issue_date_reviewed_at)::text from bb_recommendation_post where id=?",String.class,id);}
    @Test void nullableUpgradeAndCompletenessConstraintKeepOldRowsUnknown(){
        assertThat(jdbc.queryForObject("select count(*) from bb_recommendation_post where id=? and issue_date is null and issue_date_source_ref is null and issue_date_source_hash is null and issue_date_reviewed_by is null and issue_date_reviewed_at is null",Integer.class,id)).isEqualTo(1);
        assertThatThrownBy(()->jdbc.update("update bb_recommendation_post set issue_date=date '2026-10-31' where id=?",id)).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class).hasMessageContaining("ck_recommendation_issue_date_review");
        assertThat(jdbc.queryForObject("select issue_date from bb_recommendation_post where id=?",java.sql.Date.class,id)).isNull();
        jdbc.update("update bb_recommendation_post set issue_date=date '2026-10-31',issue_date_source_ref='message:ci-source',issue_date_source_hash=repeat('a',64),issue_date_reviewed_by=?,issue_date_reviewed_at=timestamptz '2026-11-01T00:00:00Z' where id=?",id,id);
        assertThat(reviewColumns()).contains("2026-10-31","message:ci-source");
    }
    @Test void exactPreviousPostColumnMappingUpdatesOldFieldsWithoutErasingDateEvidence(){
        jdbc.update("update bb_recommendation_post set issue_date=date '2026-10-31',issue_date_source_ref='message:ci-old-post',issue_date_source_hash=repeat('b',64),issue_date_reviewed_by=?,issue_date_reviewed_at=timestamptz '2026-11-01T00:00:00Z' where id=?",id,id);
        String before=reviewColumns();
        assertThat(Arrays.stream(PreviousRecommendationPost.class.getDeclaredFields()).map(java.lang.reflect.Field::getName)).doesNotContain("issueDate","issueDateSourceRef","issueDateSourceHash","issueDateReviewedBy","issueDateReviewedAt");
        var configuration=new org.hibernate.cfg.Configuration().addAnnotatedClass(PreviousRecommendationPost.class)
            .setPhysicalNamingStrategy(new org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy())
            .setProperty("hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy")
            .setProperty("hibernate.hbm2ddl.auto","validate");
        configuration.getProperties().put("hibernate.connection.datasource",datasource);
        try(var factory=configuration.buildSessionFactory();var session=factory.openSession()){
            var transaction=session.beginTransaction();var previous=session.find(PreviousRecommendationPost.class,id);
            previous.title="SYNTHETIC old application edit";previous.body="SYNTHETIC old body edit";previous.updatedAt=LocalDateTime.of(2026,11,2,0,0);transaction.commit();
        }
        assertThat(jdbc.queryForObject("select title from bb_recommendation_post where id=?",String.class,id)).isEqualTo("SYNTHETIC old application edit");
        assertThat(reviewColumns()).isEqualTo(before);assertThat(jdbc.queryForObject("select version from bb_recommendation_post where id=?",Long.class,id)).isEqualTo(1);
    }
    Path projectRoot(){var path=Path.of("").toAbsolutePath();while(path!=null){if(Files.isRegularFile(path.resolve("backend/pom.xml"))&&Files.isRegularFile(path.resolve(".github/workflows/ci.yml")))return path;path=path.getParent();}throw new IllegalStateException("Expected the existing Bobuy checkout");}
    @Test void oldFlywayDiscoveryValidatesFuture28_1AndDoesNotReplayAnyMigration()throws Exception{
        Path root=projectRoot();byte[] raw=Files.readAllBytes(root.resolve("docs/reports/c2-cart-20261109/accepted-inputs.json"));assertThat(sha(raw)).isEqualTo(BASELINE_SHA);
        var baseline=new ObjectMapper().readTree(raw);assertThat(baseline.path("schemaAfter").asInt()).isEqualTo(28);assertThat(baseline.path("migrations").size()).isEqualTo(27);
        for(var entry:baseline.path("migrations")){
            String name=entry.path("path").asText();assertThat(name).matches("V[0-9]+__[^/]+\\.sql");
            byte[] sql=Files.readAllBytes(root.resolve("backend/src/main/resources/db/migration").resolve(name));assertThat(sha(sql)).isEqualTo(entry.path("sha256").asText());Files.write(oldResources.resolve(name),sql,StandardOpenOption.CREATE_NEW);
        }
        assertThat(sha(Files.readAllBytes(root.resolve("backend/src/main/resources/db/migration/V28_1__recommendation_issue_date.sql")))).isEqualTo(MIGRATION_SHA);
        String query="select coalesce(json_agg(h order by installed_rank)::text,'[]') from flyway_schema_history h";String before=jdbc.queryForObject(query,String.class);
        var old=Flyway.configure().dataSource(datasource).locations("filesystem:"+oldResources.toAbsolutePath()).load();
        // Do not relax ignore patterns: this verifies the actual Flyway 11.14.1 default future policy.
        assertThat(old.validateWithResult().validationSuccessful).isTrue();
        assertThat(Arrays.stream(old.info().all()).filter(row->row.getVersion()!=null&&row.getVersion().toString().equals("28.1")).map(row->row.getState().name())).containsExactly("FUTURE_SUCCESS");
        assertThat(old.migrate().migrationsExecuted).isZero();assertThat(jdbc.queryForObject(query,String.class)).isEqualTo(before);
    }
}
