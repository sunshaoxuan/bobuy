package com.bobbuy.api;

import com.bobbuy.api.response.GlobalExceptionHandler;
import com.bobbuy.service.RecommendationRepairService;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RecommendationRepairControllerTest {
 @Test void unconfirmedSourceAndLocaleApplyReturn400WithoutWrites() throws Exception {
  var service=mock(RecommendationRepairService.class);
  var mvc=MockMvcBuilders.standaloneSetup(new RecommendationRepairController(service)).setControllerAdvice(new GlobalExceptionHandler(new StaticMessageSource())).build();
  mvc.perform(post("/api/merchant/recommendations/12/repairs/source-context").contentType(MediaType.APPLICATION_JSON).content("""
   {"version":4,"confirmed":false,"overwrite":false,"preview":{"postId":12,"version":4,"items":[]}}
   """)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("INVALID_REQUEST"));
  mvc.perform(post("/api/merchant/recommendations/12/repairs/locale-suggestions/apply").contentType(MediaType.APPLICATION_JSON).content("""
   {"version":4,"confirmed":false,"edits":[{"productId":"p","productVersion":2,"field":"name","locale":"en-US","value":"Tea"}]}
   """)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.errorCode").value("INVALID_REQUEST"));
  verifyNoInteractions(service);
 }
}
