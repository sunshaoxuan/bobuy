package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.*;
import com.fasterxml.jackson.databind.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="bobbuy.security.header-auth.enabled=false") @AutoConfigureMockMvc
class RecommendationItemPublicationIntegrationTest {
    @DynamicPropertySource static void isolatedDatasource(DynamicPropertyRegistry registry){
        boolean pg="true".equals(System.getenv("BOBBUY_ISOLATED_CI_POSTGRES"));
        String url=System.getProperty("spring.datasource.url","jdbc:h2:mem:bobbuy;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE");
        if(pg){if(!"true".equals(System.getenv("GITHUB_ACTIONS"))||!"postgres-migration-verify".equals(System.getenv("GITHUB_JOB"))||!"workflow_dispatch".equals(System.getenv("GITHUB_EVENT_NAME"))||!url.equals("jdbc:postgresql://127.0.0.1:5432/bobbuy"))throw new IllegalStateException("Only existing explicit hosted CI PostgreSQL may run publication fixtures");}
        else if(!url.startsWith("jdbc:h2:mem:bobbuy;"))throw new IllegalStateException("Refuse unproved publication datasource before Spring connects");
        registry.add("spring.datasource.url",()->url);registry.add("spring.datasource.driver-class-name",()->pg?"org.postgresql.Driver":"org.h2.Driver");
        registry.add("spring.datasource.username",()->pg?"bobbuy":"sa");registry.add("spring.datasource.password",()->pg?"bobbuypassword":"");
        registry.add("spring.flyway.enabled",()->pg);registry.add("spring.jpa.hibernate.ddl-auto",()->pg?"validate":"create-drop");
    }
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired BobbuyStore store;@Autowired JwtTokenService jwt;
    @Autowired UserRepository users;@Autowired ProductRepository products;@Autowired RecommendationPostRepository posts;
    @Autowired RecommendationItemRepository items;@Autowired RecommendationImageRepository images;@Autowired ReferenceQuoteRevisionRepository history;
    @Autowired RecommendationService service;@Autowired PlatformTransactionManager transactions;@Autowired Environment environment;
    @MockBean JavaMailSender mail;
    String token,other,customer;RecommendationPost issue;RecommendationItem ready,pending;
    @BeforeEach void fixture(){
        assertTrue(environment.getProperty("spring.datasource.url","").startsWith("jdbc:h2:mem:bobbuy;")||"true".equals(System.getenv("BOBBUY_ISOLATED_CI_POSTGRES")));
        items.deleteAll();posts.deleteAll();images.deleteAll();store.seed();
        var agent=users.findById(1000L).orElseThrow();token=jwt.createAccessToken(agent);customer=jwt.createAccessToken(users.findById(1001L).orElseThrow());
        var second=new User(991231L,"Synthetic other merchant",Role.AGENT,0);second.setUsername("publication-other");users.saveAndFlush(second);other=jwt.createAccessToken(second);
        issue=new RecommendationPost();issue.merchantId=1000L;issue.title="Synthetic publication issue";issue.body="Synthetic source body retained";issue.articleSourceLocale="ja-JP";issue=posts.saveAndFlush(issue);
        ready=item("47506",true);pending=item("1731065",false);
    }
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    RecommendationItem item(String code,boolean complete){
        byte[] content;
        try{var picture=new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB);picture.setRGB(0,0,code.hashCode());var bytes=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(picture,"png",bytes);content=bytes.toByteArray();}
        catch(java.io.IOException error){throw new IllegalStateException(error);}
        var checked=RecommendationImageValidator.validate(content);
        var image=new RecommendationImage();image.id=UUID.randomUUID().toString();image.merchantId=1000L;image.contentType=checked.contentType();image.content=checked.content();image.imageHash=checked.hash();images.saveAndFlush(image);
        var p=new Product();p.setId("publication-"+code+"-"+UUID.randomUUID());p.setMerchantId(1000L);p.setItemNumber(code);p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);
        var names=new HashMap<String,String>();var specifications=new HashMap<String,String>();for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US")){names.put(locale,"Synthetic "+code);specifications.put(locale,"24 cartons of 200ml");}
        p.setName(names);p.setDescription(new HashMap<>());var media=new MediaGalleryItem("/api/storefront/recommendation-images/"+image.id,com.bobbuy.model.MediaType.IMAGE,Map.of("ja-JP","Synthetic carton"),true,"https://www.costco.co.jp/synthetic/"+code+".jpg","www.costco.co.jp","OFFICIAL_PRODUCT");media.setSha256(image.imageHash);p.setMediaGallery(complete?new ArrayList<>(List.of(media)):new ArrayList<>());
        p.setCatalogData(new ProductCatalogData(specifications,null,"cartons",List.of(),null,null,1000L,Instant.now()));var d=p.getCatalogData();p.setCatalogData(new ProductCatalogData(d.specification(),d.model(),d.packaging(),d.categoryIds(),d.supplierId(),ProductCatalogService.sourceHash(p),d.reviewedBy(),d.reviewedAt()));p=products.saveAndFlush(p);
        var item=new RecommendationItem();item.postId=issue.id;item.productId=p.getId();item.name="Original source "+code;item.itemNumber=code;item.specification="Source packaging retained";item.referencePrice=BigDecimal.TEN;item.priceUnit="per pack";item.imageHash=image.imageHash;item.imageUrl=media.getUrl();item.referenceContext=new ReferenceOfferContext("COSTCO","COSTCO_ONLINE","200ml x 24","synthetic-message","https://www.costco.co.jp/synthetic-source",null,null,false,null,true);return items.saveAndFlush(item);
    }
    String path(){return "/api/merchant/recommendations/"+issue.id;}
    JsonNode data(ResultActions result)throws Exception{return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
    JsonNode getMerchant()throws Exception{return data(mvc.perform(get(path()).header("Authorization","Bearer "+token)));}
    String body(JsonNode detail,long itemId,UUID key)throws Exception{for(var item:detail.path("items"))if(item.path("id").asLong()==itemId)return json.writeValueAsString(Map.of("requestId",key,"version",detail.at("/post/version").asLong(),"productVersion",item.path("publicationProductVersion").asLong(),"sourceHash",item.path("publicationReviewHash").asText(),"reviewed",true));throw new AssertionError("Missing selected item");}
    ResultActions publish(long id,String body,String auth)throws Exception{return mvc.perform(post(path()+"/items/"+id+"/publish").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(body));}
    @Test void authenticatedFirstPublicationAndPublicReadPathsKeepPendingHidden()throws Exception{
        var draft=getMerchant();String request=body(draft,ready.id,UUID.randomUUID());
        mvc.perform(get("/api/storefront/recommendations/"+issue.id)).andExpect(status().isNotFound());
        long beforeVersion=posts.findById(issue.id).orElseThrow().version;
        int beforeHistory=history.findByMerchantIdAndItemIdOrderById(1000L,ready.id).size();
        publish(ready.id,request,other).andExpect(status().isNotFound());publish(ready.id,request,customer).andExpect(status().isForbidden());
        // Existing SecurityConfig distinguishes anonymous 401 from authenticated CUSTOMER 403.
        // Keep this request genuinely anonymous; do not manufacture a principal to obtain 403.
        mvc.perform(post(path()+"/items/"+ready.id+"/publish").contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isUnauthorized());
        assertEquals(beforeVersion,posts.findById(issue.id).orElseThrow().version);
        assertFalse(posts.findById(issue.id).orElseThrow().published);
        var denied=items.findById(ready.id).orElseThrow();
        assertEquals("PENDING",denied.publicationState);assertNull(denied.publicationSnapshot);
        assertNull(denied.publishedBy);assertNull(denied.publicationRequestId);assertNull(denied.publicationRequestHash);
        assertEquals(beforeHistory,history.findByMerchantIdAndItemIdOrderById(1000L,ready.id).size());
        assertEquals(2,items.findByPostIdOrderById(issue.id).size());
        var live=data(publish(ready.id,request,token));assertTrue(live.at("/post/published").asBoolean());
        var view=data(mvc.perform(get("/api/storefront/recommendations/"+issue.id)));assertEquals(1,view.path("items").size());assertFalse(view.toString().contains("1731065"));assertFalse(view.toString().contains("publicationSnapshot"));
        assertEquals(1,data(mvc.perform(get("/api/storefront/recommendation-browse/items").param("issueId",issue.id.toString()).param("period","all"))).path("scopeTotal").asLong());
        assertEquals(0,data(mvc.perform(get("/api/storefront/recommendation-browse/items").param("issueId",issue.id.toString()).param("period","all").param("query","1731065"))).path("scopeTotal").asLong());
        mvc.perform(get("/api/storefront/product-browse/"+pending.productId)).andExpect(status().isNotFound());assertEquals("PENDING",items.findById(pending.id).orElseThrow().publicationState);assertEquals(2,items.findByPostIdOrderById(issue.id).size());
    }
    @Test void simultaneousSameRequestPublishesOnceAndChangedReplayIsConflict()throws Exception{
        String request=body(getMerchant(),ready.id,UUID.randomUUID());var pool=Executors.newFixedThreadPool(2);
        try{var first=pool.submit(()->data(publish(ready.id,request,token)));var second=pool.submit(()->data(publish(ready.id,request,token)));assertTrue(first.get(15,TimeUnit.SECONDS).at("/post/published").asBoolean());assertTrue(second.get(15,TimeUnit.SECONDS).at("/post/published").asBoolean());}
        finally{pool.shutdownNow();assertTrue(pool.awaitTermination(5,TimeUnit.SECONDS));}
        assertEquals(1,items.findByPostIdOrderById(issue.id).stream().filter(RecommendationPublication::visible).count());
        assertEquals(1,history.findByMerchantIdAndItemIdOrderById(1000L,ready.id).size());
        var changed=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(request);changed.put("sourceHash","0".repeat(64));publish(ready.id,json.writeValueAsString(changed),token).andExpect(status().isConflict());
    }
    @Test void rollbackAfterBothFlushesLeavesNoPublicationAndSameKeyCanRetry()throws Exception{
        // Review the persisted merchant DTO, exactly as the client does. The detached fixture
        // still holds TEN(scale0), while numeric(14,2) reads 10.00; neither the amount nor
        // the service's strict evidence/hash guard should be changed to hide that mismatch.
        assertEquals(0,ready.referencePrice.compareTo(items.findById(ready.id).orElseThrow().referencePrice));
        var key=UUID.randomUUID();var reviewed=json.readTree(body(getMerchant(),ready.id,key));
        long version=reviewed.path("version").asLong(),productVersion=reviewed.path("productVersion").asLong();
        String sourceHash=reviewed.path("sourceHash").asText();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("1000",null,AuthorityUtils.createAuthorityList("ROLE_AGENT")));
        new TransactionTemplate(transactions).execute(status->{
            var live=service.publishItem(issue.id,ready.id,key,version,productVersion,sourceHash,true);
            assertTrue(live.post().published());assertTrue(posts.findById(issue.id).orElseThrow().published);
            assertTrue(RecommendationPublication.visible(items.findById(ready.id).orElseThrow()));
            assertNotNull(items.findById(ready.id).orElseThrow().publicationSnapshot);
            assertEquals(1,history.findByMerchantIdAndItemIdOrderById(1000L,ready.id).size());
            status.setRollbackOnly();return null;
        });
        assertFalse(posts.findById(issue.id).orElseThrow().published);assertEquals("PENDING",items.findById(ready.id).orElseThrow().publicationState);assertTrue(history.findByMerchantIdAndItemIdOrderById(1000L,ready.id).isEmpty());
        service.publishItem(issue.id,ready.id,key,version,productVersion,sourceHash,true);assertTrue(posts.findById(issue.id).orElseThrow().published);
        assertTrue(RecommendationPublication.visible(items.findById(ready.id).orElseThrow()));
        assertEquals(1,history.findByMerchantIdAndItemIdOrderById(1000L,ready.id).size());
    }
    JsonNode reviseCurrentArticle(String suffix)throws Exception{
        var current=getMerchant();var texts=new TreeMap<String,Object>();
        for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US"))texts.put(locale,Map.of("title",locale+" reviewed "+suffix,"body",locale+" short reviewed body "+suffix));
        return data(mvc.perform(put(path()+"/article-revision").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("requestId",UUID.randomUUID(),"version",current.at("/post/version").asLong(),"sourceHash",current.path("articleSourceHash").asText(),"reviewed",true,"articles",texts)))));
    }
    @Test void publishedSevenItemsCanAppendEighthBetweenAtomicArticleRevisionsWithoutWithdrawingOrRewritingHistory()throws Exception{
        data(publish(ready.id,body(getMerchant(),ready.id,UUID.randomUUID()),token));
        for(int i=2;i<=7;i++){var existing=item("EXISTING-"+i,true);data(publish(existing.id,body(getMerchant(),existing.id,UUID.randomUUID()),token));}
        var originalPost=posts.findById(issue.id).orElseThrow();var publishedRows=new TreeMap<Long,String>();
        for(var existing:items.findByPostIdOrderById(issue.id))if(RecommendationPublication.visible(existing))publishedRows.put(existing.id,json.writeValueAsString(existing));
        assertEquals(7,publishedRows.size());var first=reviseCurrentArticle("before append");assertTrue(first.path("current").asBoolean());
        assertEquals(4,first.at("/detail/articleTranslations").size());
        // Prepare only an owned synthetic master; the actual association is added via the normal API.
        var staged=item("EIGHTH",true);items.deleteById(staged.id);items.flush();var master=products.findById(staged.productId).orElseThrow();
        var facts=new RecommendationFacts(ProductCatalogService.text(master.getName(),"ja-JP"),master.getItemNumber(),BigDecimal.TEN,null,null,"per pack",null,null,null,null,null,staged.referenceContext,null,null,null,"24 cartons of 200ml");
        var current=getMerchant();var addition=Map.of("productId",master.getId(),"productVersion",master.getRecordVersion(),"facts",facts,"version",current.at("/post/version").asLong(),"reviewed",true);
        var added=data(mvc.perform(post(path()+"/from-product").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(addition))));
        var eighth=items.findByPostIdOrderById(issue.id).stream().filter(i->master.getId().equals(i.productId)).findFirst().orElseThrow();
        assertEquals("PENDING",eighth.publicationState);assertEquals(first.path("articleSourceHash").asText(),added.path("articleSourceHash").asText());
        var publicBefore=data(mvc.perform(get("/api/storefront/recommendations/"+issue.id)));assertEquals(7,publicBefore.path("items").size());assertFalse(publicBefore.toString().contains("1731065"));assertFalse(publicBefore.toString().contains("EIGHTH"));
        data(publish(eighth.id,body(getMerchant(),eighth.id,UUID.randomUUID()),token));
        var second=reviseCurrentArticle("after append");assertTrue(second.path("current").asBoolean());assertEquals(4,second.at("/detail/articleTranslations").size());
        var publicAfter=data(mvc.perform(get("/api/storefront/recommendations/"+issue.id)));assertEquals(8,publicAfter.path("items").size());assertFalse(publicAfter.toString().contains("1731065"));
        for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US"))assertEquals(locale+" short reviewed body after append",publicAfter.path("articleTranslations").path(locale).path("body").asText());
        for(var saved:publishedRows.entrySet())assertEquals(saved.getValue(),json.writeValueAsString(items.findById(saved.getKey()).orElseThrow()));
        var after=posts.findById(issue.id).orElseThrow();assertTrue(after.published);assertEquals(originalPost.publishedAt,after.publishedAt);assertEquals(originalPost.createdAt,after.createdAt);
        var articleHistory=data(mvc.perform(get(path()+"/article-history").header("Authorization","Bearer "+token))).toString();
        assertTrue(articleHistory.contains("Synthetic source body retained"));assertTrue(articleHistory.contains("short reviewed body before append"));assertTrue(articleHistory.contains("short reviewed body after append"));
        assertEquals("PENDING",items.findById(pending.id).orElseThrow().publicationState);
    }
}
