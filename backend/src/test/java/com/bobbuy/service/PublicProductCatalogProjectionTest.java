package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Real existing public taxonomy and quotation projection, repository inputs only are synthetic. */
class PublicProductCatalogProjectionTest {
 private final ProductRepository products=mock(ProductRepository.class);
 private final RecommendationPostRepository posts=mock(RecommendationPostRepository.class);
 private final RecommendationItemRepository items=mock(RecommendationItemRepository.class);
 private final CategoryRepository categories=mock(CategoryRepository.class);
 private final RecommendationTaxonomyService taxonomy=new RecommendationTaxonomyService(categories,mock(SupplierRepository.class),mock(UserRepository.class),products,posts);
 private final ReferenceQuoteService quotes=new ReferenceQuoteService(mock(ReferenceQuoteRevisionRepository.class),new ObjectMapper(),items,posts);
 private final PublicProductCatalogService catalog=new PublicProductCatalogService(products,posts,items,taxonomy,quotes,categories);
 private Product p;private RecommendationItem original;
 private void setup(boolean canonical){
  p=new Product();p.setId("reference-only");p.setMerchantId(1001L);p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);p.setName(Map.of("ja-JP","Master name"));p.setDescription(Map.of("ja-JP","Master description"));p.setBrand("Master brand");p.setItemNumber("MASTER ITEM");
  var visible=new MediaGalleryItem();visible.setType(MediaType.IMAGE);visible.setVisible(true);visible.setUrl("https://example.invalid/visible.jpg");var hidden=new MediaGalleryItem();hidden.setType(MediaType.IMAGE);hidden.setVisible(false);hidden.setUrl("https://example.invalid/PRIVATE.jpg");p.setMediaGallery(List.of(visible,hidden));
  if(canonical)p.setCatalogData(new ProductCatalogData(Map.of("ja-JP","Master spec"),"Master model","2 x 10",List.of(),null,null,null,null));
  original=new RecommendationItem();original.id=1L;original.postId=7L;original.productId=p.getId();original.name="Original published name";original.itemNumber="SOURCE ITEM";original.specification="Source spec";original.description="Published description";original.imageUrl="https://example.invalid/PRIVATE_RAW_IMAGE";
  var post=new RecommendationPost();post.id=7L;post.merchantId=1001L;post.published=true;
  when(products.findAll()).thenReturn(List.of(p));when(products.findAllById(any())).thenReturn(List.of(p));when(products.deletedIds()).thenReturn(Set.of());when(posts.findByPublishedTrue()).thenReturn(List.of(post));when(posts.findAllById(any())).thenReturn(List.of(post));when(items.findByPostIdInOrderById(List.of(7L))).thenReturn(List.of(original));when(items.findByProductIdInOrderById(any())).thenReturn(List.of(original));
 }
 @Test void legacyDrafterFieldsExactlyReusePublishedProjectionWithoutMasterFallback(){setup(false);var published=taxonomy.display(List.of(original),true).get(0);var entry=catalog.page(0,null).items().get(0);assertThat(entry.name()).containsEntry("ja-JP",published.name);assertThat(entry.description()).containsEntry("ja-JP",published.description);assertThat(entry.specification()).containsEntry("ja-JP",published.specification);assertThat(entry.brand()).isNull();assertThat(entry.itemNumber()).isEqualTo(published.itemNumber);assertThat(entry.gallery()).isEqualTo(published.gallery).isEmpty();assertThat(entry.categories()).isEqualTo(published.categories);assertThat(entry.referenceOffers().get(0).facts().imageUrl).isNull();assertThat(p.getBrand()).isEqualTo("Master brand");verify(products,never()).save(any());}
 @Test void canonicalDrafterUsesExactlyAlreadyPublicMasterProjectionAndVisibleMedia(){setup(true);var published=taxonomy.display(List.of(original),true).get(0);var entry=catalog.page(0,null).items().get(0);assertThat(entry.name()).containsEntry("ja-JP",published.name);assertThat(entry.brand()).isEqualTo(published.brand);assertThat(entry.model()).isEqualTo(published.model);assertThat(entry.packaging()).isEqualTo(published.packaging);assertThat(entry.gallery()).isEqualTo(published.gallery).extracting(RecommendationItem.Picture::url).containsExactly("https://example.invalid/visible.jpg");assertThat(entry.reviewedMaster()).isTrue();assertThat(entry.referenceOffers().get(0).facts().sourceFacts).isNull();}
 @Test void withdrawalRemovesDrafterEntryWithoutChangingVisibilityOrSaleData(){setup(true);assertThat(catalog.page(0,null).total()).isEqualTo(1);when(posts.findByPublishedTrue()).thenReturn(List.of());assertThat(catalog.page(0,null).total()).isZero();assertThat(p.getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);verify(products,never()).save(any());}
}

