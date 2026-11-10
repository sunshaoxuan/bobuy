package com.bobbuy.api;
import static com.bobbuy.test.RecommendationPublicationFixtures.*;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.*;
import com.fasterxml.jackson.databind.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print=org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint.NONE)
class RecommendationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired BobbuyStore store;
    @Autowired ProductRepository products;
    @Autowired UserRepository users;
    @Autowired JwtTokenService tokens;
    @Autowired RecommendationPostRepository posts;
    @Autowired RecommendationItemRepository items;
    @Autowired RecommendationImageRepository images;
    String admin, other;
    @BeforeEach void setup() {
        cleanup(); store.seed();
        admin = tokens.createAccessToken(users.findById(1000L).orElseThrow());
        var second = new User(9090L, "Other merchant", Role.AGENT, 0); second.setUsername("rec_other"); users.save(second);
        other = tokens.createAccessToken(second);
    }
    @AfterEach void cleanup() { items.deleteAll(); posts.deleteAll(); images.deleteAll(); }
    JsonNode data(ResultActions result) throws Exception {
        result.andDo(r->{if(r.getResponse().getStatus()==500&&r.getResolvedException()!=null)throw new AssertionError("Recommendation request failed: "+r.getResolvedException().getMessage(),r.getResolvedException());});
        return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("data");
    }
    JsonNode create(String token) throws Exception { return data(mvc.perform(post("/api/merchant/recommendations").header("Authorization", "Bearer " + token))); }
    String path(JsonNode detail) { return "/api/merchant/recommendations/" + detail.at("/post/id").asLong(); }
    byte[] image(int color) throws Exception {
        var image = new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB); image.setRGB(0,0,color);
        var output = new ByteArrayOutputStream(); ImageIO.write(image,"png",output); return output.toByteArray();
    }
    ResultActions upload(JsonNode post, String token, String name, String code, String price, byte[] bytes) throws Exception {
        return mvc.perform(multipart(path(post) + "/images").file(new MockMultipartFile("file", "photo.png", "image/png", bytes))
            .header("Authorization", "Bearer " + token).param("name", name).param("itemNumber", code).param("referencePrice", price)
            .param("version", post.at("/post/version").asText()));
    }
    ResultActions edit(JsonNode post, String token, String title, String body) throws Exception {
        return mvc.perform(put(path(post)).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("title",title,"body",body,"version",post.at("/post/version").asLong()))));
    }
    ResultActions publish(JsonNode post, String action) throws Exception {
        if(action.equals("publish"))return publishPending(mvc,json,items,post,admin);
        return mvc.perform(post(path(post) + "/" + action).header("Authorization", "Bearer " + admin).contentType(MediaType.APPLICATION_JSON)
            .content("{\"version\":" + post.at("/post/version").asLong() + "}"));
    }
    ResultActions article(JsonNode draft,String locale,String title,String body,String hash,boolean reviewed){
        try{return mvc.perform(put(path(draft)+"/article-localizations").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("locale",locale,"title",title,"body",body,"sourceHash",hash,"version",draft.at("/post/version").asLong(),"reviewed",reviewed))));}catch(Exception e){throw new RuntimeException(e);}
    }
    @Test void articleLanguagesRetainSourcesInvalidateChangedTranslationsAndEnforceOwnership()throws Exception{
        var draft=data(edit(create(admin),admin,"Japanese source","Original source body"));String hash=draft.path("articleSourceHash").asText();
        String protectedEdit=json.writeValueAsString(Map.of("locale","zh-CN","title","blocked","body","blocked","sourceHash",hash,"version",draft.at("/post/version").asLong(),"reviewed",true));
        mvc.perform(put(path(draft)+"/article-localizations").header("Authorization","Bearer "+other).contentType(MediaType.APPLICATION_JSON).content(protectedEdit)).andExpect(status().isNotFound());
        String customer=tokens.createAccessToken(users.findById(1001L).orElseThrow());mvc.perform(put(path(draft)+"/article-localizations").header("Authorization","Bearer "+customer).contentType(MediaType.APPLICATION_JSON).content(protectedEdit)).andExpect(status().isForbidden());
        for(String locale:List.of("zh-CN","zh-TW","en-US"))draft=data(article(draft,locale,locale+" title",locale+" body",hash,true));
        assertThat(draft.path("articleTranslations").size()).isEqualTo(3);assertThat(draft.path("body").asText()).isEqualTo("Original source body");
        article(draft,"fr-FR","bad","bad",hash,true).andExpect(status().isBadRequest());article(draft,"en-US","bad","bad","wrong-hash",true).andExpect(status().isBadRequest());article(draft,"en-US","bad","bad",hash,false).andExpect(status().isBadRequest());
        var changed=data(edit(draft,admin,"Japanese source edited","Original source revised"));assertThat(changed.path("articleTranslations").size()).isEqualTo(3);assertThat(changed.path("articleSourceHash").asText()).isNotEqualTo(hash);
        var withImage=data(upload(changed,admin,"SYNTHETIC source language","SYN-ARTICLE","100",image(991))).path("detail");var published=data(publish(withImage,"publish"));
        var publicView=data(mvc.perform(get("/api/storefront/recommendations/"+published.at("/post/id").asLong())));assertThat(publicView.path("articleTranslations").size()).isZero();assertThat(publicView.path("body").asText()).isEqualTo("Original source revised");
        var history=data(mvc.perform(get(path(published)+"/article-history").header("Authorization","Bearer "+admin)));assertThat(history.toString()).contains("Original source body","zh-CN body","Original source revised");
        mvc.perform(get(path(published)+"/article-history").header("Authorization","Bearer "+other)).andExpect(status().isNotFound());mvc.perform(get(path(published)+"/article-history")).andExpect(status().isForbidden());
    }
    @Test void mixedLegacyArticleIsNotInferredOrOverwrittenByTranslation()throws Exception{
        var draft=data(edit(create(admin),admin,"Mixed legacy title","Legacy mixed source retained"));var row=posts.findById(draft.at("/post/id").asLong()).orElseThrow();row.articleSourceLocale=null;posts.saveAndFlush(row);draft=data(mvc.perform(get(path(draft)).header("Authorization","Bearer "+admin)));
        article(draft,"zh-CN","translated","translated",draft.path("articleSourceHash").asText(),true).andExpect(status().isBadRequest());
        var confirmed=data(article(draft,"ja-JP","Reviewed Japanese source","Confirmed original",draft.path("articleSourceHash").asText(),true));assertThat(confirmed.path("articleSourceLocale").asText()).isEqualTo("ja-JP");
        var history=data(mvc.perform(get(path(confirmed)+"/article-history").header("Authorization","Bearer "+admin)));assertThat(history.toString()).contains("Legacy mixed source retained","Confirmed original");
    }
    @Test void multipartSourceContextDefaultsUncheckedFlagsAndBindsIsoDates() throws Exception {
        var draft=create(admin);
        var result=data(mvc.perform(multipart(path(draft)+"/images").file(new MockMultipartFile("file","synthetic.png","image/png",image(452)))
            .header("Authorization","Bearer "+admin).param("name","Synthetic source binding").param("itemNumber","SYN-BINDING")
            .param("referenceContext.supplierKey","SYNTHETIC").param("referenceContext.channel","COSTCO_WAREHOUSE")
            .param("referenceContext.activityStart","2026-11-01").param("referenceContext.startSearchComplete","true")
            .param("version",draft.at("/post/version").asText())));
        assertThat(result.at("/detail/items/0/referenceContext/activityApplies").asBoolean()).isFalse();
        assertThat(result.at("/detail/items/0/referenceContext/startSearchComplete").asBoolean()).isTrue();
        assertThat(result.at("/detail/items/0/referenceContext/activityStart").asText()).isEqualTo("2026-11-01");
        assertThat(result.at("/detail/items/0/offerStart").isNull()).isTrue();
    }
    @Test void createsReusesDeduplicatesUpdatesAndRetriesWithoutDuplicateProducts() throws Exception {
        var draft = create(admin); long before = products.count();
        var first = data(upload(draft,admin,"Tea","REC-TEA","150.50",image(123)));
        assertThat(first.path("productCreated").asBoolean()).isTrue();
        var current = first.path("detail"); String productId = current.at("/items/0/productId").asText();
        var retry = data(upload(draft,admin,"Tea","REC-TEA","150.50",image(123)));
        assertThat(retry.at("/detail/items").size()).isEqualTo(1);
        upload(current,admin,"Tea","REC-TEA","160",image(123)).andExpect(status().isBadRequest());
        long itemId=current.at("/items/0/id").asLong();
        var changed=data(mvc.perform(put(path(current)+"/items/"+itemId).header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("version",current.at("/post/version").asLong(),"facts",Map.of("name","Tea","itemNumber","REC-TEA","referencePrice",160))))));
        var history=data(mvc.perform(get(path(current)+"/items/"+itemId+"/reference-history").header("Authorization","Bearer "+admin)));
        assertThat(history.size()).isEqualTo(2);assertThat(history.at("/0/facts/referencePrice").decimalValue()).isEqualByComparingTo("150.50");assertThat(history.at("/1/facts/referencePrice").asInt()).isEqualTo(160);
        mvc.perform(get(path(current)+"/items/"+itemId+"/reference-history").header("Authorization","Bearer "+other)).andExpect(status().isNotFound());
        mvc.perform(get(path(current)+"/items/"+itemId+"/reference-history")).andExpect(status().isForbidden());
        var secondImage=data(upload(changed,admin,"Tea side","REC-SIDE","160",image(456)));assertThat(secondImage.at("/detail/items").size()).isEqualTo(2);
        upload(create(admin),admin,"Tea","REC-TEA","160",image(123)).andExpect(status().isBadRequest());
        assertThat(products.count()).isEqualTo(before+2);assertThat(images.count()).isEqualTo(2);
        assertThat(products.findById(productId).orElseThrow().getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);
        assertThat(products.findById(productId).orElseThrow().getBasePrice()).isZero();
        assertThat(products.findById(productId).orElseThrow().getPriceTiers()).isEmpty();
        assertThat(data(mvc.perform(get("/api/storefront/products"))).toString()).doesNotContain(productId);
        mvc.perform(get(current.at("/items/0/imageUrl").asText())).andExpect(status().isOk()).andExpect(header().string("X-Content-Type-Options","nosniff"));
    }
    @Test void imageIntakePreservesCluePrivacyCreatesMasterFirstAndRetriesWithoutDuplication() throws Exception {
        var draft=create(admin);String endpoint=path(draft)+"/product-intake";long productCount=products.count(),imageCount=images.count();
        var input=new HashMap<String,Object>();input.put("requestId","synthetic-clue-only-request");input.put("facts",Map.of("name","合成テスト商品","itemNumber","INTAKE-CLUE-001"));input.put("specification","2-pack");input.put("brand","Synthetic");input.put("reviewed",true);input.put("displayUploadedImage",false);input.put("version",draft.at("/post/version").asLong());input.put("officialImages",List.of());
        var clue=data(mvc.perform(multipart(endpoint).file(new MockMultipartFile("input","","application/json",json.writeValueAsBytes(input))).file(new MockMultipartFile("file","synthetic.png","image/png",image(185))).header("Authorization","Bearer "+admin)));
        assertThat(clue.at("/detail/items").size()).isZero();assertThat(images.count()).isEqualTo(imageCount);assertThat(products.count()).isEqualTo(productCount+1);
        var privateMaster=products.findById(clue.path("productId").asText()).orElseThrow();assertThat(privateMaster.getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);assertThat(privateMaster.getMediaGallery()).isEmpty();assertThat(privateMaster.getBasePrice()).isZero();assertThat(privateMaster.getSale()).isNull();
        input.put("requestId","synthetic-displayed-request");input.put("facts",Map.of("name","合成テスト商品2","itemNumber","INTAKE-DISPLAY-002"));input.put("displayUploadedImage",true);
        var displayed=data(mvc.perform(multipart(endpoint).file(new MockMultipartFile("input","","application/json",json.writeValueAsBytes(input))).file(new MockMultipartFile("file","synthetic.png","image/png",image(185))).header("Authorization","Bearer "+admin)));
        assertThat(displayed.at("/detail/items").size()).isEqualTo(1);assertThat(images.count()).isEqualTo(imageCount+1);assertThat(products.count()).isEqualTo(productCount+2);
        var retry=data(mvc.perform(multipart(endpoint).file(new MockMultipartFile("input","","application/json",json.writeValueAsBytes(input))).file(new MockMultipartFile("file","renamed.png","image/png",image(185))).header("Authorization","Bearer "+admin)));
        assertThat(retry.path("created").asBoolean()).isFalse();assertThat(retry.at("/detail/items").size()).isEqualTo(1);assertThat(products.count()).isEqualTo(productCount+2);assertThat(images.count()).isEqualTo(imageCount+1);
        var master=products.findById(displayed.path("productId").asText()).orElseThrow();assertThat(master.getMediaGallery().get(0).getSourceType()).isEqualTo("USER_PROVIDED");assertThat(master.getMediaGallery().get(0).getSourceUrl()).startsWith("urn:bobuy:user-upload:");assertThat(master.getBasePrice()).isZero();
        input.put("requestId","synthetic-existing-enrichment");input.put("existingProductId",privateMaster.getId());input.put("existingProductVersion",privateMaster.getRecordVersion());input.put("facts",Map.of("name","合成テスト商品","itemNumber","INTAKE-CLUE-001"));input.put("version",displayed.at("/detail/post/version").asLong());
        var enriched=data(mvc.perform(multipart(endpoint).file(new MockMultipartFile("input","","application/json",json.writeValueAsBytes(input))).file(new MockMultipartFile("file","synthetic.png","image/png",image(185))).header("Authorization","Bearer "+admin)));
        assertThat(enriched.path("productId").asText()).isEqualTo(privateMaster.getId());assertThat(enriched.path("created").asBoolean()).isFalse();assertThat(enriched.at("/detail/items").size()).isEqualTo(2);assertThat(products.count()).isEqualTo(productCount+2);assertThat(images.count()).isEqualTo(imageCount+1);
        var enrichedRetry=data(mvc.perform(multipart(endpoint).file(new MockMultipartFile("input","","application/json",json.writeValueAsBytes(input))).file(new MockMultipartFile("file","renamed.png","image/png",image(185))).header("Authorization","Bearer "+admin)));
        assertThat(enrichedRetry.at("/detail/items").size()).isEqualTo(2);assertThat(products.count()).isEqualTo(productCount+2);
        String productId=master.getId();assertThat(data(mvc.perform(get("/api/storefront/products"))).toString()).doesNotContain(productId);
        mvc.perform(multipart(endpoint).file(new MockMultipartFile("input","","application/json",json.writeValueAsBytes(input))).header("Authorization","Bearer "+other)).andExpect(status().isNotFound());
        mvc.perform(multipart(endpoint).file(new MockMultipartFile("input","","application/json",json.writeValueAsBytes(input)))).andExpect(status().isForbidden());
    }
    @Test void isolatesMerchantsAndRejectsNonMerchants() throws Exception {
        var draft = create(admin);
        data(upload(draft,admin,"Owner tea","SHARED-CODE","100",image(1)));
        var different = data(upload(create(other),other,"Other tea","SHARED-CODE","200",image(1)));
        assertThat(different.path("productCreated").asBoolean()).isTrue();
        mvc.perform(get(path(draft)).header("Authorization","Bearer " + other)).andExpect(status().isNotFound());
        upload(draft,other,"Intrusion","X","9",image(1)).andExpect(status().isNotFound());
        mvc.perform(get("/api/merchant/recommendations")).andExpect(status().isForbidden());
        assertThat(data(mvc.perform(get("/api/merchant/recommendations").header("Authorization","Bearer " + other))).size()).isEqualTo(1);
    }
    @Test void registersExistingMasterBeforeIssueWithoutDuplicateProductAndRejectsForeignOwner() throws Exception {
        var source=data(upload(create(admin),admin,"ごま油","00123","2178",image(624))).path("detail");
        String productId=source.at("/items/0/productId").asText();
        String imageUrl=source.at("/items/0/imageUrl").asText();
        var blob=images.findById(imageUrl.substring(imageUrl.lastIndexOf('/')+1)).orElseThrow();
        var product=products.findById(productId).orElseThrow();
        product.setMediaGallery(List.of(ProductCatalogService.media(new RecommendationItem.Picture(blob.id,imageUrl,blob.imageHash,"https://www.costco.co.jp/exact-product.jpg","synthetic","瓶",java.time.Instant.now()))));
        products.saveAndFlush(product);product=products.findById(productId).orElseThrow();
        var draft=create(admin);long before=products.count(),mediaBefore=images.count();
        String input=json.writeValueAsString(Map.of("productId",productId,"productVersion",product.getRecordVersion(),"facts",Map.of("name","ごま油","itemNumber","00123","originalPrice",2178,"discountAmount",440,"referencePrice",1738),"version",draft.at("/post/version").asLong(),"reviewed",true));
        var result=data(mvc.perform(post(path(draft)+"/from-product").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content(input)));
        assertThat(result.at("/items/0/productId").asText()).isEqualTo(productId);
        assertThat(result.at("/items/0/gallery").size()).isEqualTo(1);
        assertThat(result.at("/items/0/referencePrice").decimalValue()).isEqualByComparingTo("1738");
        data(mvc.perform(post(path(draft)+"/from-product").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content(input)));
        assertThat(items.findByPostIdOrderById(draft.at("/post/id").asLong())).hasSize(1);
        var next=json.readTree(input);((com.fasterxml.jackson.databind.node.ObjectNode)next).put("version",result.at("/post/version").asLong());
        ((com.fasterxml.jackson.databind.node.ObjectNode)next.get("facts")).put("offerStart","2026-11-02").put("offerEnd","2026-11-08");
        var differentWindow=data(mvc.perform(post(path(draft)+"/from-product").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(next))));
        assertThat(differentWindow.path("items").size()).isEqualTo(2);
        assertThat(products.count()).isEqualTo(before);assertThat(images.count()).isEqualTo(mediaBefore);
        mvc.perform(post(path(draft)+"/from-product").header("Authorization","Bearer "+other).contentType(MediaType.APPLICATION_JSON).content(input)).andExpect(status().isNotFound());
        mvc.perform(post(path(draft)+"/from-product").contentType(MediaType.APPLICATION_JSON).content(input)).andExpect(status().isForbidden());
        assertThat(products.findById(productId).orElseThrow().getBasePrice()).isZero();
    }
    @Test void validatesImagesMetadataAndStaleEdits() throws Exception {
        var draft = create(admin);
        upload(draft,admin," ","X","1",image(1)).andExpect(status().isBadRequest());
        upload(draft,admin,"X","X","-1",image(1)).andExpect(status().isBadRequest());
        upload(draft,admin,"X","X","1.001",image(1)).andExpect(status().isBadRequest());
        upload(draft,admin,"X","X","1","<svg/>".getBytes()).andExpect(status().isBadRequest());
        upload(draft,admin,"X","X","1",new byte[8 * 1024 * 1024 + 1]).andExpect(status().isBadRequest());
        var saved = data(edit(draft,admin,"Article","Text"));
        edit(draft,admin,"Overwrite","Stale").andExpect(status().isBadRequest());
        assertThat(data(mvc.perform(get(path(saved)).header("Authorization","Bearer " + admin))).path("body").asText()).isEqualTo("Text");
        assertThat(items.count()).isZero();
    }
    @Test void publishesWithdrawsAndPreservesProductWhenUnlinked() throws Exception {
        var draft = create(admin); long id = draft.at("/post/id").asLong(); long before = products.count();
        mvc.perform(get("/api/storefront/recommendations/" + id)).andExpect(status().isNotFound());
        publish(draft,"publish").andExpect(status().isBadRequest());
        var withImage = data(upload(draft,admin,"Tea","REC-PUBLIC","100",image(1))).path("detail");
        var saved = data(edit(withImage,admin,"Tea recommendation","<script>alert(1)</script>\nPlain article"));
        var live = data(publish(saved,"publish"));
        String cover = withImage.at("/items/0/imageUrl").asText();
        assertThat(live.at("/post/coverImageUrl").asText()).isEqualTo(cover);
        var publicList = data(mvc.perform(get("/api/storefront/recommendations")));
        assertThat(publicList.get(0).at("/post/coverImageUrl").asText()).isNotEqualTo(cover).startsWith("/api/storefront/recommendation-images/");
        assertThat(publicList.get(0).at("/items/0/imageUrl").asText()).isNotEqualTo(cover).startsWith("/api/storefront/recommendation-images/"); // Only the separately reviewed product image is public.
        assertThat(publicList.get(0).path("body").asText()).contains("<script>");
        assertThat(publicList.get(0).path("items").size()).isEqualTo(1);
        assertThat(live.at("/post/title").asText()).isEqualTo("Tea recommendation");
        assertThat(live.at("/post/publisherName").asText()).isEqualTo(users.findById(1000L).orElseThrow().getName());
        var publishedTime = java.time.Instant.parse(live.at("/post/publishedAt").asText());
        assertThat(publishedTime).isBeforeOrEqualTo(java.time.Instant.now());
        assertThat(posts.findById(id).orElseThrow().publisherId).isEqualTo(1000L);
        assertThat(data(mvc.perform(get("/api/storefront/recommendations/" + id))).path("body").asText()).contains("<script>");
        edit(live,admin,"Forbidden","Text").andExpect(status().isBadRequest());
        var withdrawn = data(publish(live,"withdraw"));
        assertThat(withdrawn.at("/post/publishedAt").asText()).isEqualTo(live.at("/post/publishedAt").asText());
        var publisher = users.findById(1000L).orElseThrow(); publisher.setName("Updated publisher"); users.saveAndFlush(publisher);
        var republished = data(publish(withdrawn,"publish"));
        assertThat(republished.at("/post/publisherName").asText()).isEqualTo("Updated publisher");
        assertThat(java.time.Instant.parse(republished.at("/post/publishedAt").asText())).isAfterOrEqualTo(publishedTime);
        withdrawn = data(publish(republished,"withdraw"));
        mvc.perform(get("/api/storefront/recommendations/" + id)).andExpect(status().isNotFound());
        String productId = withdrawn.at("/items/0/productId").asText();
        assertThat(data(mvc.perform(get("/api/storefront/recommendations"))).size()).isZero();
        mvc.perform(delete(path(withdrawn) + "/items/" + withdrawn.at("/items/0/id").asLong())
            .param("version",withdrawn.at("/post/version").asText()).header("Authorization","Bearer " + admin)).andExpect(status().isBadRequest());
        assertThat(products.count()).isEqualTo(before+1); assertThat(products.existsById(productId)).isTrue(); assertThat(items.count()).isEqualTo(1); // Withdrawal cannot erase an already-public occurrence.
    }
    @Test void acceptsLargeBatchAndSerializesDuplicateRequests() throws Exception {
        var current = create(admin);
        for (int i=0;i<25;i++) current = data(upload(current,admin,"Item " + i,"REC-BATCH-" + i,"10",image(i))).path("detail");
        assertThat(current.path("items").size()).isEqualTo(25);
        var draft = create(admin);
        var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var results = pool.invokeAll(List.of(
                (java.util.concurrent.Callable<JsonNode>) () -> data(upload(draft,admin,"Concurrent","REC-RACE","10",image(1))),
                () -> data(upload(draft,admin,"Concurrent","REC-RACE","10",image(1)))));
            for (var result : results) assertThat(result.get().at("/detail/items").size()).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
    @Test void publicFeedGroupsAllImagesAndExcludesDraftsAcrossPages() throws Exception {
        var older = data(upload(create(admin),admin,"Tea","REC-FEED-1","100",image(1))).path("detail");
        older = data(upload(older,admin,"Tea second product","REC-FEED-1-B","100",image(2))).path("detail");
        older = data(publish(data(edit(older,admin,"First issue","First complete body")),"publish"));
        var newer = data(upload(create(admin),admin,"Coffee","REC-FEED-2","200",image(3))).path("detail");
        newer = data(publish(data(edit(newer,admin,"Second issue","Second complete body")),"publish"));
        data(edit(create(admin),admin,"Private draft","Secret draft body"));
        var feed = data(mvc.perform(get("/api/storefront/recommendations")));
        assertThat(feed.size()).isEqualTo(2);
        assertThat(feed.get(0).at("/post/id").asLong()).isEqualTo(newer.at("/post/id").asLong());
        assertThat(feed.get(1).path("body").asText()).isEqualTo("First complete body");
        assertThat(feed.get(1).path("items").size()).isEqualTo(2);
        assertThat(feed.get(0).path("items").size()).isEqualTo(1);
        assertThat(feed.toString()).doesNotContain("Secret draft body");
        assertThat(data(mvc.perform(get("/api/storefront/recommendations").param("page","1"))).isEmpty()).isTrue();
        mvc.perform(get("/api/storefront/recommendations").param("page","-1")).andExpect(status().isBadRequest());
    }

    @Test void preservesUnknownsOfferUnitsAndSeparateCouponPeriodsWithPrivateUnpricedProfiles() throws Exception {
        long catalogCount = products.count();
        var draft = create(admin);
        var imported = data(mvc.perform(multipart(path(draft)+"/images")
            .file(new MockMultipartFile("file","offer.png","image/png",image(22)))
            .header("Authorization","Bearer "+admin).param("version",draft.at("/post/version").asText())
            .param("name","Synthetic meat").param("itemNumber","00123").param("originalPrice","500")
            .param("referencePrice","400").param("discountAmount","100").param("priceUnit","100g")
            .param("offerStart","2026-10-26").param("offerEnd","2026-11-22")
            .param("couponStart","2026-10-20").param("couponEnd","2026-10-25")
            .param("offerNotes","Synthetic separate coupon issue and redemption"))).path("detail");
        assertThat(imported.at("/items/0/itemNumber").asText()).isEqualTo("00123");
        assertThat(imported.at("/items/0/currency").asText()).isEqualTo("JPY");
        assertThat(imported.at("/items/0/priceUnit").asText()).isEqualTo("100g");
        assertThat(imported.at("/items/0/couponEnd").asText()).isEqualTo("2026-10-25");
        var facts = json.createObjectNode().put("name","Synthetic meat").put("itemNumber","00123").put("offerEnd","2026-11-01");
        var saved = data(mvc.perform(put(path(imported)+"/items/"+imported.at("/items/0/id").asLong())
            .header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("facts",facts,"version",imported.at("/post/version").asLong())))));
        assertThat(saved.at("/items/0/referencePrice").isNull()).isTrue();
        assertThat(saved.at("/items/0/itemNumber").asText()).isEqualTo("00123");
        assertThat(saved.at("/items/0/offerStart").isNull()).isTrue();
        assertThat(saved.at("/items/0/offerEnd").asText()).isEqualTo("2026-11-01");
        var publicPost = data(publish(data(edit(saved,admin,"Synthetic offers","Review source conditions")),"publish"));
        var visible = data(mvc.perform(get("/api/storefront/recommendations/"+publicPost.at("/post/id").asLong())));
        assertThat(visible.at("/items/0/referencePrice").isNull()).isTrue();
        assertThat(products.count()).isEqualTo(catalogCount+1);
        var profile=products.findById(saved.at("/items/0/productId").asText()).orElseThrow();
        assertThat(profile.getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);assertThat(profile.getBasePrice()).isZero();
    }

    @Test void explicitCatalogReusePreservesExistingProductAndRejectsForeignLinks() throws Exception {
        var existing=products.findAll().stream().filter(p->p.getMerchantId().equals(1000L)).findFirst().orElseThrow();
        String before=json.writeValueAsString(existing);
        var current=data(upload(create(admin),admin,"Source-specific quote","00123","999",image(91))).path("detail");
        var input=new java.util.HashMap<String,Object>();input.put("itemIds",List.of(current.at("/items/0/id").asLong()));input.put("productId",existing.getId());input.put("version",current.at("/post/version").asLong());
        var linked=data(mvc.perform(put(path(current)+"/catalog").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input))));
        assertThat(linked.at("/items/0/productId").asText()).isEqualTo(existing.getId());
        assertThat(linked.at("/items/0/referencePrice").asInt()).isEqualTo(999);
        assertThat(json.writeValueAsString(products.findById(existing.getId()).orElseThrow())).isEqualTo(before);
        mvc.perform(put(path(linked)+"/catalog").header("Authorization","Bearer "+other).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input))).andExpect(status().isNotFound());
        assertThat(products.findByMerchantIdAndItemNumber(1000L,"00123")).isPresent();
    }

    @Test void oldUnlinkedItemsCanBuildCatalogThroughReviewedIdempotentBatch() throws Exception {
        var current=data(upload(create(admin),admin,"Legacy","000001","1200",image(92))).path("detail");
        var item=items.findById(current.at("/items/0/id").asLong()).orElseThrow();item.productId=null;items.saveAndFlush(item);
        long count=products.count();var input=Map.of("itemIds",List.of(item.id),"version",current.at("/post/version").asLong());
        String endpoint=path(current)+"/catalog";
        var result=data(mvc.perform(put(endpoint).header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input))));
        assertThat(result.at("/items/0/productId").isNull()).isFalse();assertThat(result.at("/items/0/itemNumber").asText()).isEqualTo("000001");
        data(mvc.perform(put(endpoint).header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(input))));
        assertThat(products.count()).isEqualTo(count);assertThat(result.at("/post/published").asBoolean()).isFalse();
    }

    @Test void unpricedCatalogProfilesCannotBecomePurchasableThroughVisibilityOrQuantityChanges() throws Exception {
        var current=data(upload(create(admin),admin,"Unpriced source","PENDING-001","1200",image(93))).path("detail");
        String id=current.at("/items/0/productId").asText();var profile=products.findById(id).orElseThrow();
        assertThat(profile.getBasePrice()).isZero();assertThat(profile.getOrderMethod()).isEqualTo(OrderMethod.PRE_ORDER);assertThat(id).startsWith("bobuy-rec-v1-");
        profile.getAttributes().clear(); // Ordinary catalog edits cannot clear the immutable draft provenance guard.
        String customer=tokens.createAccessToken(users.findById(1001L).orElseThrow());
        for(var method:List.of(OrderMethod.PRE_ORDER,OrderMethod.DIRECT_BUY)) {
            profile.setVisibilityStatus(ProductVisibility.PUBLIC);profile.setOrderMethod(method);profile.setBasePrice(12345);profile=products.saveAndFlush(profile);
            assertThat(data(mvc.perform(get("/api/storefront/products"))).toString()).doesNotContain(id);
            for(int quantity:List.of(1,99,100))mvc.perform(post("/api/checkout").header("Authorization","Bearer "+customer).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("requestId",UUID.randomUUID(),"tripId",2000,"items",List.of(Map.of("productId",id,"quantity",quantity)))))).andExpect(status().isBadRequest());
        }
        assertThat(data(mvc.perform(get(path(current)).header("Authorization","Bearer "+admin))).at("/items/0/referencePrice").asInt()).isEqualTo(1200);
    }

    @Test void catalogLinkRejectsForeignProductsAndAmbiguousCodeLookupsNeverPickAnOwner() throws Exception {
        var own=data(upload(create(admin),admin,"Own offer","SAME-000","900",image(94))).path("detail");
        var foreign=data(upload(create(other),other,"Foreign offer","SAME-000","1200",image(95))).path("detail");
        mvc.perform(put(path(own)+"/catalog").header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("itemIds",List.of(own.at("/items/0/id").asLong()),"productId",foreign.at("/items/0/productId").asText(),"version",own.at("/post/version").asLong())))).andExpect(status().isNotFound());
        assertThat(products.findByItemNumber("SAME-000")).isEmpty();
        assertThat(products.findByMerchantIdAndItemNumber(1000L,"SAME-000").orElseThrow().getId()).isEqualTo(own.at("/items/0/productId").asText());
    }

    @Test void rejectsInvalidOfferDatesAndNumericJsonCodesAndCrossOwnerItemEdits() throws Exception {
        var draft = create(admin);
        var imported = data(upload(draft,admin,"Synthetic","0001","100",image(1))).path("detail");
        var facts = json.createObjectNode().put("name","Synthetic").put("offerStart","2026-11-23").put("offerEnd","2026-11-22");
        String endpoint = path(imported)+"/items/"+imported.at("/items/0/id").asLong();
        mvc.perform(put(endpoint).header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("facts",facts,"version",imported.at("/post/version").asLong())))).andExpect(status().isBadRequest());
        facts.remove("offerStart");facts.remove("offerEnd");facts.put("itemNumber",123);
        mvc.perform(put(endpoint).header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("facts",facts,"version",imported.at("/post/version").asLong())))).andExpect(status().isBadRequest());
        facts.put("itemNumber","0001");
        mvc.perform(put(endpoint).header("Authorization","Bearer "+other).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("facts",facts,"version",imported.at("/post/version").asLong())))).andExpect(status().isNotFound());
        assertThat(items.findById(imported.at("/items/0/id").asLong()).orElseThrow().itemNumber).isEqualTo("0001");
    }
}
