package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static com.bobbuy.test.RecommendationPublicationFixtures.legacyItem;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RecommendationPublicReadBatchTest {
 final RecommendationPostRepository posts=mock(RecommendationPostRepository.class);
 final RecommendationItemRepository items=mock(RecommendationItemRepository.class);
 final ProductRepository products=mock(ProductRepository.class);
 final UserRepository users=mock(UserRepository.class);
 final RecommendationTaxonomyService taxonomy=mock(RecommendationTaxonomyService.class);
 final ReferenceQuoteService quotes=mock(ReferenceQuoteService.class);
 final RecommendationArticleService articles=mock(RecommendationArticleService.class);
 final RecommendationService service=new RecommendationService(posts,items,null,products,users,null,taxonomy,null,null,null,quotes,articles);
 RecommendationPost post(long id,long owner){var p=new RecommendationPost();p.id=id;p.merchantId=owner;p.published=true;return p;}
 RecommendationItem item(long id,RecommendationPost p,String product){var i=new RecommendationItem();i.id=id;i.postId=p.id;i.productId=product;i.name="Synthetic";legacyItem(i,p);return i;}
 @Test void nodeDirectoryReadsVisibilityWithoutBuildingFullProductOrQuoteProjections(){
  var a=post(1,10);var b=post(2,20);var pending=post(3,30);var servicePost=post(4,40);servicePost.serviceOffer=mock(RecommendationServiceOffer.class);
  var unpublished=new RecommendationItem();unpublished.id=3L;unpublished.postId=3L;unpublished.name="Pending";
  when(posts.findByPublishedTrue()).thenReturn(List.of(a,b,pending,servicePost));when(products.deletedIds()).thenReturn(Set.of("gone"));
  when(items.findByPostIdInOrderById(anyList())).thenReturn(List.of(item(1,a,null),item(2,b,"gone"),unpublished));
  when(users.findAllById(any())).thenReturn(List.of(new User(10L,"Ten",Role.AGENT,0),new User(40L,"Forty",Role.AGENT,0)));
  assertThat(service.publicNodes()).extracting(RecommendationService.PublicNode::id).containsExactly(10L,40L);
  verify(posts).findByPublishedTrue();verify(items).findByPostIdInOrderById(List.of(1L,2L,3L,4L));verify(products).deletedIds();
  verifyNoInteractions(taxonomy,quotes,articles);verify(products,never()).findAll();verify(products,never()).findAllById(any());
 }
 @Test void feedBatchesTaxonomyAndReferencesOnceWhileRetainingEveryOccurrence(){
  var a=post(1,10);var b=post(2,10);var first=item(11,a,"same");var second=item(12,b,"same");var all=List.of(first,second);
  when(posts.findByPublishedTrue()).thenReturn(List.of(a,b));when(items.findByPostIdInOrderById(anyList())).thenReturn(all);when(taxonomy.display(all,true)).thenReturn(all);
  var data=service.publicBrowseEntries(10L);assertThat(data).extracting(d->d.post().id()).containsExactly(2L,1L);assertThat(data.stream().flatMap(d->d.items().stream()).map(i->i.id)).containsExactly(12L,11L);
  verify(taxonomy).display(all,true);verify(quotes).decorate(all,true);verify(items).findByPostIdInOrderById(List.of(2L,1L));
 }
}
