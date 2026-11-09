package com.bobbuy.api;

import com.bobbuy.model.RecommendationItem;
import com.bobbuy.service.PublicRecommendationBrowseService;
import com.bobbuy.service.RecommendationService;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real controller/JSON conversion with synthetic public projection; not live auth or database evidence. */
class RecommendationDirectoryMetadataHttpTest {
    private static class Recommendations extends RecommendationService {
        boolean sourceReviewed;
        Recommendations(){super(null,null,null,null,null,null,null,null,null,null,null,null);}
        @Override public List<Detail> publicBrowseEntries(Long merchant){
            var visible=new RecommendationItem();visible.id=1L;visible.postId=7L;visible.name="Needle";visible.itemNumber="ITEM1";
            visible.showSupplier=true;visible.supplierId="supplier-1";visible.supplierName=Map.of("ja-JP","供給者","en-US","Supplier");
            var other=new RecommendationItem();other.id=2L;other.postId=7L;other.name="Other";other.itemNumber="ITEM2";
            other.showSupplier=false;other.supplierId="private-supplier";other.supplierName=Map.of("en-US","Private supplier");
            var post=new Summary(7L,"Issue",true,1,LocalDateTime.of(2099,1,1,0,0),Instant.parse("2026-01-01T00:00:00Z"),"Publisher is not supplier",null,1L,Map.of(),sourceReviewed?java.time.LocalDate.of(2026,10,31):null,sourceReviewed?"REVIEWED_SOURCE":"UNKNOWN");
            return List.of(new Detail(post,"",List.of(visible,other),"ja-JP","source",Map.of(),null));
        }
    }
    @Test void directoryWireKeepsMatchedAndPublicCountsDistinctAndDoesNotInventIssueDate()throws Exception{
        var mvc=MockMvcBuilders.standaloneSetup(new PublicRecommendationBrowseController(new PublicRecommendationBrowseService(new Recommendations()))).build();
        mvc.perform(get("/api/storefront/recommendation-browse/issues").param("query","ITEM1").param("locale","en-US"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(1))
            .andExpect(jsonPath("$.data.items[0].itemCount").value(1))
            .andExpect(jsonPath("$.data.items[0].publicItemCount").value(2))
            .andExpect(jsonPath("$.data.items[0].suppliers.length()").value(1))
            .andExpect(jsonPath("$.data.items[0].suppliers[0].id").value("supplier-1"))
            .andExpect(jsonPath("$.data.items[0].suppliers[0].name['en-US']").value("Supplier"))
            .andExpect(jsonPath("$.data.items[0].issueDate").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.data.items[0].issueDateSource").value("UNKNOWN"));
    }
    @Test void reviewedIssueDateIsSerializedAsSameCalendarDayOnPostAndDirectoryCard()throws Exception{
        var data=new Recommendations();data.sourceReviewed=true;var mvc=MockMvcBuilders.standaloneSetup(new PublicRecommendationBrowseController(new PublicRecommendationBrowseService(data))).build();
        mvc.perform(get("/api/storefront/recommendation-browse/issues")).andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].issueDate").value("2026-10-31")).andExpect(jsonPath("$.data.items[0].post.issueDate").value("2026-10-31")).andExpect(jsonPath("$.data.items[0].issueDateSource").value("REVIEWED_SOURCE"));
    }
}
