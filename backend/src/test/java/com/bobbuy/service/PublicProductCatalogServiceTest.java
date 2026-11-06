package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PublicProductCatalogServiceTest {
 private final ProductRepository products=mock(ProductRepository.class);
 private final RecommendationPostRepository posts=mock(RecommendationPostRepository.class);
 private final RecommendationItemRepository items=mock(RecommendationItemRepository.class);
 private final RecommendationTaxonomyService taxonomy=mock(RecommendationTaxonomyService.class);
 private final ReferenceQuoteService quotes=mock(ReferenceQuoteService.class);
 private final CategoryRepository categories=mock(CategoryRepository.class);
 private final PublicProductCatalogService service=new PublicProductCatalogService(products,posts,items,taxonomy,quotes,categories);
 private Product product(String id,long owner){var p=new Product();p.setId(id);p.setMerchantId(owner);p.setName(Map.of("ja-JP","Verified product"));return p;}
 private void emptyPosts(){when(posts.findByPublishedTrue()).thenReturn(List.of());when(taxonomy.display(List.of(),true)).thenReturn(List.of());}
 @Test void allPagesIncludeUnpricedPublicMastersWithoutAnyTrip(){emptyPosts();var all=new ArrayList<Product>();for(int i=0;i<51;i++)all.add(product(String.format("p%03d",i),1));Collections.reverse(all);when(products.findAll()).thenReturn(all);
  var first=service.page(0,null);var second=service.page(1,null);var last=service.page(2,null);
  assertThat(first.total()).isEqualTo(51);assertThat(first.items()).hasSize(24);assertThat(first.hasNext()).isTrue();assertThat(second.items()).hasSize(24);assertThat(last.items()).hasSize(3);assertThat(last.hasNext()).isFalse();
  var ids=new HashSet<String>();for(var page:List.of(first,second,last))for(var row:page.items())assertThat(ids.add(row.productId())).isTrue();assertThat(ids).hasSize(51);verify(products,never()).save(any());
 }
 @Test void privateDeletedAndUnknownVisibilityNeverExpandThroughCatalog(){emptyPosts();var a=product("a",1);var b=product("b",1);b.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);var c=product("c",1);c.setDeletedAt(java.time.Instant.now());var d=product("d",1);d.setVisibilityStatus(null);when(products.findAll()).thenReturn(List.of(a,b,c,d));assertThat(service.page(0,null).items()).extracting(PublicProductCatalogService.Entry::productId).containsExactly("a");}
 @Test void merchantFilterDoesNotReturnOtherOwners(){emptyPosts();when(products.findAll()).thenReturn(List.of(product("a",1),product("b",2)));assertThat(service.page(0,2L).items()).extracting(PublicProductCatalogService.Entry::productId).containsExactly("b");}
 @Test void invalidQueryRejectedAndPageBeyondEndIsEmpty(){emptyPosts();when(products.findAll()).thenReturn(List.of(product("a",1)));assertThatThrownBy(()->service.page(-1,null)).isInstanceOf(IllegalArgumentException.class);assertThatThrownBy(()->service.page(0,0L)).isInstanceOf(IllegalArgumentException.class);assertThat(service.page(100,null).items()).isEmpty();}
 @Test void legacyEmptySourceBrandAndGalleryDoNotEraseKnownMasterEvidence(){var p=product("a",1);p.setBrand("Verified brand");var media=new MediaGalleryItem();media.setType(MediaType.IMAGE);media.setVisible(true);media.setUrl("https://example.invalid/exact.jpg");p.setMediaGallery(List.of(media));
  var post=new RecommendationPost();post.id=7L;post.merchantId=1L;var source=new RecommendationItem();source.id=9L;source.postId=7L;source.productId="a";source.name="Exact source name";source.brand="";
  when(posts.findByPublishedTrue()).thenReturn(List.of(post));when(items.findByPostIdInOrderById(List.of(7L))).thenReturn(List.of(source));when(taxonomy.display(List.of(source),true)).thenReturn(List.of(source));when(products.findAll()).thenReturn(List.of(p));
  var row=service.page(0,null).items().get(0);assertThat(row.brand()).isEqualTo("Verified brand");assertThat(row.gallery()).extracting(RecommendationItem.Picture::url).containsExactly("https://example.invalid/exact.jpg");assertThat(row.referenceOffers()).hasSize(1);assertThat(p.getBrand()).isEqualTo("Verified brand");verify(products,never()).save(any());
 }
 @Test void foreignPostCannotSupplyMetadataToAnotherMerchantMaster(){var p=product("a",1);p.setBrand("Owner brand");var post=new RecommendationPost();post.id=7L;post.merchantId=2L;var source=new RecommendationItem();source.id=9L;source.postId=7L;source.productId="a";source.name="Foreign";
  when(posts.findByPublishedTrue()).thenReturn(List.of(post));when(items.findByPostIdInOrderById(List.of(7L))).thenReturn(List.of(source));when(taxonomy.display(List.of(source),true)).thenReturn(List.of(source));when(products.findAll()).thenReturn(List.of(p));var row=service.page(0,null).items().get(0);assertThat(row.referenceOffers()).isEmpty();assertThat(row.name()).containsEntry("ja-JP","Verified product");
 }
}
