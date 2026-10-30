package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import java.util.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class RecommendationFromProductTest {
 RecommendationPostRepository posts;RecommendationItemRepository items;RecommendationImageRepository images;ProductRepository products;UserRepository users;RecommendationCatalogService catalog;RecommendationService service;Product product;RecommendationPost post;
 @BeforeEach void setup(){
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("merchant-1000","",List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));
  posts=mock(RecommendationPostRepository.class);items=mock(RecommendationItemRepository.class);images=mock(RecommendationImageRepository.class);products=mock(ProductRepository.class);users=mock(UserRepository.class);catalog=mock(RecommendationCatalogService.class);
  var taxonomy=mock(RecommendationTaxonomyService.class);when(taxonomy.display(anyList(),anyBoolean())).thenAnswer(i->i.getArgument(0));
  service=new RecommendationService(posts,items,images,products,users,mock(AuditLogService.class),taxonomy,catalog,mock(ProductSaleService.class),mock(MediaBinaryService.class));
  post=new RecommendationPost();post.id=4L;post.merchantId=1000L;when(posts.findByIdAndMerchantId(4L,1000L)).thenReturn(Optional.of(post));when(users.lockById(1000L)).thenReturn(Optional.of(new User()));when(items.findByPostIdOrderById(4L)).thenReturn(List.of());
  product=new Product();product.setId("master");product.setMerchantId(1000L);product.setRecordVersion(7L);product.setItemNumber("00123");product.setName(Map.of("ja-JP","ごま油"));product.setCatalogData(new ProductCatalogData(Map.of("ja-JP","1650g"),null,null,List.of(),null,null,1000L,java.time.Instant.now()));
  var media=new MediaGalleryItem("/api/storefront/recommendation-images/img",MediaType.IMAGE,Map.of("ja-JP","瓶"),true,"https://www.costco.co.jp/product.jpg","www.costco.co.jp","OFFICIAL_PRODUCT");media.setSha256("hash");product.setMediaGallery(List.of(media));when(products.lockById("master")).thenReturn(Optional.of(product));
  var image=new RecommendationImage();image.id="img";image.merchantId=1000L;image.imageHash="hash";when(images.findById("img")).thenReturn(Optional.of(image));
 }
 @AfterEach void cleanup(){SecurityContextHolder.clearContext();}
 RecommendationFacts facts(){return new RecommendationFacts("ごま油","00123",new BigDecimal("1738"),new BigDecimal("2178"),new BigDecimal("440"),"1650g",null,null,null,null,"オンライン参考価格");}
 @Test void reusesMasterAndGalleryWithoutProductOrBinaryWrites(){
  service.fromProduct(4L,"master",7L,facts(),post.version,true);
  var saved=org.mockito.ArgumentCaptor.forClass(RecommendationItem.class);verify(items).saveAndFlush(saved.capture());var item=saved.getValue();assertThat(item.productId).isEqualTo("master");assertThat(item.gallery).hasSize(1);assertThat(item.specification).isEqualTo("1650g");assertThat(item.showSupplier).isFalse();assertThat(item.referencePrice).isEqualByComparingTo("1738");verifyNoInteractions(catalog);verify(products,never()).save(any());
 }
 @Test void retryDoesNotCreateSecondItem(){var existing=new RecommendationItem();facts().apply(existing);existing.productId="master";when(items.findByPostIdOrderById(4L)).thenReturn(List.of(existing));service.fromProduct(4L,"master",7L,facts(),999,true);verify(items,never()).saveAndFlush(any());}
 @Test void samePeriodDifferentOfferConflictsButDifferentPeriodStaysIndependent(){var existing=new RecommendationItem();facts().apply(existing);existing.productId="master";existing.referencePrice=new BigDecimal("1800");when(items.findByPostIdOrderById(4L)).thenReturn(List.of(existing));assertThatThrownBy(()->service.fromProduct(4L,"master",7L,facts(),post.version,true)).isInstanceOf(RuntimeException.class);existing.offerEnd=java.time.LocalDate.of(2026,11,1);service.fromProduct(4L,"master",7L,facts(),post.version,true);verify(items).saveAndFlush(any());verify(images,never()).save(any());}
 @Test void rejectsStaleMasterAndPost(){assertThatThrownBy(()->service.fromProduct(4L,"master",6L,facts(),post.version,true)).isInstanceOf(RuntimeException.class);assertThatThrownBy(()->service.fromProduct(4L,"master",7L,facts(),999,true)).isInstanceOf(RuntimeException.class);verify(items,never()).saveAndFlush(any());}
 @Test void rejectsOtherOwnerDeletedUnreviewedAndPrivateMedia(){product.setMerchantId(2000L);assertThatThrownBy(()->service.fromProduct(4L,"master",7L,facts(),post.version,true)).isInstanceOf(RuntimeException.class);product.setMerchantId(1000L);product.setDeletedAt(java.time.Instant.now());assertThatThrownBy(()->service.fromProduct(4L,"master",7L,facts(),post.version,true)).isInstanceOf(RuntimeException.class);product.setDeletedAt(null);assertThatThrownBy(()->service.fromProduct(4L,"master",7L,facts(),post.version,false)).isInstanceOf(RuntimeException.class);images.findById("img").orElseThrow().accessScope="PRIVATE";assertThatThrownBy(()->service.fromProduct(4L,"master",7L,facts(),post.version,true)).isInstanceOf(RuntimeException.class);verify(items,never()).saveAndFlush(any());}
 @Test void rejectsMissingGalleryPublishedAndWrongIdentity(){product.setItemNumber("different");assertThatThrownBy(()->service.fromProduct(4L,"master",7L,facts(),post.version,true)).isInstanceOf(RuntimeException.class);product.setItemNumber("00123");product.setMediaGallery(List.of());assertThatThrownBy(()->service.fromProduct(4L,"master",7L,facts(),post.version,true)).isInstanceOf(RuntimeException.class);post.published=true;assertThatThrownBy(()->service.fromProduct(4L,"master",7L,facts(),post.version,true)).isInstanceOf(RuntimeException.class);verify(items,never()).saveAndFlush(any());}
}
