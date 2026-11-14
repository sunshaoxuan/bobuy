package com.bobbuy.service;
import com.bobbuy.model.*;import com.bobbuy.repository.*;import com.bobbuy.security.BobbuyAuthenticatedUser;
import java.nio.charset.StandardCharsets;import java.time.*;import java.util.*;
import org.junit.jupiter.api.*;import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;import org.springframework.security.core.authority.SimpleGrantedAuthority;import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.*;import static org.mockito.Mockito.*;

class RecommendationRepairServiceTest {
 final RecommendationPostRepository posts=mock(RecommendationPostRepository.class);final RecommendationItemRepository items=mock(RecommendationItemRepository.class);final RecommendationSourceArtifactRepository artifacts=mock(RecommendationSourceArtifactRepository.class);final ProductRepository products=mock(ProductRepository.class);final UserRepository users=mock(UserRepository.class);final LlmGateway llm=mock(LlmGateway.class);
 RecommendationRepairService service;RecommendationPost post;
 @BeforeEach void setup(){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new BobbuyAuthenticatedUser(7L,"synthetic","Synthetic",Set.of(Role.AGENT)),null,List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));service=new RecommendationRepairService(posts,items,artifacts,products,users,llm);post=new RecommendationPost();post.id=12L;post.merchantId=7L;post.version=4;post.issueDate=LocalDate.of(2026,11,1);post.issueDateSourceRef="message:synthetic-source";post.issueDateSourceHash="a".repeat(64);post.issueDateReviewedBy=7L;post.issueDateReviewedAt=Instant.now();when(posts.findByIdAndMerchantId(12L,7L)).thenReturn(Optional.of(post));when(users.lockById(7L)).thenReturn(Optional.of(mock(User.class)));}
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 @Test void twentyItemPreviewUsesOnlyActualUniqueUrlAndLeavesAmbiguousChannelBlank(){var artifact=new RecommendationSourceArtifact();artifact.sourceRef=post.issueDateSourceRef;artifact.content="offer https://www.costco.co.jp/reviewed-page".getBytes(StandardCharsets.UTF_8);when(artifacts.findBySourceRef(artifact.sourceRef)).thenReturn(Optional.of(artifact));var rows=new ArrayList<RecommendationItem>();for(long id=1;id<=20;id++){var i=new RecommendationItem();i.id=id;i.postId=12L;i.referenceContext=new ReferenceOfferContext(null,null,null,null,null,null,null,false,null,false);rows.add(i);}when(items.findByPostIdOrderById(12L)).thenReturn(rows);
  var preview=service.previewSource(12L,false);assertThat(preview.items()).hasSize(20);assertThat(preview.items()).allSatisfy(row->{assertThat(row.fields()).anySatisfy(f->{if(f.field().equals("sourceUrl"))assertThat(f.suggestedValue()).isEqualTo("https://www.costco.co.jp/reviewed-page");});assertThat(row.fields()).anySatisfy(f->{if(f.field().equals("channel")){assertThat(f.suggestedValue()).isNull();assertThat(f.unresolvedReason()).isNotBlank();}});});verify(items,never()).save(any());verify(posts,never()).saveAndFlush(any());
 }
 @Test void confirmedSupplierOnlyRepairPreservesOtherContext(){var i=new RecommendationItem();i.id=389L;i.postId=12L;i.productId="82848";i.referenceContext=new ReferenceOfferContext(null,"COSTCO_WAREHOUSE","variant","message:kept","https://www.costco.co.jp/kept",null,null,false,null,false);when(items.findByPostIdOrderById(12L)).thenReturn(List.of(i));when(items.findById(389L)).thenReturn(Optional.of(i));var p=new Product();p.setId("82848");p.setMerchantId(7L);p.setCatalogData(new ProductCatalogData(Map.of("ja-JP","仕様"),null,null,List.of(),"costco-jp",null,7L,Instant.now()));when(products.findById("82848")).thenReturn(Optional.of(p));when(posts.saveAndFlush(post)).thenReturn(post);
  service.applySource(12L,4,false,service.previewSource(12L,false));assertThat(i.referenceContext.supplierKey()).isEqualTo("costco-jp");assertThat(i.referenceContext.channel()).isEqualTo("COSTCO_WAREHOUSE");assertThat(i.referenceContext.sourceMessageKey()).isEqualTo("message:kept");assertThat(i.referenceContext.sourceUrl()).isEqualTo("https://www.costco.co.jp/kept");verify(items).save(i);
 }
 private Product product(Map<String,String> names,Map<String,String> specs,String hash){
  var p=new Product();p.setId("p");p.setMerchantId(7L);p.setRecordVersion(2L);p.setName(names);p.setCatalogData(new ProductCatalogData(specs,null,null,List.of(),null,hash,7L,Instant.parse("2026-11-01T00:00:00Z")));when(products.findById("p")).thenReturn(Optional.of(p));var i=new RecommendationItem();i.id=1L;i.postId=12L;i.productId="p";when(items.findByPostIdOrderById(12L)).thenReturn(List.of(i));when(items.findById(1L)).thenReturn(Optional.of(i));return p;
 }
 private RecommendationRepairService.LocaleEdit edit(String field,String locale,String value){return new RecommendationRepairService.LocaleEdit("p",2,field,locale,value);}
 private void hash(Product p,String hash){var d=p.getCatalogData();p.setCatalogData(new ProductCatalogData(d.specification(),d.model(),d.packaging(),d.categoryIds(),d.supplierId(),hash,d.reviewedBy(),d.reviewedAt()));}
 @Test void suggestionsAreAiLabeledDeduplicatedAndDoNotWriteUntilConfirmed(){
  var p=product(Map.of("ja-JP","お茶"),Map.of("ja-JP","一箱"),null);var i=items.findByPostIdOrderById(12L).get(0);when(items.findByPostIdOrderById(12L)).thenReturn(List.of(i,i));when(llm.translate(anyString(),anyString())).thenReturn(Optional.of("AI text"));
  var preview=service.suggestLocales(12L);assertThat(preview.suggestions()).hasSize(6).allSatisfy(s->{assertThat(s.aiSuggested()).isTrue();assertThat(s.suggestion()).isEqualTo("AI text");});verify(llm,times(6)).translate(anyString(),anyString());verify(products,never()).saveAndFlush(any());assertThat(p.getName()).containsOnlyKeys("ja-JP");
  service.applyLocales(12L,4,List.of(edit("name","en-US","Reviewed tea")));assertThat(p.getName()).containsEntry("en-US","Reviewed tea");verify(products).saveAndFlush(p);
 }
 @Test void aiFailuresLeaveMissingLocalesBlank(){
  var p=product(Map.of("ja-JP","お茶"),Map.of("ja-JP","一箱"),null);when(llm.translate(anyString(),anyString())).thenThrow(new RuntimeException("unavailable"));
  assertThat(service.suggestLocales(12L).suggestions()).hasSize(6).allSatisfy(s->{assertThat(s.aiSuggested()).isFalse();assertThat(s.suggestion()).isNull();assertThat(s.error()).isNotBlank();});assertThat(p.getName()).containsOnlyKeys("ja-JP");verify(products,never()).saveAndFlush(any());
 }
 @Test void blankFillPreservesStaleHashAndReviewTimestamp(){
  var p=product(Map.of("ja-JP","新しいお茶","zh-CN","旧茶"),Map.of("ja-JP","一箱"),"old-source");var reviewed=p.getCatalogData().reviewedAt();service.applyLocales(12L,4,List.of(edit("name","en-US","Tea")));
  assertThat(p.getCatalogData().translatedSource()).isEqualTo("old-source");assertThat(ProductCatalogService.translationsCurrent(p)).isFalse();assertThat(p.getCatalogData().reviewedAt()).isEqualTo(reviewed);
 }
 @Test void blankFillPreservesCurrentHashForUnchangedJapanese(){
  var p=product(Map.of("ja-JP","お茶","zh-CN","茶"),Map.of("ja-JP","一箱"),null);hash(p,ProductCatalogService.sourceHash(p));String prior=p.getCatalogData().translatedSource();service.applyLocales(12L,4,List.of(edit("name","en-US","Tea")));assertThat(p.getCatalogData().translatedSource()).isEqualTo(prior);assertThat(ProductCatalogService.translationsCurrent(p)).isTrue();
 }
 @Test void blankFillPreservesAbsentProvenanceEvenWithoutExistingTranslations(){
  var p=product(Map.of("ja-JP","お茶"),Map.of("ja-JP","箱"),null);service.applyLocales(12L,4,List.of(edit("name","en-US","Tea")));assertThat(p.getCatalogData().translatedSource()).isNull();assertThat(ProductCatalogService.translationsCurrent(p)).isFalse();
 }
 @Test void localeApplyRejectsOverwritingExistingText(){
  var p=product(Map.of("ja-JP","お茶","en-US","Reviewed tea"),Map.of("ja-JP","箱"),"old");assertThatThrownBy(()->service.applyLocales(12L,4,List.of(edit("name","en-US","Replacement")))).isInstanceOf(com.bobbuy.api.response.ApiException.class);assertThat(p.getName().get("en-US")).isEqualTo("Reviewed tea");verify(products,never()).saveAndFlush(any());
 }
 @Test void newJapaneseFieldsAreInstalledBeforeHashWhenAllExistingTranslationsReviewed(){
  var p=product(Map.of("zh-CN","茶"),Map.of("zh-CN","一箱"),"old");service.applyLocales(12L,4,List.of(edit("name","zh-CN","茶"),edit("specification","zh-CN","一箱"),edit("name","ja-JP","お茶"),edit("specification","ja-JP","箱")));
  assertThat(p.getCatalogData().specification()).containsEntry("ja-JP","箱");assertThat(p.getCatalogData().translatedSource()).isEqualTo(ProductCatalogService.sourceHash(p));assertThat(ProductCatalogService.translationsCurrent(p)).isTrue();
 }
 @Test void newJapaneseSourceDoesNotApproveUnreviewedExistingTranslations(){
  var p=product(Map.of("zh-CN","茶"),Map.of("zh-CN","一箱"),"old");service.applyLocales(12L,4,List.of(edit("name","ja-JP","お茶"),edit("specification","ja-JP","箱")));assertThat(p.getCatalogData().translatedSource()).isEqualTo("old");assertThat(ProductCatalogService.translationsCurrent(p)).isFalse();
 }
 @Test void existingDescriptionTranslationsKeepStaleProvenance(){
  var p=product(Map.of("ja-JP","お茶"),Map.of("ja-JP","箱"),"old");p.setDescription(Map.of("en-US","Old description"));service.applyLocales(12L,4,List.of(edit("name","en-US","Tea")));assertThat(p.getCatalogData().translatedSource()).isEqualTo("old");
 }
 @Test void changedProductVersionRejectsSourceConfirmationWithoutWrites(){
  var p=product(Map.of(),Map.of(),null);var preview=service.previewSource(12L,false);p.setRecordVersion(3L);assertThatThrownBy(()->service.applySource(12L,4,false,preview)).isInstanceOf(com.bobbuy.api.response.ApiException.class);verify(items,never()).save(any());verify(posts,never()).saveAndFlush(any());
 }
 @Test void changedDerivedValueRejectsSourceConfirmationWithoutWrites(){
  product(Map.of(),Map.of(),null);var preview=service.previewSource(12L,false);post.issueDateSourceRef="message:changed";assertThatThrownBy(()->service.applySource(12L,4,false,preview)).isInstanceOf(com.bobbuy.api.response.ApiException.class);verify(items,never()).save(any());
 }
 @Test void supplierFallsBackFromBlankCatalogToAttributes(){
  var p=product(Map.of(),Map.of(),null);p.setAttributes(Map.of("referenceSupplierKey","known-supplier"));assertThat(service.previewSource(12L,false).items().get(0).fields().get(0).suggestedValue()).isEqualTo("known-supplier");
 }
 @Test void supplierUsesUniquePostDefaultAndLeavesUnknownBlank(){
  product(Map.of(),Map.of(),null);assertThat(service.previewSource(12L,false).items().get(0).fields().get(0).suggestedValue()).isNull();post.issueDateSourceRef="https://www.costco.co.jp/offer";assertThat(service.previewSource(12L,false).items().get(0).fields().get(0).suggestedValue()).isEqualTo("costco-jp");
 }
 @Test void artifactsNeverAppearInSerializedPreview() throws Exception {
  product(Map.of(),Map.of(),null);var a=new RecommendationSourceArtifact();a.content="PRIVATE_ARTIFACT_BYTES https://www.costco.co.jp/offer".getBytes(StandardCharsets.UTF_8);when(artifacts.findBySourceRef(anyString())).thenReturn(Optional.of(a));String json=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(service.previewSource(12L,false));assertThat(json).doesNotContain("PRIVATE_ARTIFACT_BYTES","content",Base64.getEncoder().encodeToString(a.content));
 }
}
