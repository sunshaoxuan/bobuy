package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.RecommendationArticleService;
import com.fasterxml.jackson.databind.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Own synthetic rows in the configured isolated test datasource; rollback, no seed/deleteAll or fixed H2 URL. */
@SpringBootTest
@AutoConfigureMockMvc(print=org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint.NONE)
@Transactional
class RecommendationIssueDateIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired RecommendationPostRepository posts;
    @Autowired RecommendationItemRepository items;
    @Autowired RecommendationArticleRevisionRepository revisions;
    @Autowired RecommendationArticleService articles;
    @Autowired JwtTokenService tokens;
    User owner,other,customer;
    RecommendationPost issue;
    String ownerToken,otherToken,customerToken;
    final String hash="a".repeat(64);
    User user(long id,Role role){var u=new User(id,"SYNTHETIC issue date "+id,role,0);u.setUsername("issue-date-"+UUID.randomUUID());return users.saveAndFlush(u);}
    RecommendationPost issue(){
        var p=new RecommendationPost();p.merchantId=owner.getId();p.title="SYNTHETIC source issue";p.body="Retained original source body";p.articleSourceLocale="ja-JP";p.published=true;p.publishedAt=Instant.parse("2026-11-08T23:30:00Z");p.publisherId=owner.getId();p.publisherName=owner.getName();p=posts.saveAndFlush(p);
        var i=new RecommendationItem();i.postId=p.id;i.name="SYNTHETIC medicine reference only";i.itemNumber="SYN-DATE";i.specification="24 cartons";i.description="Reference only; not permission to purchase";i.imageHash="synthetic-original-image";i.imageUrl="https://example.invalid/original.png";i.referencePrice=new BigDecimal("265.00");i.gallery=List.of(new RecommendationItem.Picture("synthetic-image","https://example.invalid/original.png","hash","https://example.invalid/source","synthetic-key","Original",Instant.parse("2026-11-01T00:00:00Z")));items.saveAndFlush(i);return p;
    }
    @BeforeEach void setup(){long n=9_000_000_000L+Integer.toUnsignedLong(UUID.randomUUID().hashCode())*4;owner=user(n,Role.AGENT);other=user(n+1,Role.AGENT);customer=user(n+2,Role.CUSTOMER);ownerToken=tokens.createAccessToken(owner);otherToken=tokens.createAccessToken(other);customerToken=tokens.createAccessToken(customer);issue=issue();}
    String path(RecommendationPost p){return "/api/merchant/recommendations/"+p.id+"/issue-date";}
    String body(RecommendationPost p,String date,String ref,String sourceHash,boolean reviewed)throws Exception{return json.writeValueAsString(Map.of("issueDate",date,"sourceRef",ref,"sourceHash",sourceHash,"version",p.version,"reviewed",reviewed));}
    JsonNode data(ResultActions result)throws Exception{return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
    JsonNode save(RecommendationPost p,String date,String ref,String sourceHash)throws Exception{return data(mvc.perform(put(path(p)).header("Authorization","Bearer "+ownerToken).contentType(MediaType.APPLICATION_JSON).content(body(p,date,ref,sourceHash,true))));}
    @Test void saveAndReopenRetainSourceHistoryPublicationPriceImagesAndArticleHash()throws Exception{
        String articleHash=articles.sourceHash(issue);var originalItems=items.findByPostIdOrderById(issue.id);var gallery=originalItems.get(0).gallery;var publishedAt=issue.publishedAt;
        var unknown=data(mvc.perform(get(path(issue)).header("Authorization","Bearer "+ownerToken)));assertThat(unknown.path("source").asText()).isEqualTo("UNKNOWN");assertThat(unknown.path("issueDate").isNull()).isTrue();
        var saved=save(issue,"2026-10-31","message:synthetic-source-1",hash);assertThat(saved.path("reviewedBy").asLong()).isEqualTo(owner.getId());assertThat(saved.path("source").asText()).isEqualTo("REVIEWED_SOURCE");
        issue=posts.findById(issue.id).orElseThrow();var reopened=data(mvc.perform(get(path(issue)).header("Authorization","Bearer "+ownerToken)));assertThat(reopened.path("issueDate").asText()).isEqualTo("2026-10-31");assertThat(reopened.path("sourceRef").asText()).isEqualTo("message:synthetic-source-1");
        assertThat(issue.published).isTrue();assertThat(issue.publishedAt).isEqualTo(publishedAt);assertThat(issue.body).isEqualTo("Retained original source body");assertThat(articles.sourceHash(issue)).isEqualTo(articleHash);
        var retained=items.findByPostIdOrderById(issue.id);assertThat(retained).hasSize(1);assertThat(retained.get(0).referencePrice).isEqualByComparingTo("265.00");assertThat(retained.get(0).gallery).isEqualTo(gallery);assertThat(retained.get(0).description).contains("not permission to purchase");
        var history=revisions.findByMerchantIdAndPostIdOrderById(owner.getId(),issue.id);assertThat(history).hasSize(2);assertThat(history.get(0).facts).doesNotContainKey("issueDateReview");assertThat(history.get(1).facts.toString()).contains("2026-10-31","message:synthetic-source-1",hash);
        long version=issue.version;String reviewedAt=reopened.path("reviewedAt").asText();save(issue,"2026-10-31","message:synthetic-source-1",hash);assertThat(issue.version).isEqualTo(version);assertThat(revisions.findByMerchantIdAndPostIdOrderById(owner.getId(),issue.id)).hasSize(2);
        save(issue,"2026-11-01","https://example.invalid/corrected-source","b".repeat(64));assertThat(revisions.findByMerchantIdAndPostIdOrderById(owner.getId(),issue.id)).hasSize(3);assertThat(history.get(1).facts.toString()).contains("message:synthetic-source-1");assertThat(reviewedAt).isNotBlank();
        var publicView=data(mvc.perform(get("/api/storefront/recommendations/"+issue.id)));assertThat(publicView.at("/post/issueDate").asText()).isEqualTo("2026-11-01");assertThat(publicView.at("/post/issueDateSource").asText()).isEqualTo("REVIEWED_SOURCE");assertThat(publicView.toString()).doesNotContain("message:synthetic-source-1","corrected-source","issueDateReviewedBy","issueDateSourceHash");
    }
    @Test void ownershipRolesReviewWhitelistAndStaleVersionAreEnforced()throws Exception{
        String request=body(issue,"2026-10-31","message:synthetic-source",hash,true);
        mvc.perform(get(path(issue))).andExpect(status().isForbidden());mvc.perform(get(path(issue)).header("Authorization","Bearer "+customerToken)).andExpect(status().isForbidden());mvc.perform(get(path(issue)).header("Authorization","Bearer "+otherToken)).andExpect(status().isNotFound());
        mvc.perform(put(path(issue)).header("Authorization","Bearer "+otherToken).contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isNotFound());
        mvc.perform(put(path(issue)).header("Authorization","Bearer "+customerToken).contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isForbidden());
        mvc.perform(put(path(issue)).header("Authorization","Bearer "+ownerToken).contentType(MediaType.APPLICATION_JSON).content(request.substring(0,request.length()-1)+",\"reviewedBy\":999}")).andExpect(status().isBadRequest());
        mvc.perform(put(path(issue)).header("Authorization","Bearer "+ownerToken).contentType(MediaType.APPLICATION_JSON).content(body(issue,"2026-10-31","message:synthetic-source",hash,false))).andExpect(status().isBadRequest());
        data(mvc.perform(put(path(issue)).header("Authorization","Bearer "+ownerToken).contentType(MediaType.APPLICATION_JSON).content(request)));
        mvc.perform(put(path(issue)).header("Authorization","Bearer "+ownerToken).contentType(MediaType.APPLICATION_JSON).content(request)).andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("RECOMMENDATION_CHANGED"));assertThat(revisions.findByMerchantIdAndPostIdOrderById(owner.getId(),issue.id)).hasSize(2);
    }
    @Test void publicDateSortingUsesExplicitCalendarDayBeforePagingAndUnknownLast()throws Exception{
        var sameDay=issue();var latest=issue();var unknown=issue();
        save(issue,"2026-10-31","message:source-old",hash);save(sameDay,"2026-10-31","message:source-same",hash);save(latest,"2026-11-01","message:source-latest",hash);
        issue.updatedAt=LocalDateTime.of(2099,1,1,0,0);posts.saveAndFlush(issue);
        var result=data(mvc.perform(get("/api/storefront/recommendation-browse/issues").param("merchantId",owner.getId().toString()).param("locale","en-US")));
        var ids=new ArrayList<Long>();result.path("items").forEach(row->ids.add(row.at("/post/id").asLong()));assertThat(ids).containsExactly(latest.id,sameDay.id,issue.id,unknown.id);
        assertThat(result.at("/items/0/issueDate").asText()).isEqualTo("2026-11-01");assertThat(result.at("/items/0/publicItemCount").asInt()).isEqualTo(1);assertThat(result.at("/items/3/issueDate").isNull()).isTrue();assertThat(result.at("/items/3/issueDateSource").asText()).isEqualTo("UNKNOWN");
    }
}
