package com.bobbuy.service;
import com.bobbuy.model.RecommendationItem;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class PublicProductBrowseServiceTest {
 @Test void warehousePriorityIsDeterministicAndRejectsOtherItemIdentity(){
  var base=row(0,null);var online=new RecommendationItem();online.id=1L;online.productId=base.productId();online.itemNumber=base.itemNumber();online.referenceContext=new com.bobbuy.model.ReferenceOfferContext(null,"COSTCO_ONLINE",null,null,null,null,null,false,null,false);
  var warehouse=new RecommendationItem();warehouse.id=2L;warehouse.productId=base.productId();warehouse.itemNumber=base.itemNumber();warehouse.referenceContext=new com.bobbuy.model.ReferenceOfferContext(null,"COSTCO_WAREHOUSE",null,null,null,null,null,false,null,false);
  var wrong=new RecommendationItem();wrong.id=3L;wrong.productId="other";wrong.itemNumber=base.itemNumber();wrong.referenceContext=warehouse.referenceContext;
  var entry=new PublicProductCatalogService.Entry(base.productId(),base.merchantId(),base.name(),base.description(),base.brand(),base.itemNumber(),base.specification(),base.model(),base.packaging(),base.gallery(),base.categories(),List.of(new PublicProductCatalogService.Offer(9L,online),new PublicProductCatalogService.Offer(5L,warehouse),new PublicProductCatalogService.Offer(99L,wrong)),false);
  assertThat(ReferencePriceDisplay.main(entry).orElseThrow().facts()).isSameAs(warehouse);
 }
 @Test void compactReferenceRetainsZeroAmountSourceAndWindowAndRevisionsChangeWithFacts(){
  var base=row(0,null);var facts=new RecommendationItem();facts.id=901L;facts.productId=base.productId();facts.itemNumber=base.itemNumber();facts.referencePrice=java.math.BigDecimal.ZERO;facts.originalPrice=new java.math.BigDecimal("500");facts.discountAmount=new java.math.BigDecimal("500");facts.priceUnit="pack";facts.offerStart=java.time.LocalDate.of(2000,1,1);facts.offerEnd=java.time.LocalDate.of(2000,1,2);
  catalog.rows=List.of(new PublicProductCatalogService.Entry(base.productId(),base.merchantId(),base.name(),base.description(),base.brand(),base.itemNumber(),base.specification(),base.model(),base.packaging(),base.gallery(),base.categories(),List.of(new PublicProductCatalogService.Offer(7L,facts)),false));
  var before=service.browse(0,null,"","","en-US",false,null);var reference=before.items().get(0).reference();assertThat(reference.amount()).isEqualByComparingTo("500");assertThat(reference.currency()).isEqualTo("JPY");assertThat(reference.postId()).isEqualTo(7L);assertThat(reference.itemId()).isEqualTo(901L);assertThat(reference.state()).isEqualTo("EXPIRED");
  assertThat(reference.originalPrice()).isNull();assertThat(reference.discountAmount()).isNull();
  facts.referencePrice=new java.math.BigDecimal("999999999999.99");assertThatThrownBy(()->service.browse(1,null,"","","en-US",false,before.revision())).isInstanceOf(PublicProductBrowseService.Changed.class);
  facts.referencePrice=null;assertThat(service.browse(0,null,"","","en-US",false,null).items().get(0).reference()).isNull();
 }
 private static class Catalog extends PublicProductCatalogService {
  List<Entry> rows=List.of();int reads;
  Catalog(){super(null,null,null,null,null,null);}
  @Override public List<Entry> publicEntries(Long merchant,Set<String> ids){reads++;return rows;}
 }
 private static class Markers extends ProductMarkerService {
  List<PublicAssignment> rows=List.of();int reads;
  Markers(){super(null,null,null,null,null);}
  @Override public List<PublicAssignment> browseAssignments(Map<String,Long> owners){reads++;return rows;}
 }
 private final Catalog catalog=new Catalog();
 private final Markers markers=new Markers();
 private final PublicProductBrowseService service=new PublicProductBrowseService(catalog,markers);
 private PublicProductCatalogService.Entry row(int i,String category){return new PublicProductCatalogService.Entry("p%03d".formatted(i),1L,Map.of("ja-JP","Name "+i),Map.of("en-US","Description "+i),"Brand","ITEM"+i,Map.of("ja-JP","Pack "+i),"Model","2 x 3",List.of(new RecommendationItem.Picture("image","https://example.invalid/"+i,null,null,null,null,null)),category==null?List.of():List.of(new RecommendationItem.Label(category,Map.of("en-US",category))),List.of(),false);}
 private List<PublicProductCatalogService.Entry> setup(){var rows=new ArrayList<PublicProductCatalogService.Entry>();for(int i=0;i<51;i++)rows.add(row(i,i%2==0?"even":"odd"));catalog.rows=rows;markers.rows=List.of();return rows;}
 @Test void pageCountsFacetsAndContinuationUseCompleteRange(){setup();var a=service.browse(0,null,"","","en-US",false,null);assertThat(a.items()).hasSize(24);assertThat(a.scopeTotal()).isEqualTo(51);assertThat(a.matchedTotal()).isEqualTo(51);assertThat(a.categories()).extracting(PublicProductBrowseService.Facet::count).containsExactly(26L,25L);var b=service.browse(1,null,"","","en-US",false,a.revision());var c=service.browse(2,null,"","","en-US",false,a.revision());assertThat(b.items()).hasSize(24);assertThat(c.items()).hasSize(3);assertThat(c.hasNext()).isFalse();var ids=new HashSet<String>();for(var p:List.of(a,b,c))for(var r:p.items())assertThat(ids.add(r.productId())).isTrue();assertThat(ids).hasSize(51);}
 @Test void searchFindsLaterPageAndFacetsPrecedeCategory(){setup();var search=service.browse(0,null,"description 50","","ja-JP",false,null);assertThat(search.items()).extracting(PublicProductBrowseService.Card::productId).containsExactly("p050");var selected=service.browse(0,null,"","odd","ja-JP",false,null);assertThat(selected.scopeTotal()).isEqualTo(51);assertThat(selected.matchedTotal()).isEqualTo(25);assertThat(selected.categories()).hasSize(2);assertThat(selected.items()).allMatch(e->e.categories().get(0).id().equals("odd"));}
 @Test void revisionRejectsMutationQueryLocaleAndMarkerChanges(){var rows=setup();var first=service.browse(0,null,"","","ja-JP",false,null);rows.remove(50);assertThatThrownBy(()->service.browse(1,null,"","","ja-JP",false,first.revision())).isInstanceOf(PublicProductBrowseService.Changed.class);var fresh=service.browse(0,null,"","","ja-JP",false,null);assertThatThrownBy(()->service.browse(1,null,"","","en-US",false,fresh.revision())).isInstanceOf(PublicProductBrowseService.Changed.class);markers.rows=List.of(new ProductMarkerService.PublicAssignment("p000",List.of(new ProductMarkerService.Definition("m","new","N",Map.of(),Map.of(),"red",0,true,0))));assertThatThrownBy(()->service.browse(1,null,"","","ja-JP",false,fresh.revision())).isInstanceOf(PublicProductBrowseService.Changed.class);}
 @Test void markedAndUnclassifiedCountsAndDetailsAreSafeSubset(){var rows=setup();rows.set(0,row(0,null));var marker=new ProductMarkerService.Definition("m","new","N",Map.of(),Map.of(),"red",0,true,0);markers.rows=List.of(new ProductMarkerService.PublicAssignment("p000",List.of(marker)));var marked=service.browse(0,null,"","__unclassified","ja-JP",true,null);assertThat(marked.scopeTotal()).isEqualTo(1);assertThat(marked.unclassified()).isEqualTo(1);assertThat(marked.items()).hasSize(1);assertThat(marked.items().get(0).image().url()).endsWith("/0");assertThat(service.detail("p000",null).item()).isSameAs(rows.get(0));assertThatThrownBy(()->service.detail("private",null)).isInstanceOf(PublicProductBrowseService.Missing.class);}
 @Test void invalidContinuationRejectedBeforeAnyDataRead(){assertThatThrownBy(()->service.browse(1,null,"","","ja-JP",false,null)).isInstanceOf(IllegalArgumentException.class);assertThatThrownBy(()->service.browse(0,0L,"","","ja-JP",false,null)).isInstanceOf(IllegalArgumentException.class);assertThatThrownBy(()->service.browse(0,null,"","","xx",false,null)).isInstanceOf(IllegalArgumentException.class);assertThat(catalog.reads+markers.reads).isZero();}
 @Test void emptyAndExactMultipleDoNotRequireTerminalExtraPage(){catalog.rows=List.of();markers.rows=List.of();var empty=service.browse(0,null,"","","ja-JP",false,null);assertThat(empty.hasNext()).isFalse();assertThat(empty.matchedTotal()).isZero();catalog.rows=java.util.stream.IntStream.range(0,24).mapToObj(i->row(i,null)).toList();var exact=service.browse(0,null,"","","ja-JP",false,null);assertThat(exact.items()).hasSize(24);assertThat(exact.hasNext()).isFalse();}
 @Test void markedScopeCountPrecedesSearchCategoryAndPagingWithoutExtraCatalogRead(){setup();markers.rows=List.of(new ProductMarkerService.PublicAssignment("p050",List.of(new ProductMarkerService.Definition("m","new","N",Map.of(),Map.of(),"red",0,true,0))));var emptySearch=service.browse(0,null,"no matching term","odd","ja-JP",true,null);assertThat(emptySearch.items()).isEmpty();assertThat(emptySearch.scopeTotal()).isZero();assertThat(emptySearch.markedScopeTotal()).isEqualTo(1);assertThat(catalog.reads).isEqualTo(1);markers.rows=List.of();assertThat(service.browse(0,null,"","","ja-JP",true,null).markedScopeTotal()).isZero();}
}
