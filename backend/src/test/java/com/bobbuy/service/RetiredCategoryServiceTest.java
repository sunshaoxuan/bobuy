package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.test.RecommendationPublicationFixtures;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RetiredCategoryServiceTest {
 RetiredCategoryRepository archive=mock(RetiredCategoryRepository.class);
 RetiredCategoryService retired=new RetiredCategoryService(archive);
 CategoryRepository categories=mock(CategoryRepository.class);
 ProductRepository products=mock(ProductRepository.class);
 UserRepository users=mock(UserRepository.class);
 RecommendationPostRepository posts=mock(RecommendationPostRepository.class);
 RetiredCategory old;
 RecommendationTaxonomyService taxonomy;
 @BeforeEach void setup(){
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("merchant-1001","",List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));
  old=new RetiredCategory();old.id="synthetic-retired";old.merchantId=1001L;old.tagKey="旧分类";old.name=Map.of("ja-JP","旧分類","zh-CN","旧分类");
  when(archive.findAllById(any())).thenAnswer(call->{var ids=(Collection<?>)call.getArgument(0);return ids.contains(old.id)?List.of(old):List.of();});
  when(archive.findByMerchantId(1001L)).thenReturn(List.of(old));
  when(users.lockById(1001L)).thenReturn(Optional.of(new User(1001L,"Synthetic owner",Role.AGENT,0)));
  taxonomy=new RecommendationTaxonomyService(categories,mock(SupplierRepository.class),users,products,posts,retired);
 }
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 @Test void removesOnlyOwnedRetiredIdsAndPreservesUnknownValidation(){
  assertThat(retired.currentIds(List.of(old.id,"new-tree-or-unknown"),1001L)).containsExactly("new-tree-or-unknown");
  assertThat(retired.currentIds(List.of(old.id),1002L)).containsExactly(old.id);
  assertThatThrownBy(()->taxonomy.validate(List.of(old.id),null,false)).isInstanceOf(com.bobbuy.api.response.ApiException.class);
  assertThatThrownBy(()->taxonomy.category(null,"旧分类","zh-CN")).isInstanceOf(com.bobbuy.api.response.ApiException.class);
  assertThat(taxonomy.options().categories()).isEmpty();verify(categories,never()).saveAndFlush(any());
 }
 @Test void historicalPublicationLabelsRemainReadableWithoutChangingSnapshots(){
  var post=new RecommendationPost();post.id=1L;post.merchantId=1001L;RecommendationPublicationFixtures.legacyPost(post);
  var item=new RecommendationItem();item.id=2L;item.postId=post.id;item.name="Synthetic source";item.categoryIds=List.of(old.id);RecommendationPublicationFixtures.legacyItem(item,post);
  var snapshot=item.publicationSnapshot;when(posts.findAllById(any())).thenReturn(List.of(post));
  for(boolean publicView:List.of(true,false)){var shown=taxonomy.display(List.of(item),publicView).get(0);assertThat(shown.categories).containsExactly(new RecommendationItem.Label(old.id,old.name));assertThat(item.publicationSnapshot).isSameAs(snapshot);assertThat(item.categoryIds).containsExactly(old.id);}
  post.merchantId=1002L;assertThat(taxonomy.display(List.of(item),true).get(0).categories).isEmpty();
 }
 @Test void recommendationImportCannotReintroduceRetiredProductAssignments(){
  var item=new RecommendationItem();item.id=2L;item.postId=1L;item.name="Synthetic imported item";item.imageHash="a".repeat(64);item.categoryIds=List.of(old.id);
  var service=new RecommendationCatalogService(products,retired);assertThat(service.ensure(item,1001L)).isTrue();
  var capture=org.mockito.ArgumentCaptor.forClass(Product.class);verify(products).saveAndFlush(capture.capture());assertThat(capture.getValue().getCategoryId()).isNull();assertThat(capture.getValue().getCatalogData().categoryIds()).isEmpty();assertThat(item.categoryIds).containsExactly(old.id);
 }
 @Test void checkpointRestoreKeepsHistoricalOriginalButDoesNotResurrectRetiredLinks(){
  var itemRows=mock(RecommendationItemRepository.class);var recoveryRows=mock(ProductCatalogRecoveryRepository.class);
  var product=new Product();product.setId("synthetic-product");product.setMerchantId(1001L);product.setRecordVersion(7L);product.setName(Map.of("ja-JP","Historical name"));product.setCategoryId(old.id);product.setCatalogData(new ProductCatalogData(Map.of("ja-JP","1L"),null,null,List.of(old.id),null,"translation-fingerprint",1001L,null));
  var checkpoint=new ProductCatalogRecovery();checkpoint.id="synthetic-checkpoint";checkpoint.merchantId=1001L;checkpoint.productId=product.getId();checkpoint.versionAfter=7;checkpoint.original=ProductCatalogRecovery.capture(product,List.of());
  product.setName(Map.of("ja-JP","Current name"));retired.removeAssignments(product);
  when(products.lockById(product.getId())).thenReturn(Optional.of(product));when(recoveryRows.findById(checkpoint.id)).thenReturn(Optional.of(checkpoint));
  var service=new ProductCatalogService(products,itemRows,mock(RecommendationImageRepository.class),posts,users,taxonomy,null,recoveryRows);
  var restored=service.restore(product.getId(),checkpoint.id,7,true);
  assertThat(restored.value().name()).containsEntry("ja-JP","Historical name");assertThat(product.getCategoryId()).isNull();assertThat(product.getCatalogData().categoryIds()).isEmpty();assertThat(product.getCatalogData().translatedSource()).isEqualTo("translation-fingerprint");assertThat(checkpoint.original.categoryId()).isEqualTo(old.id);assertThat(checkpoint.original.catalogData().categoryIds()).containsExactly(old.id);
 }
 @Test void aiRetiredHintIsOwnerScopedAndReturnsNoReplacementGuess() throws Exception {
  var service=new AiProductOnboardingService(null,null,null,categories,products,null,null,retired);
  var method=AiProductOnboardingService.class.getDeclaredMethod("normalizeCategoryId",String.class,String.class,String.class,String.class);method.setAccessible(true);
  assertThat(method.invoke(service,old.id,"Synthetic food","","")).isEqualTo("");assertThat(method.invoke(service,"旧分類","Synthetic food","","")).isEqualTo("");
  assertThat(retired.retiredHint("旧分類",1002L)).isFalse();
 }
}
