package com.bobbuy.api;

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
@AutoConfigureMockMvc
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
        return mvc.perform(post(path(post) + "/" + action).header("Authorization", "Bearer " + admin).contentType(MediaType.APPLICATION_JSON)
            .content("{\"version\":" + post.at("/post/version").asLong() + "}"));
    }
    @Test void createsReusesDeduplicatesUpdatesAndRetriesWithoutDuplicateProducts() throws Exception {
        var draft = create(admin); long before = products.count();
        var first = data(upload(draft,admin,"Tea","REC-TEA","150.50",image(123)));
        assertThat(first.path("productCreated").asBoolean()).isFalse();
        var current = first.path("detail"); String productId = current.at("/items/0/productId").asText();
        var retry = data(upload(draft,admin,"Tea","REC-TEA","150.50",image(123)));
        assertThat(retry.at("/detail/items").size()).isEqualTo(1);
        var changed = data(upload(current,admin,"Tea","REC-TEA","160",image(123)));
        assertThat(changed.path("imageReused").asBoolean()).isTrue(); assertThat(changed.path("priceUpdated").asBoolean()).isTrue();
        assertThat(changed.at("/detail/items/0/referencePrice").decimalValue()).isEqualByComparingTo("160");
        var secondImage = data(upload(changed.path("detail"),admin,"Tea side","REC-TEA","160",image(456)));
        assertThat(secondImage.at("/detail/items").size()).isEqualTo(2);
        var secondPost = data(upload(create(admin),admin,"Tea","REC-TEA","160",image(123)));
        assertThat(secondPost.path("imageReused").asBoolean()).isTrue();
        assertThat(products.count()).isEqualTo(before); assertThat(images.count()).isEqualTo(2);
        assertThat(first.at("/detail/items/0/productId").isNull()).isTrue();
        mvc.perform(get(current.at("/items/0/imageUrl").asText())).andExpect(status().isOk()).andExpect(header().string("X-Content-Type-Options","nosniff"));
    }
    @Test void isolatesMerchantsAndRejectsNonMerchants() throws Exception {
        var draft = create(admin);
        data(upload(draft,admin,"Owner tea","SHARED-CODE","100",image(1)));
        var different = data(upload(create(other),other,"Other tea","SHARED-CODE","200",image(1)));
        assertThat(different.path("productCreated").asBoolean()).isFalse();
        mvc.perform(get(path(draft)).header("Authorization","Bearer " + other)).andExpect(status().isNotFound());
        upload(draft,other,"Intrusion","X","9",image(1)).andExpect(status().isNotFound());
        mvc.perform(get("/api/merchant/recommendations")).andExpect(status().isForbidden());
        assertThat(data(mvc.perform(get("/api/merchant/recommendations").header("Authorization","Bearer " + other))).size()).isEqualTo(1);
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
        assertThat(publicList.get(0).at("/post/coverImageUrl").asText()).isEqualTo(cover);
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
        data(mvc.perform(delete(path(withdrawn) + "/items/" + withdrawn.at("/items/0/id").asLong())
            .param("version",withdrawn.at("/post/version").asText()).header("Authorization","Bearer " + admin)));
        assertThat(products.count()).isEqualTo(before); assertThat(items.count()).isZero();
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
        older = data(upload(older,admin,"Tea second photo","REC-FEED-1","100",image(2))).path("detail");
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

    @Test void preservesUnknownsOfferUnitsAndSeparateCouponPeriodsWithoutCatalogWrites() throws Exception {
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
        var facts = json.createObjectNode().put("name","No source prices").put("offerEnd","2026-11-01");
        var saved = data(mvc.perform(put(path(imported)+"/items/"+imported.at("/items/0/id").asLong())
            .header("Authorization","Bearer "+admin).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("facts",facts,"version",imported.at("/post/version").asLong())))));
        assertThat(saved.at("/items/0/referencePrice").isNull()).isTrue();
        assertThat(saved.at("/items/0/itemNumber").isNull()).isTrue();
        assertThat(saved.at("/items/0/offerStart").isNull()).isTrue();
        assertThat(saved.at("/items/0/offerEnd").asText()).isEqualTo("2026-11-01");
        var publicPost = data(publish(data(edit(saved,admin,"Synthetic offers","Review source conditions")),"publish"));
        var visible = data(mvc.perform(get("/api/storefront/recommendations/"+publicPost.at("/post/id").asLong())));
        assertThat(visible.at("/items/0/referencePrice").isNull()).isTrue();
        assertThat(products.count()).isEqualTo(catalogCount);
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
