package com.bobbuy.service;
import static com.bobbuy.test.RecommendationPublicationFixtures.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReferenceQuoteTest {
 ReferenceOfferContext context(LocalDate a,LocalDate b,boolean applies){return new ReferenceOfferContext("supplier","COSTCO_WAREHOUSE","1650g","mail-1","https://www.costco.co.jp/source",a,b,applies,"Original section explicitly includes this item",true);}
 RecommendationItem item(long id,String price,String start,String end){var i=new RecommendationItem();i.id=id;i.postId=1L;i.productId="master";i.itemNumber="00123";i.name="Synthetic";i.referencePrice=new BigDecimal(price);i.priceUnit="1650g";i.offerStart=start==null?null:LocalDate.parse(start);i.offerEnd=end==null?null:LocalDate.parse(end);i.referenceContext=context(null,null,false);return i;}
 Instant at(String date){return LocalDate.parse(date).atStartOfDay(ZoneId.of("Asia/Tokyo")).toInstant();}
 @Test void itemDatesWinAndOnlyExplicitlyApplicableActivityCanFillMissingBounds(){
  var ctx=context(LocalDate.parse("2026-11-02"),LocalDate.parse("2026-11-22"),true);
  var w=ReferenceOfferWindow.resolve(LocalDate.parse("2026-11-05"),null,ctx);assertThat(w.start()).isEqualTo("2026-11-05");assertThat(w.end()).isEqualTo("2026-11-22");assertThat(w.startBasis()).isEqualTo("ITEM");assertThat(w.endBasis()).isEqualTo("ACTIVITY");
  assertThat(ReferenceOfferWindow.resolve(null,null,context(ctx.activityStart(),ctx.activityEnd(),false)).complete()).isFalse();
 }
 @Test void unknownStartNeverUsesReceiptTimeOrBecomesExpired(){var w=ReferenceOfferWindow.resolve(null,LocalDate.parse("2026-10-01"),context(null,null,false));assertThat(w.start()).isNull();assertThat(w.state(Instant.parse("2026-12-01T00:00:00Z"))).isEqualTo("UNKNOWN");}
 @Test void inheritedWindowRequiresEvidenceAndCannotProduceAnInvertedItemRange(){
  var bad=new ReferenceOfferContext("s","COSTCO_WAREHOUSE","v","mail",null,LocalDate.parse("2026-11-02"),null,true,null,true);
  assertThatThrownBy(()->ReferenceOfferWindow.resolve(null,null,bad)).isInstanceOf(RuntimeException.class);
  assertThatThrownBy(()->ReferenceOfferWindow.resolve(LocalDate.parse("2026-11-23"),null,context(null,LocalDate.parse("2026-11-22"),true))).isInstanceOf(RuntimeException.class);
 }
 @Test void jstInclusiveEndFutureAndFallbackUseOnlyKnownWindows(){
  var old=item(1,"100","2026-11-01","2026-11-08"); var next=item(2,"80","2026-11-09","2026-11-15");
  assertThat(ReferenceQuoteService.resolve(old,List.of(old,next),at("2026-11-08").plusSeconds(86399)).amount()).isEqualByComparingTo("100");
  assertThat(ReferenceQuoteService.resolve(old,List.of(old,next),at("2026-11-09")).amount()).isEqualByComparingTo("80");
  assertThat(ReferenceQuoteService.resolve(old,List.of(old,next),at("2026-11-16")).state()).isEqualTo("NO_ACTIVE_OFFER");
  assertThat(ReferenceQuoteService.resolve(old,List.of(next),at("2026-11-08")).amount()).isNull();
 }
 @Test void overlappingDifferentPricesConflictInsteadOfChoosingNewerMail(){
  var a=item(1,"100","2026-11-01","2026-11-30"); var b=item(2,"80","2026-11-09","2026-11-15");
  assertThat(ReferenceQuoteService.resolve(a,List.of(a,b),at("2026-11-10")).state()).isEqualTo("CONFLICT");
  assertThat(ReferenceQuoteService.resolve(a,List.of(a,b),at("2026-11-16")).amount()).isEqualByComparingTo("100");
  b.referencePrice=new BigDecimal("100.00");assertThat(ReferenceQuoteService.resolve(a,List.of(a,b),at("2026-11-10")).amount()).isEqualByComparingTo("100");
 }
 @Test void channelsUnitsVariantsAndIncompleteDatesNeverMerge(){
  var a=item(1,"100","2026-11-01","2026-11-30"); var b=item(2,"80","2026-11-09","2026-11-15");var c=b.referenceContext;
  b.referenceContext=new ReferenceOfferContext(c.supplierKey(),"COSTCO_ONLINE",c.variantKey(),c.sourceMessageKey(),c.sourceUrl(),null,null,false,null,true);
  assertThat(ReferenceQuoteService.resolve(a,List.of(a,b),at("2026-11-10")).amount()).isEqualByComparingTo("100");
  b.referenceContext=a.referenceContext;b.priceUnit="100g";assertThat(ReferenceQuoteService.resolve(a,List.of(a,b),at("2026-11-10")).amount()).isEqualByComparingTo("100");
  b.priceUnit=a.priceUnit;b.offerStart=null;assertThat(ReferenceQuoteService.resolve(a,List.of(b),at("2026-11-10")).state()).isEqualTo("UNKNOWN");
 }
 @Test void identitiesExcludeImagesAndAllowIndependentPeriodsAndHistoryAtoBtoA()throws Exception{
  var repo=mock(ReferenceQuoteRevisionRepository.class);var service=new ReferenceQuoteService(repo,new ObjectMapper().findAndRegisterModules(),mock(RecommendationItemRepository.class),mock(RecommendationPostRepository.class));
  var a=item(1,"100","2026-11-01","2026-11-08");String identity=service.identity(a);a.imageHash="different-image";assertThat(service.identity(a)).isEqualTo(identity);a.name="Renamed master";assertThat(service.identity(a)).isEqualTo(identity);a.offerEnd=LocalDate.parse("2026-11-09");assertThat(service.identity(a)).isNotEqualTo(identity);
  var latest=new ReferenceQuoteRevision[1];when(repo.findFirstByItemIdOrderByIdDesc(1L)).thenAnswer(call->Optional.ofNullable(latest[0]));when(repo.saveAndFlush(any())).thenAnswer(call->{latest[0]=call.getArgument(0);return latest[0];});
  service.snapshot(a,1000L);service.snapshot(a,1000L);a.referencePrice=new BigDecimal("80");service.snapshot(a,1000L);a.referencePrice=new BigDecimal("100");service.snapshot(a,1000L);verify(repo,times(3)).saveAndFlush(any());
 }
 @Test void publicProjectionNeverUsesDraftQuotesAndRedactsInternalSourceIdentity(){
  var repository=mock(RecommendationItemRepository.class);var posts=mock(RecommendationPostRepository.class);var service=new ReferenceQuoteService(mock(ReferenceQuoteRevisionRepository.class),new ObjectMapper().findAndRegisterModules(),repository,posts);
  var today=LocalDate.now(ZoneId.of("Asia/Tokyo"));var visible=item(1,"100",today.minusDays(1).toString(),today.plusDays(1).toString());var draft=item(2,"1",today.minusDays(1).toString(),today.plusDays(1).toString());draft.postId=2L;
  var published=new RecommendationPost();published.id=1L;published.merchantId=1000L;legacyPost(published);legacyItem(visible,published);
  assertThat(RecommendationPublication.visible(visible)).isTrue();assertThat(RecommendationPublication.visible(draft)).isFalse();
  when(posts.findByPublishedTrue()).thenReturn(List.of(published));when(repository.findByProductIdInOrderById(List.of("master"))).thenReturn(List.of(visible,draft));
  service.decorate(List.of(visible),true);assertThat(visible.referenceQuote.state()).isEqualTo("ACTIVE");assertThat(visible.referenceQuote.amount()).isEqualByComparingTo("100");assertThat(visible.referenceContext.sourceMessageKey()).isNull();assertThat(visible.referenceContext.supplierKey()).isNull();
  var unlinked=item(3,"1",null,null);unlinked.productId=null;service.decorate(List.of(unlinked),true);assertThat(unlinked.referenceContext.sourceMessageKey()).isNull();
 }
 @Test void frozenSourceItemScopesQuotesDespiteCatalogDisplayAndLaterLiveEdits()throws Exception{
  var repository=mock(RecommendationItemRepository.class);var posts=mock(RecommendationPostRepository.class);var json=new ObjectMapper().findAndRegisterModules();var service=new ReferenceQuoteService(mock(ReferenceQuoteRevisionRepository.class),json,repository,posts);
  var post=new RecommendationPost();post.id=1L;post.merchantId=1000L;legacyPost(post);when(posts.findByPublishedTrue()).thenReturn(List.of(post));
  var master=new Product();master.setId("master");master.setMerchantId(1000L);master.setName(Map.of("ja-JP","Displayed master"));master.setItemNumber("MASTER ITEM");master.setCatalogData(new ProductCatalogData(Map.of("ja-JP","Frozen master spec"),null,null,List.of(),null,null,null,null));
  var original=item(1,"100","2000-01-01","2099-01-01");original.itemNumber="SOURCE ITEM";original.imageUrl="https://example.invalid/source-price-image.jpg";original.imageHash="a".repeat(64);reviewedReadItem(original,master,post);
  byte[] frozen=json.writeValueAsBytes(original.publicationSnapshot);var display=RecommendationPublication.project(original,original.publicationSnapshot);assertThat(display.itemNumber).isEqualTo("MASTER ITEM");
  when(repository.findByProductIdInOrderById(List.of("master"))).thenReturn(List.of(original));service.decorate(List.of(display),true);
  assertThat(display.referenceQuote.state()).isEqualTo("NO_ACTIVE_OFFER");assertThat(display.referenceQuote.amount()).isNull();
  var matching=item(2,"80","2000-01-01","2099-01-01");matching.itemNumber="MASTER ITEM";reviewedReadItem(matching,master,post);
  // Editing either live row cannot rewrite its previously public occurrence or lend it a new quote scope.
  original.itemNumber="MASTER ITEM";original.referencePrice=BigDecimal.ONE;original.imageUrl="https://example.invalid/edited-source.jpg";master.setItemNumber("EDITED MASTER ITEM");
  when(repository.findByProductIdInOrderById(List.of("master"))).thenReturn(List.of(original,matching));var retainedDisplay=RecommendationPublication.project(original,original.publicationSnapshot);service.decorate(List.of(retainedDisplay),true);
  assertThat(retainedDisplay.itemNumber).isEqualTo("MASTER ITEM");assertThat(retainedDisplay.referenceQuote.state()).isEqualTo("ACTIVE");assertThat(retainedDisplay.referenceQuote.amount()).isEqualByComparingTo("80");assertThat(retainedDisplay.referenceQuote.itemIds()).containsExactly(2L);
  assertThat(json.writeValueAsBytes(original.publicationSnapshot)).containsExactly(frozen);assertThat(original.publicationSnapshot.itemNumber()).isEqualTo("SOURCE ITEM");assertThat(original.publicationSnapshot.referencePrice()).isEqualByComparingTo("100");assertThat(original.publicationSnapshot.imageUrl()).isEqualTo("https://example.invalid/source-price-image.jpg");
  assertThat(retainedDisplay.referenceContext.sourceMessageKey()).isNull();assertThat(original.publicationSnapshot.referenceContext().sourceMessageKey()).isEqualTo("mail-1");
 }
}
