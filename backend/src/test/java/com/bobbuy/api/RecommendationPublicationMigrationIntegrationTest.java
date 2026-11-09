package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.service.ProductCatalogProjection;
import com.bobbuy.service.ProductCatalogService;
import com.bobbuy.service.RecommendationPublication;
import com.fasterxml.jackson.core.type.TypeReference;
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
    static RecommendationItem visibleAtV31Cutover;
    static RecommendationItem sourceAtV31Cutover;
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
            +"INSERT INTO bb_product(id,merchant_id,item_number,name,description,brand,record_version,catalog_data,media_gallery,visibility_status) VALUES "
            +"('ci-item-publication-product',-310001,'47506','{\"ja-JP\":\"Synthetic canonical carton\"}'::jsonb,'{}'::jsonb,'Cutover visible brand',2,"
            +"'{\"specification\":{\"ja-JP\":\"24 cartons of 200ml\"},\"categoryIds\":[],\"reviewedBy\":-310001,\"reviewedAt\":\"2026-01-01T00:00:00Z\"}'::jsonb,"
            +"'[{\"url\":\"https://example.invalid/legacy-carton.jpg\",\"type\":\"IMAGE\",\"visible\":true}]'::jsonb,'DRAFTER_ONLY');"
            +"INSERT INTO bb_recommendation_post(id,merchant_id,title,body,published,published_at,publisher_id,publisher_name) VALUES "
            +"(-310001,-310001,'Synthetic legacy public','Original article',true,'2026-01-01T00:00:00Z',-310001,'Synthetic merchant'),"
            +"(-310002,-310001,'Synthetic private draft','Never publish automatically',false,NULL,NULL,NULL);"
            +"INSERT INTO bb_recommendation_item(id,post_id,product_id,name,item_number,specification,reference_price,image_hash,image_url) VALUES "
            +"(-310001,-310001,'ci-item-publication-product','Original source name','47506','Original bottle wording',123,'"+"a".repeat(64)+"','https://example.invalid/original-promo.jpg'),"
            +"(-310002,-310002,'ci-item-publication-product','Pending 1731065','1731065','Incomplete source',NULL,'"+"b".repeat(64)+"','https://example.invalid/pending.jpg'),"
            +"(-310003,-310001,NULL,'Unlinked legacy source',NULL,NULL,NULL,'"+"c".repeat(64)+"','https://example.invalid/unlinked.jpg');");
            execute("UPDATE bb_recommendation_item SET original_price=150,discount_amount=27,price_unit='JPY per original pack',"
                +"offer_start='2026-01-01',offer_end='2026-01-31',coupon_start='2026-01-02',coupon_end='2026-01-10',"
                +"offer_notes='Original tax-included price; original membership condition',"
                +"reference_context='{\"supplierKey\":\"COSTCO\",\"channel\":\"COSTCO_WAREHOUSE\",\"variantKey\":\"200mlx24\","
                +"\"sourceMessageKey\":\"synthetic-original\",\"sourceUrl\":\"https://example.invalid/original-terms\","
                +"\"activityStart\":\"2026-01-01\",\"activityEnd\":\"2026-01-31\",\"activityApplies\":true,"
                +"\"windowEvidence\":\"Original terms apply\",\"startSearchComplete\":true}'::jsonb WHERE id=-310001");
            connection.commit();fixtureCommitted=true;
        }catch(Exception error){connection.rollback();throw error;}
        finally{connection.setAutoCommit(true);}
        assertEquals(Set.of(Role.AGENT),Set.of(JSON.readValue(scalar("SELECT roles::text FROM bb_user WHERE id=-310001"),Role[].class)));
        var catalog=JSON.readValue(scalar("SELECT catalog_data::text FROM bb_product WHERE id='ci-item-publication-product'"),ProductCatalogData.class);
        assertEquals("24 cartons of 200ml",catalog.specification().get("ja-JP"));assertEquals(Long.valueOf(-310001L),catalog.reviewedBy());assertNotNull(catalog.reviewedAt());
        var media=JSON.readValue(scalar("SELECT media_gallery::text FROM bb_product WHERE id='ci-item-publication-product'"),MediaGalleryItem[].class);
        assertEquals(1,media.length);assertEquals(MediaType.IMAGE,media[0].getType());assertTrue(media[0].isVisible());
        assertEquals("https://example.invalid/legacy-carton.jpg",media[0].getUrl());
        // The fixed82 projection statements for these fields are source-bound in the
        // cutover evidence. Its sole reviewed-translation cache difference is not exercised.
        var master=storedMaster();assertNotNull(master.getCatalogData());
        assertEquals(Long.valueOf(-310001L),master.getMerchantId());assertNull(master.getDeletedAt());
        assertFalse(ProductCatalogService.translationsCurrent(master));
        sourceAtV31Cutover=storedSource(-310001L);
        assertTrue(sourceAtV31Cutover.translations.isEmpty());
        visibleAtV31Cutover=storedSource(-310001L);
        ProductCatalogProjection.apply(visibleAtV31Cutover,sourceAtV31Cutover,master);
        assertEquals("Synthetic canonical carton",visibleAtV31Cutover.name);
        assertEquals("24 cartons of 200ml",visibleAtV31Cutover.specification);
        assertEquals("Cutover visible brand",visibleAtV31Cutover.brand);
        assertEquals(List.of("https://example.invalid/legacy-carton.jpg"),visibleAtV31Cutover.gallery.stream().map(RecommendationItem.Picture::url).toList());
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
    static Product storedMaster() throws Exception {
        try(var statement=connection.prepareStatement("SELECT id,merchant_id,item_number,name::text,description::text,brand,record_version,catalog_data::text,media_gallery::text,deleted_at FROM bb_product WHERE id='ci-item-publication-product'");
            var row=statement.executeQuery()){
            assertTrue(row.next());var product=new Product();product.setId(row.getString(1));product.setMerchantId(row.getLong(2));product.setItemNumber(row.getString(3));
            product.setName(JSON.readValue(row.getString(4),new TypeReference<Map<String,String>>(){}));
            product.setDescription(JSON.readValue(row.getString(5),new TypeReference<Map<String,String>>(){}));
            product.setBrand(row.getString(6));product.setRecordVersion(row.getLong(7));
            product.setCatalogData(JSON.readValue(row.getString(8),ProductCatalogData.class));
            product.setMediaGallery(new ArrayList<>(Arrays.asList(JSON.readValue(row.getString(9),MediaGalleryItem[].class))));
            assertNull(row.getObject(10));return product;
        }
    }
    static RecommendationItem storedSource(long id) throws Exception {
        try(var statement=connection.prepareStatement("SELECT id,post_id,product_id,name,item_number,specification,description,"
            +"reference_price,original_price,discount_amount,price_unit,offer_start,offer_end,coupon_start,coupon_end,"
            +"offer_notes,reference_context::text,gallery::text,image_hash,image_url FROM bb_recommendation_item WHERE id=?")){
            statement.setLong(1,id);try(var row=statement.executeQuery()){
                assertTrue(row.next());var item=new RecommendationItem();item.id=row.getLong(1);item.postId=row.getLong(2);item.productId=row.getString(3);
                item.name=row.getString(4);item.itemNumber=row.getString(5);item.specification=row.getString(6);item.description=row.getString(7);
                item.referencePrice=row.getBigDecimal(8);item.originalPrice=row.getBigDecimal(9);item.discountAmount=row.getBigDecimal(10);item.priceUnit=row.getString(11);
                item.offerStart=row.getObject(12,java.time.LocalDate.class);item.offerEnd=row.getObject(13,java.time.LocalDate.class);
                item.couponStart=row.getObject(14,java.time.LocalDate.class);item.couponEnd=row.getObject(15,java.time.LocalDate.class);item.offerNotes=row.getString(16);
                String context=row.getString(17);item.referenceContext=context==null?null:JSON.readValue(context,ReferenceOfferContext.class);
                item.gallery=new ArrayList<>(Arrays.asList(JSON.readValue(row.getString(18),RecommendationItem.Picture[].class)));
                item.imageHash=row.getString(19);item.imageUrl=row.getString(20);return item;
            }
        }
    }
    static RecommendationItem migrated(long id) throws Exception {
        var item=storedSource(id);item.publicationState=scalar("SELECT publication_state FROM bb_recommendation_item WHERE id="+id);
        String snapshot=scalar("SELECT coalesce(publication_snapshot::text,'null') FROM bb_recommendation_item WHERE id="+id);
        item.publicationSnapshot=JSON.readValue(snapshot,RecommendationPublicationSnapshot.class);return item;
    }
    static void samePrice(java.math.BigDecimal expected,java.math.BigDecimal actual) {
        if(expected==null)assertNull(actual);else{assertNotNull(actual);assertEquals(0,expected.compareTo(actual));}
    }
    static void sourceFactsRetained(RecommendationItem source,RecommendationPublicationSnapshot snapshot) {
        assertEquals(source.name,snapshot.name());assertEquals(source.itemNumber,snapshot.itemNumber());
        assertEquals(source.specification,snapshot.specification());assertEquals(source.description,snapshot.description());
        samePrice(source.referencePrice,snapshot.referencePrice());samePrice(source.originalPrice,snapshot.originalPrice());samePrice(source.discountAmount,snapshot.discountAmount());
        assertEquals(source.priceUnit,snapshot.priceUnit());assertEquals(source.offerStart,snapshot.offerStart());assertEquals(source.offerEnd,snapshot.offerEnd());
        assertEquals(source.couponStart,snapshot.couponStart());assertEquals(source.couponEnd,snapshot.couponEnd());assertEquals(source.offerNotes,snapshot.offerNotes());
        assertEquals(source.referenceContext,snapshot.referenceContext());assertEquals(source.gallery,snapshot.gallery());
        assertEquals(source.imageHash,snapshot.imageHash());assertEquals(source.imageUrl,snapshot.imageUrl());
    }
    static void displayStillMatchesCutover(RecommendationItem shown) {
        assertEquals(visibleAtV31Cutover.name,shown.name);assertEquals(visibleAtV31Cutover.specification,shown.specification);
        assertEquals(visibleAtV31Cutover.brand,shown.brand);assertEquals(visibleAtV31Cutover.gallery,shown.gallery);
        samePrice(sourceAtV31Cutover.referencePrice,shown.referencePrice);samePrice(sourceAtV31Cutover.originalPrice,shown.originalPrice);
        samePrice(sourceAtV31Cutover.discountAmount,shown.discountAmount);assertEquals(sourceAtV31Cutover.priceUnit,shown.priceUnit);
        assertEquals(sourceAtV31Cutover.referenceContext,shown.referenceContext);assertEquals(sourceAtV31Cutover.offerNotes,shown.offerNotes);
        assertEquals(sourceAtV31Cutover.offerStart,shown.offerStart);assertEquals(sourceAtV31Cutover.offerEnd,shown.offerEnd);
        assertEquals(sourceAtV31Cutover.couponStart,shown.couponStart);assertEquals(sourceAtV31Cutover.couponEnd,shown.couponEnd);
        assertEquals(sourceAtV31Cutover.imageHash,shown.imageHash);assertEquals(sourceAtV31Cutover.imageUrl,shown.imageUrl);
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
        var snapshot=JSON.readValue(text,RecommendationPublicationSnapshot.class);assertTrue(snapshot.legacy());assertNull(snapshot.productVersion());assertNull(snapshot.productSourceHash());assertNull(snapshot.reviewHash());assertNotNull(snapshot.catalog());
        assertEquals(Long.valueOf(2),snapshot.legacyDisplayProductVersion());assertEquals("VISIBLE_AT_V31_CUTOVER",snapshot.legacyDisplayProvenance());
        sourceFactsRetained(sourceAtV31Cutover,snapshot);
        var catalogJson=JSON.valueToTree(snapshot.catalog());assertFalse(catalogJson.has("basePrice"));assertFalse(catalogJson.has("sale"));assertFalse(catalogJson.has("stock"));
        var identity=new RecommendationItem();identity.id=-310001L;identity.postId=-310001L;identity.productId="ci-item-publication-product";identity.publicationState="PUBLISHED";identity.publicationSnapshot=snapshot;
        var displayed=RecommendationPublication.project(identity,snapshot);displayStillMatchesCutover(displayed);assertEquals("24 cartons of 200ml",displayed.specification);assertEquals("Original bottle wording",snapshot.specification());assertTrue(displayed.publicationLegacy);assertNull(displayed.publicationProductVersion);
        var unlinked=migrated(-310003L).publicationSnapshot;assertNull(unlinked.catalog());assertNull(unlinked.legacyDisplayProductVersion());assertNull(unlinked.legacyDisplayProvenance());
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
        proof.put("legacyMasterBinding","UNKNOWN_ORIGINAL_REVIEW_BINDING_WITH_EXPLICIT_VISIBLE_AT_V31_CUTOVER_DISPLAY");
        proof.put("legacyDisplayProductVersion",snapshot.legacyDisplayProductVersion());proof.put("legacyDisplayProvenance",snapshot.legacyDisplayProvenance());
        proof.put("preV31VisibleName",visibleAtV31Cutover.name);proof.put("preV31VisibleSpecification",visibleAtV31Cutover.specification);
        proof.put("preV31VisibleBrand",visibleAtV31Cutover.brand);proof.put("preV31VisibleGallery",visibleAtV31Cutover.gallery);
        proof.put("testClassAcceptance","REQUIRE_SUREFIRE_THREE_METHODS_ZERO_FAILURE_ERROR_SKIP");
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
    @Test void laterRecipeAndPendingCandidateCannotRewriteCutoverPublicDisplay() throws Exception {
        String oldSnapshot=scalar("SELECT publication_snapshot::text FROM bb_recommendation_item WHERE id=-310001");
        String oldProduct=scalar("SELECT row_to_json(p)::text FROM bb_product p WHERE id='ci-item-publication-product'");
        connection.setAutoCommit(false);
        try{
            execute("UPDATE bb_product SET record_version=3,name='{\"ja-JP\":\"Later v3 recipe\"}'::jsonb,brand='Later private brand',base_price=999,"
                +"catalog_data='{\"specification\":{\"ja-JP\":\"New v3 recipe must stay private\"},\"categoryIds\":[],\"reviewedBy\":-310001,\"reviewedAt\":\"2026-02-01T00:00:00Z\"}'::jsonb,"
                +"media_gallery='[{\"url\":\"https://example.invalid/private-v3-recipe.jpg\",\"type\":\"IMAGE\",\"visible\":true}]'::jsonb WHERE id='ci-item-publication-product';"
                +"INSERT INTO bb_recommendation_item(id,post_id,product_id,name,item_number,specification,reference_price,image_hash,image_url) VALUES"
                +"(-310004,-310001,'ci-item-publication-product','New pending v3 recipe','47506','New v3 recipe must stay private',999,'"+"d".repeat(64)+"','https://example.invalid/private-v3-offer.jpg');");
            var pending=migrated(-310004L);assertEquals("PENDING",pending.publicationState);assertNull(pending.publicationSnapshot);
            var candidate=RecommendationPublication.candidate(pending,storedMaster());
            assertEquals(Long.valueOf(3),candidate.productVersion());assertEquals("New v3 recipe must stay private",candidate.catalog().catalogData().specification().get("ja-JP"));
            assertFalse(RecommendationPublication.visible(pending));
            var visible=new ArrayList<RecommendationItem>();
            try(var query=connection.prepareStatement("SELECT id FROM bb_recommendation_item WHERE post_id=-310001 ORDER BY id");var rows=query.executeQuery()){
                while(rows.next()){var original=migrated(rows.getLong(1));if(RecommendationPublication.visible(original))visible.add(RecommendationPublication.project(original,original.publicationSnapshot));}
            }
            assertEquals(Set.of(-310001L,-310003L),new HashSet<>(visible.stream().map(item->item.id).toList()));
            var old=visible.stream().filter(item->item.id.equals(-310001L)).findFirst().orElseThrow();
            displayStillMatchesCutover(old);assertEquals("24 cartons of 200ml",old.specification);
            assertEquals("https://example.invalid/legacy-carton.jpg",old.gallery.get(0).url());
            assertTrue(visible.stream().noneMatch(item->item.name.contains("v3")||item.gallery.stream().anyMatch(image->image.url().contains("v3"))));
            assertEquals(oldSnapshot,scalar("SELECT publication_snapshot::text FROM bb_recommendation_item WHERE id=-310001"));
            sourceFactsRetained(sourceAtV31Cutover,migrated(-310001L).publicationSnapshot);
            assertEquals("PENDING",scalar("SELECT publication_state FROM bb_recommendation_item WHERE id=-310004"));
        }finally{connection.rollback();connection.setAutoCommit(true);}
        assertEquals(oldProduct,scalar("SELECT row_to_json(p)::text FROM bb_product p WHERE id='ci-item-publication-product'"));
        assertEquals(oldSnapshot,scalar("SELECT publication_snapshot::text FROM bb_recommendation_item WHERE id=-310001"));
        assertEquals("0",scalar("SELECT count(*) FROM bb_recommendation_item WHERE id=-310004"));
        assertEquals(beforeRows,fingerprints(oldColumns));
    }
}
