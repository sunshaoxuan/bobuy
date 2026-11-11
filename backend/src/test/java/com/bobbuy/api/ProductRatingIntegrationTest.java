package com.bobbuy.api;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest(properties={"bobbuy.security.header-auth.enabled=false","bobbuy.seed.enabled=false","bobbuy.seed.force-reset-on-invoke=false"}) @AutoConfigureMockMvc @Transactional
class ProductRatingIntegrationTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired ProductRepository products;@Autowired UserRepository users;@Autowired ProductReviewRepository reviews;@Autowired JwtTokenService tokens;
 String id,agent,customer;
 @BeforeEach void setup(){var a=new User(98732101L,"Synthetic agent",Role.AGENT,0);a.setUsername("review-agent");users.saveAndFlush(a);agent=tokens.createAccessToken(a);var c=new User(98732102L,"Synthetic customer",Role.CUSTOMER,0);c.setUsername("review-customer");users.saveAndFlush(c);customer=tokens.createAccessToken(c);var p=new Product();id="user-review-"+UUID.randomUUID();p.setId(id);p.setMerchantId(a.getId());p.setName(Map.of("ja-JP","Synthetic review product"));p.setVisibilityStatus(ProductVisibility.PUBLIC);products.saveAndFlush(p);}
 String input(String score,String text,long version)throws Exception{return json.writeValueAsString(Map.of("stars",new java.math.BigDecimal(score),"comment",text,"version",version));}
 void save(String token,String score,String text,long version)throws Exception{mvc.perform(put("/api/product-reviews/"+id+"/mine").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(input(score,text,version))).andExpect(status().isOk());}
 @Test void customersAndAgentsContributeAndEditingKeepsCount()throws Exception{save(agent,"5","Agent review",0);save(customer,"2.5","<script>plain text</script>",0);var summary=json.readTree(mvc.perform(get("/api/storefront/product-reviews/"+id)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");assertThat(summary.path("average").asDouble()).isEqualTo(3.75);assertThat(summary.path("count").asInt()).isEqualTo(2);save(customer,"4.5","Edited",1);var next=json.readTree(mvc.perform(get("/api/storefront/product-reviews/"+id)).andReturn().getResponse().getContentAsString()).path("data");assertThat(next.path("count").asInt()).isEqualTo(2);assertThat(next.path("average").asDouble()).isEqualTo(4.75);var comments=mvc.perform(get("/api/storefront/product-reviews/"+id+"/comments")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();assertThat(comments).doesNotContain("userId","username","password","email");}
 @Test void anonymousInvalidStaleAndPrivateRequestsCannotMutate()throws Exception{String url="/api/product-reviews/"+id+"/mine";mvc.perform(put(url).contentType(MediaType.APPLICATION_JSON).content(input("5","",0))).andExpect(status().isUnauthorized());for(String value:List.of("0","0.5","1.1","5.5"))mvc.perform(put(url).header("Authorization","Bearer "+customer).contentType(MediaType.APPLICATION_JSON).content(input(value,"",0))).andExpect(status().isBadRequest());save(customer,"4","",0);mvc.perform(put(url).header("Authorization","Bearer "+customer).contentType(MediaType.APPLICATION_JSON).content(input("5","stale",0))).andExpect(status().isConflict());assertThat(reviews.findByProductIdAndUserId(id,98732102L).orElseThrow().stars).isEqualByComparingTo("4");var p=products.findById(id).orElseThrow();p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);products.saveAndFlush(p);mvc.perform(get("/api/storefront/product-reviews/"+id)).andExpect(status().isNotFound());}
}
