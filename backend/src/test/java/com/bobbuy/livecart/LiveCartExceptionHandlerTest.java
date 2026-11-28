package com.bobbuy.livecart;

import com.bobbuy.api.response.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class LiveCartExceptionHandlerTest {
 @Test void scopedAdviceWinsOverTheGlobalCatchAllForSettlementRejections() throws Exception {
  var service=mock(LiveCartService.class);
  when(service.settle(eq(12L),any())).thenThrow(LiveCartException.conflict("CART_REQUEST_UNLINKED"));
  var mvc=MockMvcBuilders.standaloneSetup(new MerchantLiveCartController(service))
      .setControllerAdvice(new GlobalExceptionHandler(new StaticMessageSource()),new LiveCartExceptionHandler()).build();
  mvc.perform(post("/api/merchant/live-carts/12/settlements").contentType("application/json")
      .content("{\"lineIds\":[7],\"expectedVersion\":3}"))
      .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CART_REQUEST_UNLINKED"));
 }
}
