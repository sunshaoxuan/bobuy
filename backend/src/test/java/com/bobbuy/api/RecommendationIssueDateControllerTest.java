package com.bobbuy.api;

import com.bobbuy.api.response.GlobalExceptionHandler;
import com.bobbuy.service.RecommendationIssueDateService;
import java.time.*;
import org.junit.jupiter.api.*;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RecommendationIssueDateControllerTest {
    final RecommendationIssueDateService service=mock(RecommendationIssueDateService.class);
    MockMvc mvc;
    final String path="/api/merchant/recommendations/12/issue-date";
    final String body="{\"issueDate\":\"2026-10-31\",\"sourceRef\":\"message:source-12\",\"sourceHash\":\""+"a".repeat(64)+"\",\"version\":3,\"reviewed\":true}";
    @BeforeEach void setup(){var messages=new StaticMessageSource();messages.setUseCodeAsDefaultMessage(true);mvc=MockMvcBuilders.standaloneSetup(new RecommendationIssueDateController(service)).setControllerAdvice(new GlobalExceptionHandler(messages)).build();}
    @Test void sourceReviewWireReturnsServerOwnedMetadataAndCalendarDate()throws Exception{
        when(service.save(eq(12L),any())).thenReturn(new RecommendationIssueDateService.Review(LocalDate.of(2026,10,31),"message:source-12","a".repeat(64),7L,Instant.parse("2026-11-01T00:00:00Z"),"REVIEWED_SOURCE",4));
        mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk()).andExpect(jsonPath("$.data.issueDate").value("2026-10-31")).andExpect(jsonPath("$.data.reviewedBy").value(7)).andExpect(jsonPath("$.data.source").value("REVIEWED_SOURCE")).andExpect(jsonPath("$.data.version").value(4));
    }
    @Test void clientIdentityAndUnknownFieldsAreRejectedBeforeService()throws Exception{
        for(String key:new String[]{"userId","merchantId","reviewedBy","reviewedAt","roles","published","issueDateSource","extra"})mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content(body.substring(0,body.length()-1)+",\""+key+"\":99}")).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void invalidDateHashAndVersionAreRejectedBeforeService()throws Exception{
        for(String invalid:new String[]{body.replace("2026-10-31","2026-02-30"),body.replace("a".repeat(64),"bad"),body.replace("\"version\":3","\"version\":-1")})mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content(invalid)).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void staleReviewHasExplicit409AndUnknownReadHasNoInventedDate()throws Exception{
        when(service.save(eq(12L),any())).thenThrow(new RecommendationIssueDateService.Changed());mvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict()).andExpect(jsonPath("$.errorCode").value("RECOMMENDATION_CHANGED"));
        when(service.get(12L)).thenReturn(new RecommendationIssueDateService.Review(null,null,null,null,null,"UNKNOWN",3));mvc.perform(get(path)).andExpect(status().isOk()).andExpect(jsonPath("$.data.issueDate").value(org.hamcrest.Matchers.nullValue())).andExpect(jsonPath("$.data.source").value("UNKNOWN"));
    }
}
