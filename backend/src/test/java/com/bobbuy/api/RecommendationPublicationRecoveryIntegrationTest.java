package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.service.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.*;
import javax.imageio.ImageIO;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.transaction.AfterTransaction;
import org.springframework.test.context.transaction.TestTransaction;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A restored V31-aware application's real HTTP/PG disclosure contract.
 * This does not boot an archived JAR and does not claim old-core runtime coverage.
 * Run sequentially after V31 schema preparation in the existing ephemeral CI PG.
 * Every synthetic row belongs to this method's random merchant and is rolled back.
 */
@EnabledIfEnvironmentVariable(named="BOBBUY_ISOLATED_CI_POSTGRES",matches="true")
@SpringBootTest(properties={
    "bobbuy.security.header-auth.enabled=false",
    "bobbuy.seed.enabled=false",
    "spring.flyway.enabled=false",
    "spring.jpa.hibernate.ddl-auto=validate"
})
@AutoConfigureMockMvc
@Transactional(isolation=Isolation.REPEATABLE_READ)
@Rollback
@Execution(ExecutionMode.SAME_THREAD)
class RecommendationPublicationRecoveryIntegrationTest {
    static final String URL="jdbc:postgresql://127.0.0.1:5432/bobbuy";
    static final Instant TIME=Instant.parse("2026-01-01T00:00:00Z");
    static final LocalDateTime LOCAL_TIME=LocalDateTime.parse("2026-01-01T00:00:00");
    static final BigDecimal OLD_PRICE=new BigDecimal("123.45");
    static final String OLD_SPEC="Original unmodified source specification";
    static final String OLD_BODY="Original public article, price conditions and wording retained";
    @DynamicPropertySource static void isolatedDatasource(DynamicPropertyRegistry registry) {
        // Fail before Spring's first connection. No H2 or configurable-host fallback.
        if(!"true".equals(System.getenv("BOBBUY_ISOLATED_CI_POSTGRES"))
            ||!"true".equals(System.getenv("GITHUB_ACTIONS"))
            ||!"true".equals(System.getenv("CI"))
            ||!"postgres-migration-verify".equals(System.getenv("GITHUB_JOB"))
            ||!"workflow_dispatch".equals(System.getenv("GITHUB_EVENT_NAME"))
            ||!URL.equals(System.getProperty("spring.datasource.url"))
            ||!"bobbuy".equals(System.getProperty("spring.datasource.username"))
            ||!"org.postgresql.Driver".equals(System.getProperty("spring.datasource.driver-class-name")))
            throw new IllegalStateException("Recovery fixtures require the existing explicit isolated hosted CI PostgreSQL");
        registry.add("spring.datasource.url",()->URL);
        registry.add("spring.datasource.username",()->"bobbuy");
        registry.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
        registry.add("spring.flyway.enabled",()->false);
        registry.add("spring.jpa.hibernate.ddl-auto",()->"validate");
        registry.add("bobbuy.seed.enabled",()->false);
        registry.add("bobbuy.media.prefer-object",()->false);
        registry.add("bobbuy.media.object-only-writes",()->false);
        // Password remains the existing ephemeral CI datasource argument; never read/log it.
    }
    @Autowired EntityManager em;
    @Autowired EntityManagerFactory emf;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired RecommendationTaxonomyService taxonomy;
    @MockBean JavaMailSender mail;
    long merchant;
    String nonce,pendingMarker,privateMaster;
    RecommendationPost mixed,pendingOnly;
    RecommendationImage publicImage,pendingImage;
    final Set<Long> visiblePosts=new HashSet<>();
    final Set<Long> visibleMixedItems=new HashSet<>();
    final Set<String> visibleProducts=new HashSet<>();
    final Set<String> hiddenProducts=new HashSet<>();
    final Set<Long> allItemIds=new HashSet<>();
    Map<String,List<String>> beforeReads;

    @BeforeEach void ownRollbackFixture() throws Exception {
        SecurityContextHolder.clearContext();
        assertTrue(TestTransaction.isActive(),"Fixture writes require the test rollback transaction");
        assertTrue(TestTransaction.isFlaggedForRollback(),"No synthetic fixture may be committed");
        em.unwrap(Session.class).doWork(this::assertActualIsolatedPg);
        assertEquals(1,jdbc.queryForObject(
            "SELECT count(*) FROM flyway_schema_history WHERE version='31' AND success",Integer.class),
            "V31 must already be prepared; this test never migrates/cleans a database");
        assertEquals(2,jdbc.queryForObject(
            "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' "
                +"AND table_name='bb_recommendation_item' AND column_name IN ('publication_state','publication_snapshot')",
            Integer.class));
        nonce=UUID.randomUUID().toString();
        pendingMarker="NEVER-PUBLIC-"+nonce;
        privateMaster="PRIVATE-MASTER-"+nonce;
        do {merchant=1_000_000_000L+(UUID.randomUUID().getMostSignificantBits()&0x3fffffffL);}
        while(em.find(User.class,merchant)!=null);
        var user=new User(merchant,"Synthetic recovery merchant",Role.AGENT,0);
        user.setUsername("publication-recovery-"+nonce);em.persist(user);
        publicImage=image(0x006699);
        pendingImage=image(0x990066);
        mixed=post("Original public issue",0);
        // Pending sorts first by generated item id: a filter applied after limit/cover would fail.
        item(mixed,0,false);
        for(int i=1;i<=25;i++)item(mixed,i,true);
        // 21 visible posts exercise the real 20-item feed/directory page boundary.
        for(int i=1;i<=20;i++)item(post("Original public issue "+i,i),25+i,true);
        pendingOnly=post("Pending-only issue must not consume a page",100);
        item(pendingOnly,100,false);
        em.flush();
        assertEquals(47,jdbc.queryForObject("SELECT count(*) FROM bb_recommendation_item i "
            +"JOIN bb_recommendation_post p ON p.id=i.post_id WHERE p.merchant_id=?",Integer.class,merchant));
        assertEquals(2,jdbc.queryForObject("SELECT count(*) FROM bb_recommendation_item i "
            +"JOIN bb_recommendation_post p ON p.id=i.post_id "
            +"WHERE p.merchant_id=? AND i.publication_state='PENDING'",Integer.class,merchant));
        beforeReads=ownRows();
    }
    void assertActualIsolatedPg(Connection connection) throws java.sql.SQLException {
        var metadata=connection.getMetaData();
        assertEquals("PostgreSQL",metadata.getDatabaseProductName());
        assertEquals(URL,metadata.getURL());
        assertEquals("bobbuy",metadata.getUserName());
        assertEquals("bobbuy",connection.getCatalog());
        assertFalse(connection.getAutoCommit(),"No fixture may commit outside the test transaction");
    }
    @AfterEach void clearAuthentication() {SecurityContextHolder.clearContext();}
    @AfterTransaction void syntheticRowsWereRolledBack() {
        if(merchant==0)return; // Setup may have failed before choosing an owned synthetic identity.
        for(String table:List.of("bb_user","bb_product","bb_recommendation_post","bb_recommendation_image")){
            String owner=table.equals("bb_user")?"id":"merchant_id";
            assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM "+table+" WHERE "+owner+"=?",
                Integer.class,merchant),"Rollback must remove only this method's synthetic "+table+" rows");
        }
        if(!allItemIds.isEmpty()){
            String placeholders=String.join(",",Collections.nCopies(allItemIds.size(),"?"));
            assertEquals(0,jdbc.queryForObject("SELECT count(*) FROM bb_recommendation_item WHERE id IN ("+placeholders+")",
                Integer.class,allItemIds.toArray()),"Visible and pending associations must both roll back");
        }
    }
    RecommendationImage image(int color) throws Exception {
        var bitmap=new BufferedImage(2,2,BufferedImage.TYPE_INT_RGB);bitmap.setRGB(0,0,color);
        var bytes=new ByteArrayOutputStream();assertTrue(ImageIO.write(bitmap,"png",bytes));
        var checked=RecommendationImageValidator.validate(bytes.toByteArray());
        var image=new RecommendationImage();
        image.id=UUID.randomUUID().toString();image.merchantId=merchant;image.imageHash=checked.hash();
        image.contentType=checked.contentType();image.content=checked.content();image.accessScope="PUBLIC";
        em.persist(image);return image;
    }
    RecommendationPost post(String title,int offset) {
        var post=new RecommendationPost();
        post.merchantId=merchant;post.title=title+" "+nonce;post.body=OLD_BODY;
        post.articleSourceLocale="ja-JP";post.published=true;post.publishedAt=TIME.plusSeconds(offset);
        post.publisherId=merchant;post.publisherName="Synthetic recovery merchant";
        post.issueDate=LocalDate.of(2026,1,1).plusDays(offset);post.issueDateSourceRef="synthetic:reviewed-date-"+offset;
        post.issueDateSourceHash="d".repeat(64);post.issueDateReviewedBy=merchant;post.issueDateReviewedAt=TIME;
        post.createdAt=LOCAL_TIME;post.updatedAt=LOCAL_TIME;em.persist(post);return post;
    }
    void item(RecommendationPost post,int sequence,boolean published) {
        var product=new Product();product.setId(UUID.randomUUID().toString());product.setMerchantId(merchant);
        product.setName(new HashMap<>(Map.of("ja-JP",privateMaster+" "+sequence)));
        product.setDescription(new HashMap<>(Map.of("ja-JP",privateMaster)));
        product.setItemNumber("recovery-"+sequence+"-"+nonce);
        product.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);
        product.setUpdatedAt(LOCAL_TIME);em.persist(product);
        var image=published?publicImage:pendingImage;
        var item=new RecommendationItem();
        item.postId=post.id;item.productId=product.getId();
        item.name=published?"Original public item "+sequence:pendingMarker;
        item.itemNumber=product.getItemNumber();item.specification=published?OLD_SPEC:pendingMarker;
        item.description=published?"Original public description":pendingMarker;
        item.referencePrice=published?OLD_PRICE:new BigDecimal("98765.43");
        item.originalPrice=published?new BigDecimal("150.00"):null;
        item.discountAmount=published?new BigDecimal("26.55"):null;
        item.priceUnit="per original pack";item.offerNotes="Original source conditions retained";
        item.imageHash=image.imageHash;item.imageUrl=imageUrl(image);
        item.gallery=new ArrayList<>(List.of(new RecommendationItem.Picture(
            image.id,imageUrl(image),image.imageHash,"https://example.invalid/source-"+image.id+".png",
            imageUrl(image),"Original source image",TIME)));
        item.createdAt=LOCAL_TIME;
        if(published) {
            item.publicationState="PUBLISHED";item.publishedAt=TIME;item.publishedBy=merchant;
            // The migration's legacy shape: no new master metadata or fabricated review proof.
            item.publicationSnapshot=new RecommendationPublicationSnapshot(
                1,true,null,null,null,item.name,item.itemNumber,item.specification,item.description,
                Map.of(),null,item.referencePrice,item.originalPrice,item.discountAmount,item.priceUnit,
                null,null,null,null,item.offerNotes,null,List.copyOf(item.gallery),
                List.of(),null,false,item.imageHash,item.imageUrl,null,null,null,null);
        }
        em.persist(item);
        allItemIds.add(item.id);
        if(published) {
            visiblePosts.add(post.id);visibleProducts.add(product.getId());
            if(post.id.equals(mixed.id))visibleMixedItems.add(item.id);
        } else hiddenProducts.add(product.getId());
    }
    String imageUrl(RecommendationImage image) {return "/api/storefront/recommendation-images/"+image.id;}
    JsonNode data(MockHttpServletRequestBuilder request,MockHttpSession session) throws Exception {
        var response=mvc.perform(request.param("merchantId",Long.toString(merchant)).session(session))
            .andExpect(status().isOk()).andReturn().getResponse();
        var body=json.readTree(response.getContentAsString());
        JsonNode data=body.path("data");assertFalse(data.isMissingNode());
        String disclosed=data.toString();
        assertFalse(disclosed.contains(pendingMarker),"Pending source leaked through public HTTP");
        assertFalse(disclosed.contains(privateMaster),"Private live master replaced retained public source");
        assertFalse(disclosed.contains(pendingImage.id),"Pending image/cover association leaked");
        for(var id:hiddenProducts)assertFalse(disclosed.contains(id),"Pending-only product association leaked");
        return data;
    }
    void retainedItem(JsonNode item) {
        assertTrue(item.path("name").asText().startsWith("Original public item "));
        assertEquals(OLD_SPEC,item.path("specification").asText());
        assertEquals(0,OLD_PRICE.compareTo(item.path("referencePrice").decimalValue()));
        assertEquals("per original pack",item.path("priceUnit").asText());
        assertEquals("Original source conditions retained",item.path("offerNotes").asText());
        assertEquals(imageUrl(publicImage),item.at("/gallery/0/url").asText());
    }
    Set<Long> postIds(JsonNode details) {
        var ids=new HashSet<Long>();details.forEach(detail->assertTrue(ids.add(detail.at("/post/id").asLong())));
        return ids;
    }
    void publicMatrix(MockHttpSession session) throws Exception {
        var detail=data(get("/api/storefront/recommendations/"+mixed.id),session);
        assertEquals(OLD_BODY,detail.path("body").asText());
        assertEquals(25,detail.path("items").size());
        assertEquals(imageUrl(publicImage),detail.at("/post/coverImageUrl").asText());
        var ids=new HashSet<Long>();
        for(var item:detail.path("items")){retainedItem(item);assertTrue(ids.add(item.path("id").asLong()));}
        assertEquals(visibleMixedItems,ids);
        mvc.perform(get("/api/storefront/recommendations/"+pendingOnly.id)
            .param("merchantId",Long.toString(merchant)).session(session)).andExpect(status().isNotFound());

        var feed0=data(get("/api/storefront/recommendations").param("page","0"),session);
        var feed1=data(get("/api/storefront/recommendations").param("page","1"),session);
        assertEquals(20,feed0.size());assertEquals(1,feed1.size());
        var feedIds=postIds(feed0);assertTrue(Collections.disjoint(feedIds,postIds(feed1)));
        feedIds.addAll(postIds(feed1));assertEquals(visiblePosts,feedIds);
        for(var page:List.of(feed0,feed1))for(var row:page){
            assertEquals(OLD_BODY,row.path("body").asText());
            assertEquals(imageUrl(publicImage),row.at("/post/coverImageUrl").asText());
            for(var item:row.path("items"))retainedItem(item);
        }
        assertTrue(data(get("/api/storefront/recommendations").param("page","2"),session).isEmpty());

        var directory=data(get("/api/storefront/recommendation-browse/issues").param("period","all"),session);
        assertEquals(21,directory.path("total").asInt());assertEquals(20,directory.path("items").size());
        assertTrue(directory.path("hasNext").asBoolean());
        var directory1=data(get("/api/storefront/recommendation-browse/issues").param("period","all")
            .param("page","1").param("revision",directory.path("revision").asText()),session);
        assertEquals(1,directory1.path("items").size());assertFalse(directory1.path("hasNext").asBoolean());
        var directoryIds=postIds(directory.path("items"));
        assertTrue(Collections.disjoint(directoryIds,postIds(directory1.path("items"))));
        directoryIds.addAll(postIds(directory1.path("items")));assertEquals(visiblePosts,directoryIds);
        for(var page:List.of(directory,directory1))for(var row:page.path("items")){
            long id=row.at("/post/id").asLong();
            assertEquals(id==mixed.id?25:1,row.path("itemCount").asInt());
            assertEquals(id==mixed.id?25:1,row.path("publicItemCount").asInt());
            assertEquals("REVIEWED_SOURCE",row.path("issueDateSource").asText());
            assertEquals(row.path("issueDate").asText(),row.at("/post/issueDate").asText());
            assertEquals(imageUrl(publicImage),row.at("/post/coverImageUrl").asText());
        }
        var occurrences=data(get("/api/storefront/recommendation-browse/items")
            .param("period","all").param("issueId",mixed.id.toString()),session);
        assertEquals(25,occurrences.path("scopeTotal").asInt());assertEquals(25,occurrences.path("matchedTotal").asInt());
        assertEquals(25,occurrences.path("productOccurrences").asInt());assertEquals(24,occurrences.path("items").size());
        var occurrences1=data(get("/api/storefront/recommendation-browse/items").param("period","all")
            .param("issueId",mixed.id.toString()).param("page","1")
            .param("revision",occurrences.path("revision").asText()),session);
        assertEquals(1,occurrences1.path("items").size());assertFalse(occurrences1.path("hasNext").asBoolean());
        var occurrenceIds=new HashSet<Long>();
        for(var page:List.of(occurrences,occurrences1))for(var row:page.path("items")){
            assertTrue(occurrenceIds.add(row.at("/item/id").asLong()));
            assertEquals(imageUrl(publicImage),row.at("/item/image/url").asText());
            assertEquals(0,OLD_PRICE.compareTo(row.at("/item/referencePrice").decimalValue()));
        }
        assertEquals(visibleMixedItems,occurrenceIds);
        var searched=data(get("/api/storefront/recommendation-browse/items")
            .param("period","all").param("query",pendingMarker),session);
        assertEquals(0,searched.path("scopeTotal").asInt());assertTrue(searched.path("items").isEmpty());
        var searchedDirectory=data(get("/api/storefront/recommendation-browse/issues")
            .param("period","all").param("query",pendingMarker),session);
        assertEquals(0,searchedDirectory.path("total").asInt());

        var catalog0=data(get("/api/storefront/product-catalog"),session);
        var catalog1=data(get("/api/storefront/product-catalog").param("page","1"),session);
        assertEquals(45,catalog0.path("total").asInt());assertEquals(24,catalog0.path("items").size());
        assertEquals(21,catalog1.path("items").size());assertFalse(catalog1.path("hasNext").asBoolean());
        var catalogIds=new HashSet<String>();
        for(var page:List.of(catalog0,catalog1))for(var row:page.path("items")){
            assertTrue(catalogIds.add(row.path("productId").asText()));
            assertTrue(row.at("/name/ja-JP").asText().startsWith("Original public item "));
            assertEquals(OLD_SPEC,row.at("/specification/ja-JP").asText());
            assertEquals(imageUrl(publicImage),row.at("/gallery/0/url").asText());
            assertEquals(1,row.path("referenceOffers").size());retainedItem(row.at("/referenceOffers/0/facts"));
        }
        assertEquals(visibleProducts,catalogIds);
        var products0=data(get("/api/storefront/product-browse").param("locale","ja-JP"),session);
        assertEquals(45,products0.path("scopeTotal").asInt());assertEquals(45,products0.path("matchedTotal").asInt());
        assertEquals(24,products0.path("items").size());
        var products1=data(get("/api/storefront/product-browse").param("locale","ja-JP").param("page","1")
            .param("revision",products0.path("revision").asText()),session);
        assertEquals(21,products1.path("items").size());assertFalse(products1.path("hasNext").asBoolean());
        var browseIds=new HashSet<String>();
        for(var page:List.of(products0,products1))for(var row:page.path("items")){
            assertTrue(browseIds.add(row.path("productId").asText()));
            assertEquals(imageUrl(publicImage),row.at("/image/url").asText());
        }
        assertEquals(visibleProducts,browseIds);
        String publicProduct=visibleProducts.iterator().next();
        var productDetail=data(get("/api/storefront/product-browse/"+publicProduct),session);
        assertEquals(publicProduct,productDetail.at("/item/productId").asText());
        retainedItem(productDetail.at("/item/referenceOffers/0/facts"));
        for(var hidden:hiddenProducts)mvc.perform(get("/api/storefront/product-browse/"+hidden)
            .param("merchantId",Long.toString(merchant)).session(session)).andExpect(status().isNotFound());
        var searchedProducts=data(get("/api/storefront/product-browse").param("query",pendingMarker),session);
        assertEquals(0,searchedProducts.path("scopeTotal").asInt());
        var binary=mvc.perform(get(imageUrl(publicImage)).session(session)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsByteArray();
        assertArrayEquals(publicImage.content,binary,"Existing public image bytes must remain identical");
    }
    Map<String,List<String>> ownRows() {
        var rows=new TreeMap<String,List<String>>();
        rows.put("posts",jdbc.queryForList("SELECT row_to_json(r)::text FROM "
            +"(SELECT * FROM bb_recommendation_post WHERE merchant_id=? ORDER BY id) r",String.class,merchant));
        rows.put("items",jdbc.queryForList("SELECT row_to_json(r)::text FROM "
            +"(SELECT i.* FROM bb_recommendation_item i JOIN bb_recommendation_post p ON p.id=i.post_id "
            +"WHERE p.merchant_id=? ORDER BY i.id) r",String.class,merchant));
        rows.put("products",jdbc.queryForList("SELECT row_to_json(r)::text FROM "
            +"(SELECT * FROM bb_product WHERE merchant_id=? ORDER BY id) r",String.class,merchant));
        rows.put("images",jdbc.queryForList("SELECT row_to_json(r)::text FROM "
            +"(SELECT * FROM bb_recommendation_image WHERE merchant_id=? ORDER BY id) r",String.class,merchant));
        return rows;
    }
    @Test void restoredAwareApplicationFiltersPendingAcrossRealPublicHttpAndPageBoundaries() throws Exception {
        publicMatrix(new MockHttpSession());
        em.flush();assertEquals(beforeReads,ownRows(),"Public recovery reads must not rewrite old facts/media");
    }
    @Test void freshEntityManagerAndNewHttpSessionRetainIsolationWithoutDataRepair() throws Exception {
        em.flush();em.clear();
        var reopenedRows=em.unwrap(Session.class).doReturningWork(connection->{
            assertActualIsolatedPg(connection);
            // A genuinely new EntityManager/Session on the outer rollback connection:
            // no commit, no second database, no new independent connection hiding uncommitted fixtures.
            try(var reopened=emf.unwrap(SessionFactory.class).withOptions().connection(connection).openSession()){
                assertNotSame(em.unwrap(Session.class),reopened);
                reopened.setDefaultReadOnly(true);
                return reopened.createQuery("from RecommendationItem where postId=:post order by id",RecommendationItem.class)
                    .setParameter("post",mixed.id).getResultList();
            }
        });
        assertEquals(26,reopenedRows.size());
        assertEquals(25,reopenedRows.stream().filter(RecommendationPublication::visible).count());
        assertEquals(1,reopenedRows.stream().filter(row->"PENDING".equals(row.publicationState)).count());
        var projected=taxonomy.display(reopenedRows,true);
        assertEquals(visibleMixedItems,new HashSet<>(projected.stream().map(row->row.id).toList()));
        for(var row:projected){assertEquals(OLD_SPEC,row.specification);assertEquals(0,OLD_PRICE.compareTo(row.referencePrice));}
        // Old public post-only predicate is a SQL negative control, NOT an old V28 JAR execution.
        assertEquals(26,jdbc.queryForObject("SELECT count(*) FROM bb_recommendation_item i "
            +"JOIN bb_recommendation_post p ON p.id=i.post_id WHERE p.id=? AND p.published",Integer.class,mixed.id));
        assertEquals(25,projected.size());
        publicMatrix(new MockHttpSession());
        em.flush();assertEquals(beforeReads,ownRows(),"Reopening must not repair/delete pending rows or alter old source");
    }
}
