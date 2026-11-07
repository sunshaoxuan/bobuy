package com.bobbuy.api;
import com.bobbuy.service.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Actual controller/JSON conversion in MockMvc, not a live server or auth-flow test. */
class PublicBrowseHttpContractTest {
 private static class Catalog extends PublicProductCatalogService {Catalog(){super(null,null,null,null,null,null);}@Override public List<Entry> publicEntries(Long owner,Set<String> ids){return List.of(new Entry("p",1L,Map.of("ja-JP","Public"),Map.of("ja-JP","UNOPENED DESCRIPTION"),"Brand","123",Map.of(),null,null,List.of(),List.of(),List.of(),false));}}
 private static class Markers extends ProductMarkerService {Markers(){super(null,null,null,null,null);}@Override public List<PublicAssignment> browseAssignments(Map<String,Long> owners){return List.of();}}
 private static class Recommendations extends RecommendationService {Recommendations(){super(null,null,null,null,null,null,null,null,null,null,null,null);}@Override public List<Detail> publicBrowseEntries(Long owner){return List.of();}}
 @Test void productSummaryDetailValidationAndStaleRevisionHaveExplicitWireContract()throws Exception{
  var mvc=MockMvcBuilders.standaloneSetup(new PublicProductBrowseController(new PublicProductBrowseService(new Catalog(),new Markers()))).build();
  mvc.perform(get("/api/storefront/product-browse")).andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].productId").value("p")).andExpect(jsonPath("$.data.items[0].description").doesNotExist()).andExpect(jsonPath("$.data.items[0].gallery").doesNotExist()).andExpect(jsonPath("$.data.items[0].referenceOffers").doesNotExist()).andExpect(jsonPath("$.data.matchedTotal").value(1)).andExpect(jsonPath("$.data.datasetRevision").isString());
  mvc.perform(get("/api/storefront/product-browse/p")).andExpect(status().isOk()).andExpect(jsonPath("$.data.item.description['ja-JP']").value("UNOPENED DESCRIPTION"));
  mvc.perform(get("/api/storefront/product-browse/private")).andExpect(status().isNotFound());
  mvc.perform(get("/api/storefront/product-browse").param("page","1")).andExpect(status().isBadRequest());
  mvc.perform(get("/api/storefront/product-browse").param("revision","0".repeat(64))).andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("BROWSE_CHANGED"));
  mvc.perform(get("/api/storefront/product-browse").param("merchantId","abc")).andExpect(status().isBadRequest());
 }
 @Test void recommendationEmptyDirectoryAndOccurrenceCountsRemainExplicit()throws Exception{
  var mvc=MockMvcBuilders.standaloneSetup(new PublicRecommendationBrowseController(new PublicRecommendationBrowseService(new Recommendations()))).build();
  mvc.perform(get("/api/storefront/recommendation-browse/issues")).andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(0)).andExpect(jsonPath("$.data.hasNext").value(false));
  mvc.perform(get("/api/storefront/recommendation-browse/items")).andExpect(status().isOk()).andExpect(jsonPath("$.data.scopeTotal").value(0)).andExpect(jsonPath("$.data.productOccurrences").value(0)).andExpect(jsonPath("$.data.serviceCards").value(0));
  mvc.perform(get("/api/storefront/recommendation-browse/items").param("period","invalid")).andExpect(status().isBadRequest());
 }
 @Test void boundedSaleEndpointRejectsMissingOrDuplicateIdsBeforeDataAccess()throws Exception{
  var sales=new StorefrontService(null,null,null,null,null,null,null,null,null,null,"unused",null,null);
  var mvc=MockMvcBuilders.standaloneSetup(new StorefrontController(sales,null,null)).setControllerAdvice(new com.bobbuy.api.response.GlobalExceptionHandler(new org.springframework.context.support.StaticMessageSource())).build();
  mvc.perform(get("/api/storefront/product-sales")).andExpect(status().isBadRequest());
  mvc.perform(get("/api/storefront/product-sales").param("productIds","a,a")).andExpect(status().isBadRequest());
 }
}
