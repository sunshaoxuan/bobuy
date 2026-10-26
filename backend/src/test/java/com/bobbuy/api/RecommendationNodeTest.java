package com.bobbuy.api;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.BobbuyStore;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;
@SpringBootTest @AutoConfigureMockMvc
class RecommendationNodeTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired BobbuyStore store;
 @Autowired RecommendationPostRepository posts;@Autowired RecommendationItemRepository items;@Autowired RecommendationImageRepository images;
 @BeforeEach void setup(){cleanup();store.seed();}
 @AfterEach void cleanup(){items.deleteAll();posts.deleteAll();images.deleteAll();}
 RecommendationPost post(Long owner,boolean published){var p=new RecommendationPost();p.merchantId=owner;p.title="Synthetic "+owner;p.body="Synthetic";p.published=published;p.publisherName="Node "+owner;p.publishedAt=java.time.Instant.now();return posts.saveAndFlush(p);}
 @Test void nodeFiltersOnlyNarrowExistingPublicDataAndNeverExposeDraftNodes()throws Exception {
  var a=post(1000L,true);var b=post(9090L,true);var draft=post(8080L,false);
  String feed=mvc.perform(get("/api/storefront/recommendations?merchantId=1000")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
  assertThat(json.readTree(feed).path("data").size()).isEqualTo(1);assertThat(feed).contains("Synthetic 1000").doesNotContain("Synthetic 9090");
  mvc.perform(get("/api/storefront/recommendations/"+b.id+"?merchantId=1000")).andExpect(status().isNotFound());
  mvc.perform(get("/api/storefront/recommendations/"+draft.id)).andExpect(status().isNotFound());
  String nodes=mvc.perform(get("/api/storefront/recommendation-nodes")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
  assertThat(nodes).contains("Node 1000","Node 9090").doesNotContain("8080");
  assertThat(json.readTree(mvc.perform(get("/api/storefront/recommendations?merchantId=7777")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data").size()).isZero();
  mvc.perform(get("/api/storefront/recommendations?merchantId=0")).andExpect(status().isBadRequest());
 }
}
