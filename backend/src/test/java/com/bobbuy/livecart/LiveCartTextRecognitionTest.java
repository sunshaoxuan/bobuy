package com.bobbuy.livecart;

import com.bobbuy.model.Role;
import com.bobbuy.repository.ProductRepository;
import com.bobbuy.security.BobbuyAuthenticatedUser;
import com.bobbuy.service.LlmGateway;
import com.bobbuy.service.ProductSaleService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

class LiveCartTextRecognitionTest {
 private final JdbcClient db=mock(JdbcClient.class,RETURNS_DEEP_STUBS);
 private final LlmGateway llm=mock(LlmGateway.class);
 private final LiveCartService service=new LiveCartService(db,mock(com.bobbuy.repository.UserRepository.class),mock(ProductRepository.class),mock(ProductSaleService.class),llm,new ObjectMapper());

 @Test void unavailableProviderReturnsBusinessErrorBeforeAnyWrite() {
  when(db.sql(any()).params(any(Object[].class)).query(any(org.springframework.jdbc.core.RowMapper.class)).optional()).thenReturn(Optional.empty());
  clearInvocations(db);
  when(llm.generate(any(),any(),any())).thenReturn(Optional.empty());
  var input=new LiveCartModels.TextRequest(UUID.randomUUID(),41,0,"无糖豆浆两箱，草莓一盒",true);

  assertThatThrownBy(()->service.addTextRequests(input,customer()))
      .isInstanceOf(LiveCartException.class).hasMessage("CART_REQUEST_RECOGNITION_FAILED");
  verify(db).sql("select id,input_hash,cart_id from bb_live_cart_request_batch where customer_id=? and merchant_id=? and operation_id=?");
  verifyNoMoreInteractions(db);
 }

 @Test void incompleteCoverageIsRejectedRatherThanFallingBack() {
  when(llm.generate(any(),any(),any())).thenReturn(Optional.of("[{\"fragment\":\"无糖豆浆两箱\",\"name\":\"无糖豆浆\",\"quantity\":2,\"unit\":\"箱\",\"quantityConfirmed\":true}]"));
  assertThatThrownBy(()->parse("无糖豆浆两箱，草莓一盒"))
      .isInstanceOf(LiveCartException.class).hasMessage("CART_REQUEST_RECOGNITION_FAILED");
 }

 @Test void completeStructuredMixedInputKeepsEveryExactFragment() throws Exception {
  when(llm.generate(any(),any(),any())).thenReturn(Optional.of("[{\"fragment\":\"无糖豆浆两箱\",\"name\":\"无糖豆浆\",\"quantity\":2,\"unit\":\"箱\",\"quantityConfirmed\":true},{\"fragment\":\"草莓一盒\",\"name\":\"草莓\",\"quantity\":1,\"unit\":\"盒\",\"constraints\":\"不要太熟\",\"quantityConfirmed\":true}]"));
  var parsed=parse("无糖豆浆两箱，草莓一盒");
  assertThat(parsed).hasSize(2);
  assertThat(parsed.toString()).contains("fragment=无糖豆浆两箱","quantity=2","fragment=草莓一盒","constraints=不要太熟");
 }

 @Test void splitsMergedLeadingStandaloneItemNumber() throws Exception {
  when(llm.generate(any(),any(),any())).thenReturn(Optional.of("[{\"fragment\":\"59363，卖场新出的黑芝麻雪糕\",\"name\":\"黑芝麻雪糕\",\"quantity\":1}]"));
  assertThat(parse("59363，卖场新出的黑芝麻雪糕").toString()).contains("fragment=59363","fragment=卖场新出的黑芝麻雪糕");
 }

 @Test void splitsMiddleAndMultipleStandaloneItemNumbersWithoutChangingOtherModelLines() throws Exception {
  when(llm.generate(any(),any(),any())).thenReturn(Optional.of("[{\"fragment\":\"牛奶\",\"name\":\"牛奶\",\"quantity\":1},{\"fragment\":\"苹果，59363，雪糕，48271\",\"name\":\"苹果和雪糕\",\"quantity\":1},{\"fragment\":\"草莓\",\"name\":\"草莓\",\"quantity\":1}]"));
  var parsed=parse("牛奶，苹果，59363，雪糕，48271，草莓");
  assertThat(parsed).hasSize(6);
  assertThat(parsed.toString()).contains("fragment=牛奶","fragment=苹果","fragment=59363","fragment=雪糕","fragment=48271","fragment=草莓");
 }

 @Test void alreadyCorrectModelSplitIsPreserved() throws Exception {
  when(llm.generate(any(),any(),any())).thenReturn(Optional.of("[{\"fragment\":\"牛奶\",\"name\":\"牛奶\",\"quantity\":2},{\"fragment\":\"苹果\",\"name\":\"苹果\",\"quantity\":3},{\"fragment\":\"草莓\",\"name\":\"草莓\",\"quantity\":4}]"));
  assertThat(parse("牛奶，苹果；草莓").toString()).contains("fragment=牛奶, name=牛奶, quantity=2","fragment=苹果, name=苹果, quantity=3","fragment=草莓, name=草莓, quantity=4");
 }

 @Test void ambiguousMergedItemNumberIsRejected() {
  when(llm.generate(any(),any(),any())).thenReturn(Optional.of("[{\"fragment\":\"不要，59363，改要雪糕\",\"name\":\"雪糕\",\"quantity\":1}]"));
  assertThatThrownBy(()->parse("不要，59363，改要雪糕")).isInstanceOf(LiveCartException.class).hasMessage("CART_REQUEST_RECOGNITION_FAILED");
 }

 private List<?> parse(String text) throws Exception {
  Method method=LiveCartService.class.getDeclaredMethod("parseText",String.class,boolean.class);method.setAccessible(true);
  try{return (List<?>)method.invoke(service,text,true);}catch(InvocationTargetException e){if(e.getCause() instanceof RuntimeException runtime)throw runtime;throw e;}
 }
 private UsernamePasswordAuthenticationToken customer(){var principal=new BobbuyAuthenticatedUser(17L,"17","Customer",Set.of(Role.CUSTOMER));return new UsernamePasswordAuthenticationToken(principal,"",List.of(()->"ROLE_CUSTOMER"));}
}
