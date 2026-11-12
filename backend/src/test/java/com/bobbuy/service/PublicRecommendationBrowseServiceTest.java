package com.bobbuy.service;
import com.bobbuy.model.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class PublicRecommendationBrowseServiceTest {
 @Test void priceSortingUsesRestoredOriginalAndFutureRegularPriceWithActualSalesFirst(){
  var expired=item(1);expired.productId="p1";expired.referencePrice=new java.math.BigDecimal("100");expired.originalPrice=new java.math.BigDecimal("1000");com.bobbuy.test.PriceDocumentFixtures.end(expired,LocalDate.of(2000,1,1));
  var ordinary=item(2);ordinary.productId="p2";ordinary.referencePrice=new java.math.BigDecimal("500");
  var future=item(3);future.productId="p3";future.referencePrice=new java.math.BigDecimal("50");future.originalPrice=new java.math.BigDecimal("800");com.bobbuy.test.PriceDocumentFixtures.start(future,LocalDate.of(2099,1,1));
  var unknown=item(4);unknown.productId="p4";unknown.referencePrice=new java.math.BigDecimal("25");unknown.discountAmount=new java.math.BigDecimal("5");com.bobbuy.test.PriceDocumentFixtures.end(unknown,LocalDate.of(2000,1,1));
  com.bobbuy.test.PriceDocumentFixtures.window(expired,LocalDate.of(1999,1,1),LocalDate.of(2000,1,1));com.bobbuy.test.PriceDocumentFixtures.window(future,LocalDate.of(2099,1,1),LocalDate.of(2099,12,31));unknown.priceChange=null;com.bobbuy.test.PriceDocumentFixtures.window(ordinary,java.time.LocalDate.of(2000,1,1),java.time.LocalDate.of(2099,1,1));recommendations.rows=List.of(issue(1,List.of(expired,ordinary,future,unknown)));
  assertThat(service.page(0,null,null,"ja-JP","all","","",null,"price-asc").items()).extracting(r->r.item().id()).containsExactly(2L,3L,1L,4L);
  assertThat(service.page(0,null,null,"ja-JP","all","","",null,"price-desc").items()).extracting(r->r.item().id()).containsExactly(1L,3L,2L,4L);
  var actual=new PublicBrowsePriceService(null,null){@Override public Map<String,Price> prices(Collection<String> ids){return Map.of("p1",new Price(new java.math.BigDecimal("300"),"JPY"));}};
  assertThat(new PublicRecommendationBrowseService(recommendations,null,null,actual).page(0,null,null,"ja-JP","all","","",null,"price-asc").items()).extracting(r->r.item().id()).containsExactly(1L,2L,3L,4L);assertThat(expired.referencePrice).isEqualByComparingTo("100");
 }
 private static class Recommendations extends RecommendationService {
  List<Detail> rows=List.of();int reads;
  Recommendations(){super(null,null,null,null,null,null,null,null,null,null,null,null);}
  @Override public List<Detail> publicBrowseEntries(Long merchant){reads++;return rows;}
 }
 private final Recommendations recommendations=new Recommendations();
 private final PublicRecommendationBrowseService service=new PublicRecommendationBrowseService(recommendations);
 private RecommendationItem item(long id){var i=new RecommendationItem();i.id=id;i.productId="same-product";i.name="Name "+id;i.itemNumber="ITEM"+id;i.categoryIds=List.of("c");i.categories=List.of(new RecommendationItem.Label("c",Map.of("en-US","Category")));i.description="FULL DESCRIPTION NOT FOR CARDS";i.gallery=List.of(new RecommendationItem.Picture("first","https://example.invalid/first",null,null,null,null,null),new RecommendationItem.Picture("second","https://example.invalid/second",null,null,null,null,null));return i;}
 private RecommendationService.Detail issue(long id,List<RecommendationItem> items){return new RecommendationService.Detail(new RecommendationService.Summary(id,"Issue "+id,true,1,LocalDateTime.of(2026,1,1,0,0),Instant.parse("2026-01-01T00:00:00Z"),"Owner",null,1L,Map.of()),"BODY",items,"ja-JP","hash",Map.of(),null);}
 @Test void occurrencesAcrossIssuesRemainDistinctWith24BatchAndGlobalFacets(){var items=new ArrayList<RecommendationItem>();for(int n=0;n<30;n++)items.add(item(n));var a=issue(2,items);var b=issue(1,List.of(item(0)));recommendations.rows=List.of(a,b);var first=service.page(0,null,null,"ja-JP","all","","",null);var last=service.page(1,null,null,"ja-JP","all","","",first.revision());assertThat(first.items()).hasSize(24);assertThat(first.scopeTotal()).isEqualTo(31);assertThat(first.categories().get(0).count()).isEqualTo(31);assertThat(last.items()).hasSize(7);assertThat(last.items()).extracting(PublicRecommendationBrowseService.Occurrence::key).contains("2:24","1:0");assertThat(first.items().get(0).item().image().id()).isEqualTo("first");assertThat(last.hasNext()).isFalse();}
 @Test void localeSearchMatchesTranslationAndOriginalWithReviewStatus(){var i=item(7);i.translations=Map.of("en-US",new RecommendationItem.Text("Needle",null,null,null));i.translatedSource=i.getTranslationSource();recommendations.rows=List.of(issue(1,List.of(i)));assertThat(service.page(0,null,null,"en-US","all","needle","",null).matchedTotal()).isEqualTo(1);assertThat(service.page(0,null,null,"en-US","all","name 7","",null).matchedTotal()).isEqualTo(1);i.name="Changed";assertThat(service.page(0,null,null,"en-US","all","needle","",null).matchedTotal()).isZero();}
 @Test void expiryRetainsUnknownStartAndOpenCouponAndSupportsInheritedWindow(){var i=item(1);com.bobbuy.test.PriceDocumentFixtures.end(i,LocalDate.of(2000,1,2));assertThat(PublicRecommendationBrowseService.expired(issue(1,List.of(i)),LocalDate.of(2026,1,1))).isFalse();com.bobbuy.test.PriceDocumentFixtures.start(i,LocalDate.of(2000,1,1));assertThat(PublicRecommendationBrowseService.expired(issue(1,List.of(i)),LocalDate.of(2026,1,1))).isTrue();i.couponStart=LocalDate.of(2026,1,1);assertThat(PublicRecommendationBrowseService.expired(issue(1,List.of(i)),LocalDate.of(2026,1,1))).isFalse();i.couponStart=null;com.bobbuy.test.PriceDocumentFixtures.start(i,null);com.bobbuy.test.PriceDocumentFixtures.end(i,null);i.referenceContext=new ReferenceOfferContext(null,"COSTCO_ONLINE",null,null,"https://example.invalid/source",LocalDate.of(2000,1,1),LocalDate.of(2000,1,2),true,"explicit header",true);assertThat(PublicRecommendationBrowseService.expired(issue(1,List.of(i)),LocalDate.of(2026,1,1))).isFalse();com.bobbuy.test.PriceDocumentFixtures.window(i,LocalDate.of(2000,1,1),LocalDate.of(2000,1,2));assertThat(PublicRecommendationBrowseService.expired(issue(1,List.of(i)),LocalDate.of(2026,1,1))).isTrue();}
 @Test void directoryAndItemsShareDatasetRevisionButNotQueryTokens(){recommendations.rows=List.of(issue(1,List.of(item(1))));var directory=service.directory(0,null,"ja-JP","all","",null);var page=service.page(0,null,null,"ja-JP","all","","",null);assertThat(directory.datasetRevision()).isEqualTo(page.datasetRevision());assertThat(directory.revision()).isNotEqualTo(page.revision());assertThatThrownBy(()->service.page(1,null,null,"ja-JP","all","","",directory.revision())).isInstanceOf(PublicProductBrowseService.Changed.class);recommendations.rows=List.of();assertThatThrownBy(()->service.page(1,null,null,"ja-JP","all","","",page.revision())).isInstanceOf(PublicProductBrowseService.Changed.class);}
 @Test void issueScopeCategoryAndHistoryAreAppliedBeforePaging(){var current=item(1);var expired=item(2);com.bobbuy.test.PriceDocumentFixtures.start(expired,LocalDate.of(2000,1,1));com.bobbuy.test.PriceDocumentFixtures.end(expired,LocalDate.of(2000,1,2));expired.categoryIds=List.of();expired.categories=List.of();recommendations.rows=List.of(issue(2,List.of(current)),issue(1,List.of(expired)));assertThat(service.page(0,1L,1L,"ja-JP","current","","",null).items()).isEmpty();var page=service.page(0,1L,1L,"ja-JP","history","","__unclassified",null);assertThat(page.items()).hasSize(1);assertThat(page.unclassified()).isEqualTo(1);assertThat(service.directory(0,1L,"ja-JP","history","",null).items()).extracting(i->i.post().id()).containsExactly(1L);}
 @Test void servicesAreSeparateCardsNeverFakeProductOccurrences(){var offer=new RecommendationServiceOffer("https://example.invalid","source","Bears",2,new java.math.BigDecimal("3"),null,new java.math.BigDecimal("100"),"JPY",true,List.of(),true,null,LocalDate.of(2099,1,1),null,LocalDate.of(2099,1,2),Map.of(),true,true,true);var base=issue(1,List.of());var d=new RecommendationService.Detail(base.post(),"Service text",List.of(),base.articleSourceLocale(),base.articleSourceHash(),Map.of(),offer);recommendations.rows=List.of(d);var p=service.page(0,null,null,"ja-JP","current","Bears","",null);assertThat(p.serviceCards()).isEqualTo(1);assertThat(p.productOccurrences()).isZero();assertThat(p.items().get(0).key()).isEqualTo("1:service");assertThat(p.items().get(0).item()).isNull();assertThat(service.page(0,null,null,"ja-JP","all","","c",null).items()).isEmpty();assertThat(service.directory(0,null,"ja-JP","all","Bears",null).items()).hasSize(1);}
 @Test void invalidQueriesDoNotReadRepository(){assertThatThrownBy(()->service.page(1,null,null,"ja-JP","all","","",null)).isInstanceOf(IllegalArgumentException.class);assertThatThrownBy(()->service.directory(0,null,"en-US","future","",null)).isInstanceOf(IllegalArgumentException.class);assertThat(recommendations.reads).isZero();}
 @Test void taskPackageProjectionKeepsSeparateScopesAndPricesWithoutSourceOrProductIdentity(){
  var options=new ArrayList<RecommendationServiceOffer.PackageOption>();int index=0;for(int price:new int[]{64900,89100,35200,30080}){var labels=new HashMap<String,RecommendationServiceOffer.PackageText>();for(String locale:RecommendationServiceOffer.LOCALES)labels.put(locale,new RecommendationServiceOffer.PackageText(locale+" package",locale+" scope"));options.add(new RecommendationServiceOffer.PackageOption("package-"+index++,labels,null,java.math.BigDecimal.valueOf(price)));}
  var offer=new RecommendationServiceOffer("https://example.invalid/private-source","private mail","Provider",null,null,null,null,"JPY",true,List.of(),true,null,LocalDate.of(2099,1,1),null,LocalDate.of(2099,1,2),Map.of(),true,true,true,RecommendationServiceOffer.Basis.TASK_PACKAGES,options);var base=issue(1,List.of());recommendations.rows=List.of(new RecommendationService.Detail(base.post(),"Service",List.of(),base.articleSourceLocale(),base.articleSourceHash(),Map.of(),offer));
  var result=service.page(0,null,null,"en-US","all","","",null);var row=result.items().get(0);assertThat(row.item()).isNull();assertThat(result.productOccurrences()).isZero();assertThat(result.serviceCards()).isEqualTo(1);assertThat(row.serviceSummary().basis()).isEqualTo(RecommendationServiceOffer.Basis.TASK_PACKAGES);assertThat(row.serviceSummary().staff()).isNull();assertThat(row.serviceSummary().hours()).isNull();assertThat(row.serviceSummary().price()).isNull();assertThat(row.serviceSummary().packages()).extracting(p->p.price().intValueExact()).containsExactly(64900,89100,35200,30080);assertThat(new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().valueToTree(row.serviceSummary()).has("sourceText")).isFalse();
 }
 @Test void directorySeparatesMatchedCountFromWholePublicIssueCount(){
  recommendations.rows=List.of(issue(2,List.of(item(1),item(2),item(3))),issue(1,List.of(item(9))));
  var result=service.directory(0,null,"ja-JP","all","ITEM2",null);
  assertThat(result.total()).isEqualTo(1);var row=result.items().get(0);
  assertThat(row.post().id()).isEqualTo(2L);assertThat(row.itemCount()).isEqualTo(1);assertThat(row.publicItemCount()).isEqualTo(3);
  assertThat(service.directory(0,null,"ja-JP","all","",null).items().get(0).publicItemCount()).isEqualTo(3);
 }
 @Test void directorySupplierAggregationUsesWholeIssueAndOnlyPublicNamedAssociations(){
  var a=item(1);a.showSupplier=true;a.supplierId="b";var names=new HashMap<>(Map.of("ja-JP","供給者B","en-US","Supplier B"));a.supplierName=names;
  var duplicate=item(2);duplicate.showSupplier=true;duplicate.supplierId="b";duplicate.supplierName=names;
  var other=item(3);other.showSupplier=true;other.supplierId="a";other.supplierName=Map.of("ja-JP","供給者A");
  var hidden=item(4);hidden.showSupplier=false;hidden.supplierId="secret";hidden.supplierName=Map.of("ja-JP","Private supplier");
  var unknown=item(5);unknown.showSupplier=true;unknown.supplierId="unknown";unknown.supplierName=Map.of("en-US"," ");
  recommendations.rows=List.of(issue(1,List.of(a,duplicate,other,hidden,unknown)));
  var suppliers=service.directory(0,null,"en-US","all","ITEM1",null).items().get(0).suppliers();
  assertThat(suppliers).extracting(PublicRecommendationBrowseService.SupplierLabel::id).containsExactly("a","b");
  assertThat(suppliers.get(1).name()).containsEntry("en-US","Supplier B");names.put("en-US","Later edit");
  assertThat(suppliers.get(1).name()).containsEntry("en-US","Supplier B");
  assertThatThrownBy(()->suppliers.get(1).name().put("en-US","Mutated")).isInstanceOf(UnsupportedOperationException.class);
 }
 @Test void missingIssueDateIsExplicitUnknownNeverPublicationEditOrOfferDate(){
  var i=item(1);com.bobbuy.test.PriceDocumentFixtures.start(i,LocalDate.of(2026,11,9));com.bobbuy.test.PriceDocumentFixtures.end(i,LocalDate.of(2026,11,10));recommendations.rows=List.of(issue(1,List.of(i)));
  var row=service.directory(0,null,"ja-JP","all","",null).items().get(0);
  assertThat(row.post().publishedAt()).isNotNull();assertThat(row.post().updatedAt()).isNotNull();
  assertThat(row.issueDate()).isNull();assertThat(row.issueDateSource()).isEqualTo("UNKNOWN");
 }
 private PublicRecommendationBrowseService.Issue directoryRow(long id,LocalDate date){
  return new PublicRecommendationBrowseService.Issue(issue(id,List.of(item(id))).post(),"Issue "+id,false,1,false,1,List.of(),date,date==null?"UNKNOWN":"REVIEWED_SOURCE");
 }
 @Test void explicitIssueDateComparatorUsesDateDescendingStableIdsAndUnknownLast(){
  var rows=new ArrayList<>(List.of(directoryRow(99,null),directoryRow(7,LocalDate.of(2026,11,8)),directoryRow(3,LocalDate.of(2026,11,9)),directoryRow(8,LocalDate.of(2026,11,8)),directoryRow(100,null)));
  rows.sort(PublicRecommendationBrowseService.issueOrder());
  assertThat(rows).extracting(r->r.post().id()).containsExactly(3L,8L,7L,100L,99L);
 }
 @Test void unknownDateDirectorySortsBeforePaginationAndIgnoresIncomingRepositoryOrder(){
  var rows=new ArrayList<RecommendationService.Detail>();for(long n=1;n<=25;n++)rows.add(issue(n,List.of(item(n))));
  recommendations.rows=rows;var first=service.directory(0,null,"ja-JP","all","",null);var second=service.directory(1,null,"ja-JP","all","",first.revision());
  assertThat(first.items()).extracting(r->r.post().id()).containsExactly(25L,24L,23L,22L,21L,20L,19L,18L,17L,16L,15L,14L,13L,12L,11L,10L,9L,8L,7L,6L);
  assertThat(second.items()).extracting(r->r.post().id()).containsExactly(5L,4L,3L,2L,1L);
  Collections.reverse(rows);recommendations.rows=rows;
  assertThat(service.directory(0,null,"en-US","all","",null).items()).extracting(r->r.post().id()).containsExactlyElementsOf(first.items().stream().map(r->r.post().id()).toList());
 }
 @Test void editsAndAppendDoNotUseUpdatedOrPublicationTimestampsToPromoteOldUnknownIssue(){
  var old=issue(1,List.of(item(1)));var newer=issue(2,List.of(item(2)));recommendations.rows=List.of(newer,old);
  var before=service.directory(0,null,"ja-JP","all","",null).items().stream().map(r->r.post().id()).toList();
  var p=old.post();var edited=new RecommendationService.Detail(new RecommendationService.Summary(p.id(),"Edited title",true,p.version()+1,LocalDateTime.of(2099,1,1,0,0),Instant.parse("2099-01-01T00:00:00Z"),p.publisherName(),p.coverImageUrl(),p.merchantId(),p.articleTitles()),old.body(),List.of(item(1),item(3)),old.articleSourceLocale(),old.articleSourceHash(),old.articleTranslations(),null);
  recommendations.rows=List.of(edited,newer);var after=service.directory(0,null,"ja-JP","all","",null);
  assertThat(after.items()).extracting(r->r.post().id()).containsExactlyElementsOf(before);
  assertThat(after.items().get(1).publicItemCount()).isEqualTo(2);
 }
 @Test void fullPublicCountIsLocaleAndSearchIndependentWhileMatchingIssueSetIsFiltered(){
  var translated=item(1);translated.translations=Map.of("en-US",new RecommendationItem.Text("Needle",null,null,null));translated.translatedSource=translated.getTranslationSource();
  recommendations.rows=List.of(issue(1,List.of(translated,item(2))));
  var en=service.directory(0,null,"en-US","all","needle",null).items().get(0);var ja=service.directory(0,null,"ja-JP","all","ITEM1",null).items().get(0);
  assertThat(en.publicItemCount()).isEqualTo(2);assertThat(ja.publicItemCount()).isEqualTo(2);assertThat(en.itemCount()).isEqualTo(1);assertThat(ja.itemCount()).isEqualTo(1);
  assertThat(service.directory(0,null,"ja-JP","all","needle",null).items()).isEmpty();
 }
 private RecommendationService.Detail sourceDated(RecommendationService.Detail d,LocalDate date){var p=d.post();return new RecommendationService.Detail(new RecommendationService.Summary(p.id(),p.title(),p.published(),p.version(),p.updatedAt(),p.publishedAt(),p.publisherName(),p.coverImageUrl(),p.merchantId(),p.articleTitles(),date,date==null?"UNKNOWN":"REVIEWED_SOURCE"),d.body(),d.items(),d.articleSourceLocale(),d.articleSourceHash(),d.articleTranslations(),d.serviceOffer());}
 @Test void directoryConsumesSameReviewedCalendarDateFieldForOrderingAndDisplay(){
  recommendations.rows=List.of(sourceDated(issue(90,List.of(item(90))),null),sourceDated(issue(8,List.of(item(8))),LocalDate.of(2026,11,1)),sourceDated(issue(3,List.of(item(3))),LocalDate.of(2026,11,2)),sourceDated(issue(9,List.of(item(9))),LocalDate.of(2026,11,1)));
  var directory=service.directory(0,null,"ja-JP","all","",null);
  assertThat(directory.items()).extracting(r->r.post().id()).containsExactly(3L,9L,8L,90L);
  assertThat(directory.items().get(0).issueDate()).isEqualTo(LocalDate.of(2026,11,2));assertThat(directory.items().get(0).post().issueDate()).isEqualTo(directory.items().get(0).issueDate());assertThat(directory.items().get(0).issueDateSource()).isEqualTo("REVIEWED_SOURCE");assertThat(directory.items().get(3).issueDate()).isNull();
 }
}
