package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.ProductRepository;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class ReferenceProductIdentityTest {
 ReferenceOfferContext context(String channel){return new ReferenceOfferContext("supplier",channel,"1650g","mail",null,null,null,false,null,false);}
 RecommendationItem item(long issue){var i=new RecommendationItem();i.postId=issue;i.name="Synthetic oil";i.itemNumber="00123";i.referenceContext=context("COSTCO_WAREHOUSE");return i;}
 @Test void exactSupplierItemVariantReusesMasterAcrossIssuesAndChannelsWithoutPriceWrites(){
  var repository=mock(ProductRepository.class);var service=new RecommendationCatalogService(repository);var master=new Product();master.setId("existing-master");master.setMerchantId(1000L);master.setName(Map.of("ja-JP","Synthetic oil"));master.setBasePrice(123);master.setCatalogData(new ProductCatalogData(Map.of("ja-JP","1650g"),null,null,List.of(),"supplier",null,1000L,null));when(repository.findAllByMerchantIdAndItemNumber(1000L,"00123")).thenReturn(List.of(master));
  var a=item(1);var b=item(2);b.referenceContext=context("COSTCO_ONLINE");assertThat(service.ensure(a,1000L)).isFalse();assertThat(service.ensure(b,1000L)).isFalse();assertThat(a.productId).isEqualTo("existing-master");assertThat(b.productId).isEqualTo(a.productId);assertThat(master.getBasePrice()).isEqualTo(123);verify(repository,never()).saveAndFlush(any());
 }
 @Test void ambiguousOrDeletedExistingCodesRequireExplicitReviewRatherThanNewProfiles(){
  var repository=mock(ProductRepository.class);var service=new RecommendationCatalogService(repository);when(repository.deletedCodeCount(1000L,"00123")).thenReturn(1L);assertThatThrownBy(()->service.ensure(item(1),1000L)).isInstanceOf(RuntimeException.class);verify(repository,never()).saveAndFlush(any());
  when(repository.deletedCodeCount(1000L,"00123")).thenReturn(0L);when(repository.findAllByMerchantIdAndItemNumber(1000L,"00123")).thenReturn(List.of(new Product(),new Product()));assertThatThrownBy(()->service.ensure(item(2),1000L)).isInstanceOf(RuntimeException.class);verify(repository,never()).saveAndFlush(any());
 }
 @Test void newProductIdentityDoesNotContainIssueOrOfferWindow(){
  var repository=mock(ProductRepository.class);var service=new RecommendationCatalogService(repository);var a=item(1);var b=item(2);com.bobbuy.test.PriceDocumentFixtures.start(b,java.time.LocalDate.of(2026,11,2));b.referenceContext=context("COSTCO_ONLINE");service.ensure(a,1000L);service.ensure(b,1000L);assertThat(a.productId).isEqualTo(b.productId);
 }
}
