package com.bobbuy.api;

import com.bobbuy.service.LlmGateway;
import com.bobbuy.api.response.ApiException;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RecommendationWritingControllerTest {
 LlmGateway gateway=mock(LlmGateway.class);
 RecommendationWritingController controller=new RecommendationWritingController(gateway);
 @BeforeEach void login(){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("agent-1","",List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));}
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 @Test void stepsRequireExplicitConfirmedInputs(){
  assertThrows(ApiException.class,()->controller.assist(new RecommendationWritingController.Request("prompt","idea","brief","",false,false,List.of())));
  assertThrows(ApiException.class,()->controller.assist(new RecommendationWritingController.Request("draft","idea","brief","prompt",true,false,List.of())));
  verifyNoInteractions(gateway);
 }
 @Test void usesRealGatewayAndDoesNotManufactureSuccessfulOutput(){
  when(gateway.generate(anyString(),isNull(),isNull())).thenReturn(Optional.empty());
  assertThrows(ApiException.class,()->controller.assist(new RecommendationWritingController.Request("intent","idea",null,null,false,false,List.of())));
 }
 @Test void customerCannotCallModel(){
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("customer-1","",List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER"))));
  assertThrows(ApiException.class,()->controller.assist(new RecommendationWritingController.Request("intent","idea",null,null,false,false,List.of())));
  verifyNoInteractions(gateway);
 }
 @Test void confirmedDraftCarriesOnlyReviewedFactsAndNoPublication(){
  when(gateway.generate(anyString(),isNull(),isNull())).thenReturn(Optional.of("Article"));
  when(gateway.getActiveMainProvider()).thenReturn("ollama");when(gateway.getMainModel()).thenReturn("fixture");
  assertNotNull(controller.assist(new RecommendationWritingController.Request("draft","idea","brief","prompt",true,true,List.of("supplier reference 100 JPY; expiry unknown"))));
  verify(gateway).generate(argThat(s->s.contains("supplier reference 100 JPY")&&s.contains("Unknowns stay unknown")&&s.contains("No automatic publication")),isNull(),isNull());
 }
}
