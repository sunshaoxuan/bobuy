package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.model.converter.MediaGalleryJsonConverter;
import com.bobbuy.repository.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RecommendationImageAuthorizationReadTest {
 final ProductRepository products=mock(ProductRepository.class);
 final RecommendationItemRepository items=mock(RecommendationItemRepository.class);
 final RecommendationImageRepository images=mock(RecommendationImageRepository.class);
 final RecommendationService service=new RecommendationService(null,items,images,products,null,null,null,null,null,null,null,null);
 final String id="exact-image",url="/api/storefront/recommendation-images/"+id;
 final RecommendationImage image=new RecommendationImage();
 record Ref(String productId,String imageUrl,List<RecommendationItem.Picture> gallery) implements RecommendationItemRepository.ImageReference {
  public String getProductId(){return productId;} public String getImageUrl(){return imageUrl;} public List<RecommendationItem.Picture> getGallery(){return gallery;}
 }
 RecommendationImageAuthorizationReadTest(){image.id=id;when(images.findById(id)).thenReturn(Optional.of(image));when(products.deletedIds()).thenReturn(Set.of("deleted"));}
 String gallery(String address){var m=new MediaGalleryItem();m.setUrl(address);return new MediaGalleryJsonConverter().convertToDatabaseColumn(List.of(m));}
 void thinReadsOnly(){verify(products,never()).findAll();verify(items,never()).findAll();}
 @Test void noDeletedProductsSkipAllAssociationScans(){when(products.deletedIds()).thenReturn(Set.of());assertThat(service.image(id)).isSameAs(image);verifyNoInteractions(items);verify(products,never()).activeMediaGalleries();thinReadsOnly();}
 @Test void deletedDirectAssociationIsDenied(){when(items.imageReferences()).thenReturn(List.of(new Ref("deleted",url,List.of())));assertThatThrownBy(()->service.image(id)).isInstanceOf(com.bobbuy.api.response.ApiException.class);thinReadsOnly();}
 @Test void deletedGalleryAssociationIsDenied(){when(items.imageReferences()).thenReturn(List.of(new Ref("deleted",null,List.of(new RecommendationItem.Picture(id,url,null,null,null,null,null)))));assertThatThrownBy(()->service.image(id)).isInstanceOf(com.bobbuy.api.response.ApiException.class);thinReadsOnly();}
 @Test void activeMasterSharingExactImageKeepsItAvailable(){when(products.activeMediaGalleries()).thenReturn(List.of(gallery(url)));when(products.deletedMediaGalleries()).thenReturn(List.of(gallery(url)));when(items.imageReferences()).thenReturn(List.of(new Ref("deleted",url,List.of())));assertThat(service.image(id)).isSameAs(image);thinReadsOnly();}
 @Test void liveRecommendationSharingExactImageKeepsItAvailable(){when(products.deletedMediaGalleries()).thenReturn(List.of(gallery(url)));when(items.imageReferences()).thenReturn(List.of(new Ref("deleted",url,List.of()),new Ref("live",url,List.of())));assertThat(service.image(id)).isSameAs(image);thinReadsOnly();}
 @Test void unlinkedRecommendationSharingExactImageKeepsItAvailable(){when(products.deletedMediaGalleries()).thenReturn(List.of(gallery(url)));when(items.imageReferences()).thenReturn(List.of(new Ref(null,url,List.of())));assertThat(service.image(id)).isSameAs(image);thinReadsOnly();}
 @Test void similarPrefixDoesNotAuthorizeDeletedImage(){when(products.deletedMediaGalleries()).thenReturn(List.of(gallery(url)));when(products.activeMediaGalleries()).thenReturn(List.of(gallery(url+"-different")));when(items.imageReferences()).thenReturn(List.of(new Ref("live",url+"-different",List.of())));assertThatThrownBy(()->service.image(id)).isInstanceOf(com.bobbuy.api.response.ApiException.class);thinReadsOnly();}
 @Test void unrelatedDeletedImageDoesNotHidePublicStandaloneImage(){when(products.deletedMediaGalleries()).thenReturn(List.of(gallery(url+"-different")));assertThat(service.image(id)).isSameAs(image);thinReadsOnly();}
 @Test void privateScopeRemainsDeniedDespiteLiveAssociation(){image.accessScope="PRIVATE";when(products.activeMediaGalleries()).thenReturn(List.of(gallery(url)));assertThatThrownBy(()->service.image(id)).isInstanceOf(com.bobbuy.api.response.ApiException.class);thinReadsOnly();}
}
