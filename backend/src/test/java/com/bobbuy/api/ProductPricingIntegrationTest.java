package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.*;
import com.bobbuy.security.JwtTokenService;
import com.fasterxml.jackson.databind.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc
class ProductPricingIntegrationTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired BobbuyStore store;@Autowired ProductRepository products;
 @Autowired ProductPriceAdjustmentRepository adjustments;@Autowired UserRepository users;@Autowired JwtTokenService tokens;
 @Autowired ProductSaleService sales;@Autowired OrderHeaderRepository orders;
 @MockBean PricingTime time;
 String id,admin,other,buyer;Instant now=Instant.parse("2026-10-26T14:58:00Z");
 @BeforeEach void setup(){
  adjustments.deleteAll();store.seed();when(time.now()).thenReturn(now);admin=tokens.createAccessToken(users.findById(1000L).orElseThrow());
  var stranger=new User(9190L,"other",Role.AGENT,0);stranger.setUsername("pricing_other");users.save(stranger);other=tokens.createAccessToken(stranger);
  var customer=new User(9191L,"buyer",Role.CUSTOMER,0);customer.setUsername("pricing_buyer");users.save(customer);buyer=tokens.createAccessToken(customer);
  id="pricing-synthetic-"+UUID.randomUUID();var product=new Product();product.setId(id);product.setMerchantId(1000L);product.setName(Map.of("ja-JP","合成商品"));product.setBasePrice(77);product.setOrderMethod(OrderMethod.PRE_ORDER);product.setVisibilityStatus(ProductVisibility.PUBLIC);product.setSale(new ProductSale(new BigDecimal("1000"),"JPY","1個",null,null,3,1000L,now.minusSeconds(1),true));products.saveAndFlush(product);
 }
 @AfterEach void cleanup(){adjustments.deleteAll();products.deleteById(id);}
 String path(){return "/api/merchant/product-pricing/"+id;}
 JsonNode data(ResultActions result)throws Exception{return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).get("data");}
 ResultActions call(String method,String suffix,Object body,String token)throws Exception{return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request(org.springframework.http.HttpMethod.valueOf(method),path()+suffix).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));}
 Map<String,Object> input(String currency,String amount,Instant start,Instant end,long version){return Map.of("channel","STOREFRONT","currency",currency,"amount",new BigDecimal(amount),"startsAt",start,"endsAt",end,"sourceNote","Synthetic reviewed offer only","version",version);}
 JsonNode draft(Instant start,Instant end)throws Exception{return data(call("POST","/adjustments",input("JPY","800",start,end,0),admin)).at("/history/0/value");}
 JsonNode approve(JsonNode row)throws Exception{return data(call("POST","/adjustments/"+row.get("id").asLong()+"/approve",Map.of("version",row.get("version").asLong(),"confirmed",true),admin));}
 ProductSaleService.Quote quote(Instant at){return sales.quoteAt(products.findById(id).orElseThrow(),at).orElseThrow();}
 @Test void jstMidnightHalfOpenBoundariesRestoreRegularAndNeverMutateIt()throws Exception{
  Instant start=Instant.parse("2026-10-26T15:00:00Z"),end=start.plusSeconds(3600);var before=products.findById(id).orElseThrow().getSale();
  var row=draft(start,end);assertThat(quote(start).amount()).isEqualByComparingTo("1000");approve(row);
  assertThat(quote(start.minusNanos(1)).amount()).isEqualByComparingTo("1000");assertThat(quote(start).amount()).isEqualByComparingTo("800");assertThat(quote(end.minusNanos(1)).amount()).isEqualByComparingTo("800");assertThat(quote(end).amount()).isEqualByComparingTo("1000");
  assertThat(quote(start).priceToken()).isNotEqualTo(quote(end).priceToken());assertThat(quote(start.minusNanos(1)).priceToken()).isEqualTo(quote(end).priceToken());
  assertThat(products.findById(id).orElseThrow().getSale()).isEqualTo(before);assertThat(products.findById(id).orElseThrow().getBasePrice()).isEqualTo(77);
  when(time.now()).thenReturn(end);assertThat(data(mvc.perform(get(path()).header("Authorization","Bearer "+admin))).at("/history/0/state").asText()).isEqualTo("EXPIRED");
 }
 @Test void adjacentIntervalsAllowedOverlapRejectedAndConcurrentApprovalsSerialize()throws Exception{
  var first=draft(now.plusSeconds(30),now.plusSeconds(90));var second=draft(now.plusSeconds(60),now.plusSeconds(120));
  var latch=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
  try{var tasks=new ArrayList<Future<Integer>>();for(var row:List.of(first,second))tasks.add(pool.submit(()->{latch.await();return call("POST","/adjustments/"+row.get("id").asLong()+"/approve",Map.of("version",0,"confirmed",true),admin).andReturn().getResponse().getStatus();}));latch.countDown();var statuses=new ArrayList<Integer>();for(var task:tasks)statuses.add(task.get(20,TimeUnit.SECONDS));assertThat(statuses).containsExactlyInAnyOrder(200,400);}finally{pool.shutdownNow();}
  var approved=adjustments.findAll().stream().filter(a->a.status==ProductPriceAdjustment.Status.APPROVED).findFirst().orElseThrow();
  approve(draft(approved.endsAt,approved.endsAt.plusSeconds(60)));
  assertThat(adjustments.findAll().stream().filter(a->a.status==ProductPriceAdjustment.Status.APPROVED)).hasSize(2);
 }
 @Test void draftOwnershipVersionsPrecisionAndApprovalSafety()throws Exception{
  mvc.perform(get(path())).andExpect(status().isForbidden());mvc.perform(get(path()).header("Authorization","Bearer "+buyer)).andExpect(status().isForbidden());mvc.perform(get(path()).header("Authorization","Bearer "+other)).andExpect(status().isNotFound());
  for(String amount:List.of("0","-1","800.5","1000000001"))call("POST","/adjustments",input("JPY",amount,now.plusSeconds(1),now.plusSeconds(60),0),admin).andExpect(status().isBadRequest());
  call("POST","/adjustments",input("JPY","800",now,now,0),admin).andExpect(status().isBadRequest());
  var row=draft(now.plusSeconds(1),now.plusSeconds(60));String suffix="/adjustments/"+row.get("id").asLong();
  mvc.perform(delete("/api/mobile/products/"+id).header("Authorization","Bearer "+admin)).andExpect(status().isBadRequest());assertThat(products.existsById(id)).isTrue();
  call("PUT",suffix,input("JPY","700",now.plusSeconds(1),now.plusSeconds(60),0),other).andExpect(status().isNotFound());
  data(call("PUT",suffix,input("JPY","700",now.plusSeconds(1),now.plusSeconds(60),0),admin));call("PUT",suffix,input("JPY","600",now.plusSeconds(1),now.plusSeconds(60),0),admin).andExpect(status().isBadRequest());
  call("POST",suffix+"/approve",Map.of("version",1,"confirmed",false),admin).andExpect(status().isBadRequest());
  var updated=data(mvc.perform(get(path()).header("Authorization","Bearer "+admin))).at("/history/0/value");approve(updated);
  call("PUT",suffix,input("JPY","600",now.plusSeconds(1),now.plusSeconds(60),2),admin).andExpect(status().isBadRequest());
  var usd=data(call("POST","/adjustments",input("USD","8.25",now.plusSeconds(1),now.plusSeconds(60),0),admin)).at("/history/0/value");call("POST","/adjustments/"+usd.get("id").asLong()+"/approve",Map.of("version",0,"confirmed",true),admin).andExpect(status().isBadRequest());
  var unpriced=products.findById(id).orElseThrow();unpriced.setSale(null);unpriced.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);products.saveAndFlush(unpriced);var missing=draft(now.plusSeconds(120),now.plusSeconds(180));call("POST","/adjustments/"+missing.get("id").asLong()+"/approve",Map.of("version",0,"confirmed",true),admin).andExpect(status().isBadRequest());assertThat(sales.quote(unpriced)).isEmpty();
 }
 @Test void staleCartRejectedAndOrderKeepsExactPriceSnapshotAfterCancelAndRegularChange()throws Exception{
  var before=quote(now);var row=draft(now.minusSeconds(1),now.plusSeconds(60));approve(row);var current=quote(now);
  var stale=Map.of("requestId",UUID.randomUUID(),"tripId",2000,"currency","JPY","items",List.of(Map.of("productId",id,"quantity",2,"currency","JPY","priceRevision",3,"priceToken",before.priceToken())));
  mvc.perform(post("/api/checkout").header("Authorization","Bearer "+buyer).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(stale))).andExpect(status().isBadRequest());
  var body=Map.of("requestId",UUID.randomUUID(),"tripId",2000,"currency","JPY","items",List.of(Map.of("productId",id,"quantity",2,"currency","JPY","priceRevision",3,"priceToken",current.priceToken())));
  var orderResult=data(mvc.perform(post("/api/checkout").header("Authorization","Bearer "+buyer).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))));assertThat(orderResult.get("total").asInt()).isEqualTo(1600);
  var paid=orders.findById(orderResult.get("orderId").asLong()).orElseThrow();paid.setPaymentStatus(PaymentStatus.PAID);orders.saveAndFlush(paid);
  call("PUT","/regular",Map.of("amount",1200,"currency","JPY","unit","100g","revision",3,"replaceExisting",true,"enabled",true,"confirmed",true),admin).andExpect(status().isBadRequest());
  when(time.now()).thenReturn(now.plusSeconds(60));var expiredCart=new HashMap<String,Object>(body);expiredCart.put("requestId",UUID.randomUUID());mvc.perform(post("/api/checkout").header("Authorization","Bearer "+buyer).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(expiredCart))).andExpect(status().isBadRequest());when(time.now()).thenReturn(now);
  var approved=data(mvc.perform(get(path()).header("Authorization","Bearer "+admin))).at("/history/0/value");data(call("POST","/adjustments/"+approved.get("id").asLong()+"/cancel",Map.of("version",approved.get("version").asLong(),"confirmed",true),admin));
  data(call("PUT","/regular",Map.of("amount",1200,"currency","JPY","unit","1個","revision",3,"replaceExisting",true,"enabled",true,"confirmed",true),admin));assertThat(quote(now).amount()).isEqualByComparingTo("1200");
  var saved=orders.findById(orderResult.get("orderId").asLong()).orElseThrow();assertThat(saved.getTotalAmount()).isEqualTo(1600);assertThat(saved.getPaymentStatus()).isEqualTo(PaymentStatus.PAID);var line=saved.getLines().get(0);assertThat(line.getQuotedAmount()).isEqualByComparingTo("800");assertThat(line.getRegularAmount()).isEqualByComparingTo("1000");assertThat(line.getPriceAdjustmentId()).isEqualTo(row.get("id").asLong());assertThat(line.getCurrency()).isEqualTo("JPY");assertThat(line.getPricedAt()).isEqualTo(now);
 }
}
