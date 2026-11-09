package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.service.RecommendationPublication;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;

/** Destructive synthetic migration fixture: only the existing explicitly selected hosted CI PG. */
@EnabledIfEnvironmentVariable(named="BOBBUY_ISOLATED_CI_POSTGRES",matches="true")
class RecommendationPublicationMigrationIntegrationTest {
    static final String URL="jdbc:postgresql://127.0.0.1:5432/bobbuy";
    static Connection connection;
    static Map<String,List<String>> oldColumns;
    static Map<String,String> beforeRows;
    static List<String> beforeHistory;
    static boolean fixtureCommitted;
    static final ObjectMapper JSON=new ObjectMapper().findAndRegisterModules();
    static void isolatedCiArguments() {
        assertEquals("true",System.getenv("BOBBUY_ISOLATED_CI_POSTGRES"));
        assertEquals("true",System.getenv("CI"));
        assertEquals("true",System.getenv("GITHUB_ACTIONS"));
        assertEquals("workflow_dispatch",System.getenv("GITHUB_EVENT_NAME"));
        assertEquals("postgres-migration-verify",System.getenv("GITHUB_JOB"));
        assertEquals(URL,System.getProperty("spring.datasource.url"));
        assertEquals("bobbuy",System.getProperty("spring.datasource.username"));
        assertEquals("org.postgresql.Driver",System.getProperty("spring.datasource.driver-class-name"));
    }
    static void actualPostgres(Connection verified) throws SQLException {
        var metadata=verified.getMetaData();
        assertEquals("PostgreSQL",metadata.getDatabaseProductName());
        assertEquals(URL,metadata.getURL());assertEquals("bobbuy",metadata.getUserName());
        assertEquals("bobbuy",verified.getCatalog());
    }
    @BeforeAll static void prepare() throws Exception {
        // Both explicit existing-CI arguments and actual driver identity precede Flyway clean.
        isolatedCiArguments();
        try(var verified=DriverManager.getConnection(URL,"bobbuy","bobbuypassword")){actualPostgres(verified);}
        var migrations=Path.of("src/main/resources/db/migration").toAbsolutePath();
        if(!migrations.toFile().isDirectory())migrations=Path.of("backend/src/main/resources/db/migration").toAbsolutePath();
        assertTrue(Files.isDirectory(migrations));
        assertTrue(Files.isRegularFile(migrations.resolve("V28__checkout_delivery_snapshot.sql")));
        assertTrue(Files.isRegularFile(migrations.resolve("V31__recommendation_item_publication.sql")));
        var flyway=Flyway.configure().dataSource(URL,"bobbuy","bobbuypassword").locations("filesystem:"+migrations)
            .target("28").cleanDisabled(false).load();
        flyway.clean();flyway.migrate();flyway.validate();
        connection=DriverManager.getConnection(URL,"bobbuy","bobbuypassword");
        actualPostgres(connection);
        assertFalse(columns().get("bb_user").contains("role"));
        assertTrue(columns().get("bb_user").contains("roles"));
        connection.setAutoCommit(false);
        try{
        execute("INSERT INTO bb_user(id,name,username,roles) VALUES(-310001,'Synthetic publication merchant','ci-item-publication','[\"AGENT\"]'::jsonb);"
            +"INSERT INTO bb_product(id,merchant_id,item_number,name,description,record_version,catalog_data,media_gallery,visibility_status) VALUES "
            +"('ci-item-publication-product',-310001,'47506','{\"ja-JP\":\"Synthetic canonical carton\"}'::jsonb,'{}'::jsonb,2,"
            +"'{\"specification\":{\"ja-JP\":\"24 cartons of 200ml\"},\"categoryIds\":[],\"reviewedBy\":-310001,\"reviewedAt\":\"2026-01-01T00:00:00Z\"}'::jsonb,"
            +"'[{\"url\":\"https://example.invalid/legacy-carton.jpg\",\"type\":\"IMAGE\",\"visible\":true}]'::jsonb,'DRAFTER_ONLY');"
            +"INSERT INTO bb_recommendation_post(id,merchant_id,title,body,published,published_at,publisher_id,publisher_name) VALUES "
            +"(-310001,-310001,'Synthetic legacy public','Original article',true,'2026-01-01T00:00:00Z',-310001,'Synthetic merchant'),"
            +"(-310002,-310001,'Synthetic private draft','Never publish automatically',false,NULL,NULL,NULL);"
            +"INSERT INTO bb_recommendation_item(id,post_id,product_id,name,item_number,specification,reference_price,image_hash,image_url) VALUES "
            +"(-310001,-310001,'ci-item-publication-product','Original source name','47506','Original bottle wording',123,'"+"a".repeat(64)+"','https://example.invalid/original-promo.jpg'),"
            +"(-310002,-310002,'ci-item-publication-product','Pending 1731065','1731065','Incomplete source',NULL,'"+"b".repeat(64)+"','https://example.invalid/pending.jpg'),"
            +"(-310003,-310001,NULL,'Unlinked legacy source',NULL,NULL,NULL,'"+"c".repeat(64)+"','https://example.invalid/unlinked.jpg');");
            connection.commit();fixtureCommitted=true;
        }catch(Exception error){connection.rollback();throw error;}
        finally{connection.setAutoCommit(true);}
        assertEquals(Set.of(Role.AGENT),Set.of(JSON.readValue(scalar("SELECT roles::text FROM bb_user WHERE id=-310001"),Role[].class)));
        var catalog=JSON.readValue(scalar("SELECT catalog_data::text FROM bb_product WHERE id='ci-item-publication-product'"),ProductCatalogData.class);
        assertEquals("24 cartons of 200ml",catalog.specification().get("ja-JP"));assertEquals(Long.valueOf(-310001L),catalog.reviewedBy());assertNotNull(catalog.reviewedAt());
        var media=JSON.readValue(scalar("SELECT media_gallery::text FROM bb_product WHERE id='ci-item-publication-product'"),MediaGalleryItem[].class);
        assertEquals(1,media.length);assertEquals(MediaType.IMAGE,media[0].getType());assertTrue(media[0].isVisible());
        assertEquals("https://example.invalid/legacy-carton.jpg",media[0].getUrl());
        oldColumns=columns();beforeRows=fingerprints(oldColumns);beforeHistory=history();assertEquals(38,oldColumns.size());
        assertTrue(beforeHistory.get(beforeHistory.size()-1).contains(":28:V28__checkout_delivery_snapshot.sql:"));
        assertTrue(beforeHistory.stream().allMatch(value->value.endsWith(":true")));
        var target=Flyway.configure().dataSource(URL,"bobbuy","bobbuypassword").locations("filesystem:"+migrations).target("31").load();
        target.migrate();target.validate();
    }
    @AfterAll static void close() throws Exception {
        if(connection==null)return;
        try{
            if(!fixtureCommitted)return; // Failed setup never authorizes deletion of an unknown identity.
            isolatedCiArguments();actualPostgres(connection);connection.setAutoCommit(false);
            try{
                // Verify exact owned identity and cardinality before the first delete.
                assertEquals("1",scalar("SELECT count(*) FROM bb_user WHERE id=-310001 AND username='ci-item-publication' AND name='Synthetic publication merchant' AND roles='[\"AGENT\"]'::jsonb"));
                assertEquals("1",scalar("SELECT count(*) FROM bb_product WHERE merchant_id=-310001"));
                assertEquals("1",scalar("SELECT count(*) FROM bb_product WHERE id='ci-item-publication-product' AND merchant_id=-310001 AND item_number='47506'"));
                assertEquals("2",scalar("SELECT count(*) FROM bb_recommendation_post WHERE merchant_id=-310001"));
                assertEquals("2",scalar("SELECT count(*) FROM bb_recommendation_post WHERE merchant_id=-310001 AND ((id=-310001 AND published AND publisher_id=-310001 AND published_at IS NOT NULL) OR (id=-310002 AND NOT published))"));
                assertEquals("3",scalar("SELECT count(*) FROM bb_recommendation_item WHERE post_id IN (-310001,-310002)"));
                assertEquals("3",scalar("SELECT count(*) FROM bb_recommendation_item WHERE "
                    +"(id=-310001 AND post_id=-310001 AND product_id='ci-item-publication-product' AND name='Original source name' AND image_hash='"+"a".repeat(64)+"') OR "
                    +"(id=-310002 AND post_id=-310002 AND product_id='ci-item-publication-product' AND name='Pending 1731065' AND image_hash='"+"b".repeat(64)+"') OR "
                    +"(id=-310003 AND post_id=-310001 AND product_id IS NULL AND name='Unlinked legacy source' AND image_hash='"+"c".repeat(64)+"')"));
                assertEquals("0",scalar("SELECT count(*) FROM bb_recommendation_image WHERE merchant_id=-310001"));
                assertEquals("0",scalar("SELECT count(*) FROM bb_reference_quote_revision WHERE merchant_id=-310001"));
                assertEquals("0",scalar("SELECT count(*) FROM bb_recommendation_article_revision WHERE merchant_id=-310001"));
                deleteExpected("DELETE FROM bb_recommendation_item WHERE id IN (-310001,-310002,-310003) AND post_id IN (-310001,-310002)",3);
                deleteExpected("DELETE FROM bb_recommendation_post WHERE id IN (-310001,-310002) AND merchant_id=-310001",2);
                deleteExpected("DELETE FROM bb_product WHERE id='ci-item-publication-product' AND merchant_id=-310001",1);
                deleteExpected("DELETE FROM bb_user WHERE id=-310001 AND username='ci-item-publication'",1);
                connection.commit();fixtureCommitted=false;
            }finally{
                // An unknown dependent FK, identity mismatch or row-count mismatch aborts all cleanup.
                if(fixtureCommitted)connection.rollback();
                connection.setAutoCommit(true);
            }
        }finally{connection.close();}
    }
    static void deleteExpected(String statement,int count) throws Exception {
        try(var command=connection.createStatement()){assertEquals(count,command.executeUpdate(statement));}
    }
    static void execute(String statement) throws Exception {try(var command=connection.createStatement()){command.execute(statement);}}
    static String scalar(String statement) throws Exception {try(var command=connection.createStatement();var result=command.executeQuery(statement)){assertTrue(result.next());return result.getString(1);}}
    static List<String> history() throws Exception {
        var rows=new ArrayList<String>();try(var command=connection.createStatement();var result=command.executeQuery("SELECT installed_rank||':'||version||':'||script||':'||checksum||':'||success FROM flyway_schema_history ORDER BY installed_rank")){while(result.next())rows.add(result.getString(1));}return rows;
    }
    static Map<String,List<String>> columns() throws Exception {
        var result=new TreeMap<String,List<String>>();try(var command=connection.createStatement();var rows=command.executeQuery("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name<>'flyway_schema_history' ORDER BY table_name,ordinal_position")){while(rows.next())result.computeIfAbsent(rows.getString(1),key->new ArrayList<>()).add(rows.getString(2));}return result;
    }
    static Map<String,String> fingerprints(Map<String,List<String>> shape) throws Exception {
        var values=new TreeMap<String,String>();for(var entry:shape.entrySet()){
            var identifiers=new ArrayList<String>();identifiers.add(entry.getKey());identifiers.addAll(entry.getValue());assertTrue(identifiers.stream().allMatch(id->id.matches("[a-z0-9_]+")));
            String projection=entry.getValue().stream().map(name->"\""+name+"\"").collect(java.util.stream.Collectors.joining(","));
            values.put(entry.getKey(),scalar("SELECT count(*)::text||':'||md5(coalesce(string_agg(row_data,'' ORDER BY row_data),'')) FROM (SELECT row_to_json(r)::text row_data FROM (SELECT "+projection+" FROM \""+entry.getKey()+"\") r) s"));
        }return values;
    }
    @Test void migrationPreservesEveryOldColumnSourceOfferAssetHistoryAndPriorFlywayPrefix() throws Exception {
        assertEquals(beforeRows,fingerprints(oldColumns));var after=history();assertEquals(beforeHistory,after.subList(0,beforeHistory.size()));assertTrue(after.get(after.size()-1).contains(":31:V31__recommendation_item_publication.sql:"));assertTrue(after.stream().allMatch(value->value.endsWith(":true")));
        var afterColumns=columns();assertEquals(oldColumns.keySet(),afterColumns.keySet());
        for(var table:oldColumns.keySet()){
            var old=oldColumns.get(table);var current=afterColumns.get(table);
            if(!table.equals("bb_recommendation_item"))assertEquals(old,current);
            else{
                assertEquals(old,current.subList(0,old.size()));
                assertEquals(8,current.size()-old.size());
                assertEquals(Set.of("publication_state","publication_snapshot","published_at","published_by",
                    "publication_request_id","publication_request_hash","linked_product_version","addition_payload_hash"),
                    new HashSet<>(current.subList(old.size(),current.size())));
            }
        }
        assertEquals("PUBLISHED",scalar("SELECT publication_state FROM bb_recommendation_item WHERE id=-310001"));
        assertEquals("PENDING",scalar("SELECT publication_state FROM bb_recommendation_item WHERE id=-310002"));
        assertEquals("1",scalar("SELECT count(*) FROM bb_recommendation_item WHERE id=-310002 AND publication_snapshot IS NULL AND published_at IS NULL AND published_by IS NULL AND publication_request_id IS NULL AND publication_request_hash IS NULL"));
        assertEquals("PUBLISHED",scalar("SELECT publication_state FROM bb_recommendation_item WHERE id=-310003"));
        var text=scalar("SELECT publication_snapshot::text FROM bb_recommendation_item WHERE id=-310001");
        var snapshot=JSON.readValue(text,RecommendationPublicationSnapshot.class);assertTrue(snapshot.legacy());assertNull(snapshot.productVersion());assertNull(snapshot.productSourceHash());assertNull(snapshot.reviewHash());assertNull(snapshot.catalog());
        var identity=new RecommendationItem();identity.id=-310001L;identity.postId=-310001L;identity.productId="ci-item-publication-product";identity.publicationState="PUBLISHED";identity.publicationSnapshot=snapshot;
        var displayed=RecommendationPublication.project(identity,snapshot);assertEquals("Original source name",displayed.name);assertEquals("Original bottle wording",displayed.specification);assertEquals("Original bottle wording",snapshot.specification());assertTrue(displayed.publicationLegacy);assertNull(displayed.publicationProductVersion);
        assertEquals(text,scalar("SELECT publication_snapshot::text FROM bb_recommendation_item WHERE id=-310001"));
        // Emit actual pre-cleanup PG preservation facts, not full-suite/recovery acceptance.
        var proof=new LinkedHashMap<String,Object>();
        proof.put("scope","EXISTING_EPHEMERAL_HOSTED_CI_POSTGRES_ONLY");
        proof.put("status","PASS_PRESERVATION_ASSERTIONS_ONLY");
        proof.put("schemaBefore",28);proof.put("schemaAfter",31);proof.put("businessTables",oldColumns.size());
        proof.put("beforeColumns",oldColumns);proof.put("afterColumns",afterColumns);
        proof.put("beforeFingerprints",beforeRows);proof.put("afterFingerprints",fingerprints(oldColumns));
        proof.put("priorMigrationHistory",beforeHistory);proof.put("migrationHistory",after);
        proof.put("allOldColumnsAndValuesPreserved",true);proof.put("syntheticDataStillPresentAtCapture",true);
        proof.put("legacyMasterBinding","UNKNOWN_NO_CURRENT_MASTER_FALLBACK");
        proof.put("testClassAcceptance","REQUIRE_SUREFIRE_TWO_METHODS_ZERO_FAILURE_ERROR_SKIP");
        proof.put("packagedJarRecoveryAcceptance","NOT_RUN");
        var output=Path.of("target/item-publication-upgrade-preservation.json");
        if(Files.isDirectory(Path.of("backend/target")))output=Path.of("backend/target/item-publication-upgrade-preservation.json");
        Files.createDirectories(output.getParent());Files.writeString(output,JSON.writerWithDefaultPrettyPrinter().writeValueAsString(proof)+"\n");
    }
    @Test void unknownPublicationShapeCannotPassSqlNullCheckOrBeInferredAsPublished() throws Exception {
        var pendingBefore=scalar("SELECT row_to_json(i)::text FROM bb_recommendation_item i WHERE id=-310002");
        connection.setAutoCommit(false);try{
            assertThrows(SQLException.class,()->execute("UPDATE bb_recommendation_item SET publication_state='PUBLISHED',publication_snapshot='{}',published_at=current_timestamp,published_by=-310001 WHERE id=-310002"));
        }finally{connection.rollback();connection.setAutoCommit(true);}
        assertEquals("PENDING",scalar("SELECT publication_state FROM bb_recommendation_item WHERE id=-310002"));
        assertEquals(pendingBefore,scalar("SELECT row_to_json(i)::text FROM bb_recommendation_item i WHERE id=-310002"));
    }
}
