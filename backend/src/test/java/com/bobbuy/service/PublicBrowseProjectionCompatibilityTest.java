package com.bobbuy.service;
import static com.bobbuy.test.RecommendationPublicationFixtures.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

/** Plain in-memory repository fixtures; no Mockito, agent, attach pipe or database. */
class PublicBrowseProjectionCompatibilityTest {
 @SuppressWarnings("unchecked") private static <T>T repository(Class<T> type,Map<String,Object> answers){return (T)Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},(proxy,method,args)->{if(answers.containsKey(method.getName()))return answers.get(method.getName());throw new AssertionError("Unexpected repository operation: "+method.getName());});}
 private static Product product(String id,ProductVisibility visibility,long merchant){var p=new Product();p.setId(id);p.setMerchantId(merchant);p.setVisibilityStatus(visibility);p.setName(Map.of("ja-JP","PRIVATE MASTER"));p.setDescription(Map.of("ja-JP","PRIVATE DESCRIPTION"));p.setBrand("PRIVATE BRAND");return p;}
 @Test void safeProjectionAndExistingPageAgreeWithoutExpandingPrivateOrForeignFields(){
  var owned=product("a",ProductVisibility.DRAFTER_ONLY,1);var privateOnly=product("b",ProductVisibility.DRAFTER_ONLY,1);var foreign=product("c",ProductVisibility.DRAFTER_ONLY,2);var deleted=product("d",ProductVisibility.PUBLIC,1);deleted.setDeletedAt(java.time.Instant.now());var post=new RecommendationPost();post.id=1L;post.merchantId=1L;post.published=true;
  var source=new RecommendationItem();source.id=1L;source.postId=1L;source.productId="a";source.name="PUBLIC NAME";source.description="PUBLIC DESCRIPTION";source.specification="PUBLIC SPEC";
  var cross=new RecommendationItem();cross.id=2L;cross.postId=1L;cross.productId="c";cross.name="Foreign source";
  legacyPost(post);legacyItem(source,post);legacyItem(cross,post);
  var products=repository(ProductRepository.class,Map.of("findAll",List.of(owned,privateOnly,foreign,deleted)));var posts=repository(RecommendationPostRepository.class,Map.of("findByPublishedTrue",List.of(post)));var items=repository(RecommendationItemRepository.class,Map.of("findByPostIdInOrderById",List.of(source,cross)));
  var taxonomy=new RecommendationTaxonomyService(null,null,null,null,null){@Override public List<RecommendationItem> display(List<RecommendationItem> rows,boolean publicView){assertThat(publicView).isTrue();return rows;}};
  var quotes=new ReferenceQuoteService(null,null,null,null,com.bobbuy.test.PriceDocumentFixtures.repository()){@Override public void decorate(List<RecommendationItem> rows,boolean publicView){}};
  var catalog=new PublicProductCatalogService(products,posts,items,taxonomy,quotes,repository(CategoryRepository.class,Map.of("findAllById",List.of())));
  var all=catalog.publicEntries(null,null);assertThat(all).hasSize(1);var row=all.get(0);assertThat(row.productId()).isEqualTo("a");assertThat(row.brand()).isNull();assertThat(row.description()).containsEntry("ja-JP","PUBLIC DESCRIPTION");assertThat(row.gallery()).isEmpty();assertThat(catalog.page(0,null).items()).isEqualTo(all);assertThat(catalog.publicEntries(2L,null)).isEmpty();assertThat(catalog.publicEntries(null,Set.of("b","d"))).isEmpty();
 }
 @Test void boundedSalesOnlyQuoteRequestedPublicIdsAndSuppressUnopenedDetails(){
  var a=product("a",ProductVisibility.PUBLIC,1);var b=product("b",ProductVisibility.PUBLIC,1);var c=product("c",ProductVisibility.DRAFTER_ONLY,1);
  var products=repository(ProductRepository.class,Map.of("findAll",List.of(a,b,c)));var quoted=new ArrayList<String>();var sales=new ProductSaleService(null,null,null,null){@Override public Optional<Quote> quote(Product p){quoted.add(p.getId());return Optional.of(new Quote(BigDecimal.TEN,"JPY","unit",1,"token",null,null,null,null,"DEFAULT"));}};
  var service=new StorefrontService(null,null,products,null,null,null,null,null,null,null,"unused",sales,null);
  var result=service.publicProducts(List.of("b","c","missing"));assertThat(quoted).containsExactly("b");assertThat(result).extracting(StorefrontService.PublicProduct::id).containsExactly("b");assertThat(result.get(0).description()).isEmpty();assertThat(result.get(0).images()).isEmpty();assertThat(result.get(0).price()).isEqualTo(10);
  assertThatThrownBy(()->service.publicProducts(List.of("a","a"))).isInstanceOf(com.bobbuy.api.response.ApiException.class);assertThatThrownBy(()->service.publicProducts(java.util.stream.IntStream.range(0,25).mapToObj(Integer::toString).toList())).isInstanceOf(com.bobbuy.api.response.ApiException.class);
 }
 @Test void migratedHistoryFixtureRetainsOnlyStoredSourceFactsAndNeverInventsMasterVersion(){
  var issue=new RecommendationPost();issue.id=7L;issue.merchantId=1L;legacyPost(issue);
  var source=new RecommendationItem();source.id=1L;source.postId=7L;source.name="Original historical name";source.specification="Original historical pack";source.referencePrice=BigDecimal.TEN;source.gallery=List.of(new RecommendationItem.Picture("historical","https://example.invalid/public.jpg",null,null,null,null,null));
  legacyItem(source,issue);var snapshot=source.publicationSnapshot;
  assertThat(snapshot.legacy()).isTrue();assertThat(snapshot.productVersion()).isNull();assertThat(snapshot.productSourceHash()).isNull();assertThat(snapshot.reviewHash()).isNull();assertThat(snapshot.catalog()).isNull();
  source.name="Changed later source";source.referencePrice=BigDecimal.ONE;source.gallery=List.of();
  var shown=RecommendationPublication.project(source,snapshot);assertThat(shown.name).isEqualTo("Original historical name");assertThat(shown.referencePrice).isNull();assertThat(snapshot.referencePrice()).isEqualByComparingTo(BigDecimal.TEN);assertThat(shown.gallery).extracting(RecommendationItem.Picture::url).containsExactly("https://example.invalid/public.jpg");
  assertThat(RecommendationPublication.visible(source)).isTrue();assertThat(source.publicationRequestId).isNull();assertThat(source.publicationRequestHash).isNull();
 }
}
