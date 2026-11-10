package com.bobbuy.api;
import com.bobbuy.service.PublicProductCatalogService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest(properties="bobbuy.security.header-auth.enabled=false") @AutoConfigureMockMvc
class PublicProductCatalogHttpTest {
 @Autowired MockMvc mvc;@MockBean PublicProductCatalogService service;
 @Test void anonymousGetUsesSuccessEnvelopeAndCompletePagingMetadata()throws Exception{when(service.page(0,null)).thenReturn(new PublicProductCatalogService.Page(List.of(),0,24,0,false));mvc.perform(get("/api/storefront/product-catalog")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("success")).andExpect(jsonPath("$.data.page").value(0)).andExpect(jsonPath("$.data.size").value(24)).andExpect(jsonPath("$.data.hasNext").value(false));}
 @Test void invalidBoundsAndMalformedQueryFailBeforeService()throws Exception{for(var value:List.of("-1","100001","abc"))mvc.perform(get("/api/storefront/product-catalog").param("page",value)).andExpect(status().isBadRequest());mvc.perform(get("/api/storefront/product-catalog").param("merchantId","0")).andExpect(status().isBadRequest());}
 @Test void anonymousCannotTurnCatalogReadIntoWriteOrReadMerchantCatalog()throws Exception{mvc.perform(post("/api/storefront/product-catalog").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());mvc.perform(get("/api/merchant/product-catalog")).andExpect(status().isUnauthorized());}
}
