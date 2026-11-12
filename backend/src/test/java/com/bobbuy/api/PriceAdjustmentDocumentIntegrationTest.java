package com.bobbuy.api;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.*;
import com.bobbuy.security.JwtTokenService;
import com.fasterxml.jackson.databind.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
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
class PriceAdjustmentDocumentIntegrationTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired BobbuyStore store;@Autowired ProductRepository products;@Autowired ProductPriceAdjustmentRepository documents;@Autowired UserRepository users;@Autowired JwtTokenService tokens;@Autowired ProductSaleService sales;
 @MockBean PricingTime time;
 String owner,foreign;List<String> ids=new ArrayList<>();Instant now=Instant.parse("2026-11-12T15:00:00Z");
 @BeforeEach void setup(){documents.deleteAll();store.seed();when(time.now()).thenReturn(now);owner=tokens.createAccessToken(users.findById(1000L).orElseThrow());var u=new User(9911L,"Synthetic foreign owner",Role.AGENT,0);u.setUsername("price_doc_foreign");users.save(u);foreign=tokens.createAccessToken(u);product("a",1000L);product("b",1000L);product("foreign",9911L);}
 @AfterEach void cleanup(){documents.deleteAll();products.deleteAllById(ids);}
 String product(String suffix,long merchant){String id="price-doc-"+suffix+"-"+UUID.randomUUID();var p=new Product();p.setId(id);p.setMerchantId(merchant);p.setName(Map.of("ja-JP","Synthetic "+suffix));p.setOrderMethod(OrderMethod.PRE_ORDER);p.setVisibilityStatus(ProductVisibility.PUBLIC);p.setSale(new ProductSale(new BigDecimal("1000"),"JPY","1 pack",null,null,0,merchant,now,true));products.saveAndFlush(p);ids.add(id);return id;}
 Map<String,Object> line(int n,int amount){return Map.of("productId",ids.get(n),"amount",amount,"unit","1 pack","beforeAmount",1000);}
 Map<String,Object> input(String type,List<Map<String,Object>> lines){var value=new HashMap<String,Object>();value.put("type",type);value.put("channel","STOREFRONT");value.put("currency","JPY");value.put("startsAt",now.plusSeconds(1));value.put("endsAt",type.equals("PERMANENT")?null:now.plusSeconds(3600));value.put("reason","Synthetic planned campaign reason");value.put("lines",lines);value.put("version",0);return value;}
 ResultActions request(String method,String path,Object body,String token)throws Exception{return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request(org.springframework.http.HttpMethod.valueOf(method),"/api/merchant/price-adjustments"+path).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body)));}
 JsonNode data(ResultActions result)throws Exception{return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).get("data");}
 JsonNode draft(Map<String,Object> input)throws Exception{return data(request("POST","",input,owner)).get("value");}
 JsonNode approve(JsonNode row)throws Exception{return data(request("POST","/"+row.get("id").asLong()+"/approve",Map.of("version",row.get("version").asLong(),"confirmed",true),owner));}
 @Test void batchDocumentApprovesAllLinesWithOneReasonAndSharedIdentity()throws Exception{
  var row=draft(input("PROMOTION",List.of(line(0,800),line(1,900))));assertThat(row.get("lines")).hasSize(2);assertThat(row.get("sourceNote").asText()).contains("campaign reason");assertThat(row.get("documentNumber").asText()).startsWith("PC-");approve(row);
  var a=sales.quoteAt(products.findById(ids.get(0)).orElseThrow(),now.plusSeconds(2)).orElseThrow();var b=sales.quoteAt(products.findById(ids.get(1)).orElseThrow(),now.plusSeconds(2)).orElseThrow();assertThat(a.amount()).isEqualByComparingTo("800");assertThat(b.amount()).isEqualByComparingTo("900");assertThat(a.adjustmentId()).isEqualTo(b.adjustmentId());
 }
 @Test void missingReasonAndForeignProductCannotCreatePartialDocuments()throws Exception{
  var value=input("PROMOTION",List.of(line(0,800),line(1,900)));value.put("reason","  ");request("POST","",value,owner).andExpect(status().isBadRequest());assertThat(documents.count()).isZero();value.put("reason","Synthetic review");value.put("lines",List.of(line(0,800),line(2,900)));request("POST","",value,owner).andExpect(status().isNotFound());assertThat(documents.count()).isZero();
 }
 @Test void permanentChangePersistsAsRegularAndTemporaryChangeRevertsToIt()throws Exception{
  var permanent=draft(input("PERMANENT",List.of(line(0,850))));approve(permanent);var p=products.findById(ids.get(0)).orElseThrow();assertThat(sales.quoteAt(p,now).orElseThrow().amount()).isEqualByComparingTo("1000");assertThat(sales.quoteAt(p,now.plusSeconds(2)).orElseThrow().regularAmount()).isEqualByComparingTo("850");assertThat(sales.quoteAt(p,now.plusSeconds(86400)).orElseThrow().amount()).isEqualByComparingTo("850");
  var temporary=draft(input("TEMPORARY",List.of(line(0,950))));approve(temporary);assertThat(sales.quoteAt(p,now.plusSeconds(2)).orElseThrow().amount()).isEqualByComparingTo("950");assertThat(sales.quoteAt(p,now.plusSeconds(3600)).orElseThrow().amount()).isEqualByComparingTo("850");
 }
 @Test void promotionCannotRaisePriceAndSupplierPriceCannotBecomeStorefrontPrice()throws Exception{
  var invalid=draft(input("PROMOTION",List.of(line(0,1100))));request("POST","/"+invalid.get("id").asLong()+"/approve",Map.of("version",0,"confirmed",true),owner).andExpect(status().isBadRequest());
  var source=input("PROMOTION",List.of(line(0,10)));source.put("channel","COSTCO_ONLINE");approve(draft(source));assertThat(sales.quoteAt(products.findById(ids.get(0)).orElseThrow(),now.plusSeconds(2)).orElseThrow().amount()).isEqualByComparingTo("1000");
 }
 @Test void permanentRegularProjectionUpdatesSingleProductReadWithoutOverwritingHistory()throws Exception{
  var row=draft(input("PERMANENT",List.of(line(0,850))));approve(row);when(time.now()).thenReturn(now.plusSeconds(2));
  var response=mvc.perform(get("/api/mobile/products/"+ids.get(0)).header("Authorization","Bearer "+owner)).andExpect(status().isOk()).andReturn().getResponse();var value=json.readTree(response.getContentAsByteArray()).get("data");assertThat(value.at("/currentRegular/amount").decimalValue()).isEqualByComparingTo("850");assertThat(products.findById(ids.get(0)).orElseThrow().getSale().amount()).isEqualByComparingTo("1000");
 }
 @Test void unresolvedSourceCanBeExplicitlyLinkedOnlyToMatchingOwnedProduct()throws Exception{
  var p=products.findById(ids.get(0)).orElseThrow();p.setItemNumber("SOURCE-SKU");products.saveAndFlush(p);var d=new ProductPriceAdjustment();d.merchantId=1000L;d.createdBy=1000L;d.updatedBy=1000L;d.createdAt=now;d.updatedAt=now;d.createdBy=1000L;d.updatedBy=1000L;d.createdAt=now;d.updatedAt=now;d.documentNumber="PC-UNRESOLVED";d.sourceNote="Review missing product";d.channel="COSTCO_ONLINE";d.currency="JPY";d.evidence.put("sourceItemId",77L);d.evidence.put("sourceItemNumber","SOURCE-SKU");d.evidence.put("reviewRequired",true);var l=new ProductPriceAdjustmentLine();l.document=d;l.referenceItemId=77L;l.amount=new BigDecimal("800");l.unit="1 pack";d.lines.add(l);documents.saveAndFlush(d);
  var value=input("PROMOTION",List.of(line(1,800)));value.put("channel","COSTCO_ONLINE");value.put("version",documents.findById(d.id).orElseThrow().version);request("PUT","/"+d.id,value,owner).andExpect(status().isBadRequest());value.put("lines",List.of(line(0,800)));var saved=data(request("PUT","/"+d.id,value,owner)).get("value");assertThat(saved.at("/lines/0/referenceItemId").asLong()).isEqualTo(77L);assertThat(saved.at("/lines/0/productId").asText()).isEqualTo(p.getId());approve(saved);
 }
 @Test void supplierUnitCannotBlockSellingPriceAndChangeHistoryUsesEffectiveRegular()throws Exception{
  var supplier=input("PERMANENT",List.of(Map.of("productId",ids.get(0),"amount",80,"unit","100 g")));supplier.put("channel","COSTCO_ONLINE");approve(draft(supplier));approve(draft(input("PERMANENT",List.of(line(0,850)))));when(time.now()).thenReturn(now.plusSeconds(2));
  var response=mvc.perform(put("/api/merchant/product-pricing/"+ids.get(0)+"/regular").header("Authorization","Bearer "+owner).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("amount",900,"currency","JPY","unit","1 pack","revision",0,"replaceExisting",true,"enabled",true,"confirmed",true,"reason","Synthetic regular supplier cost adjustment"))));
  var result=data(response);assertThat(result.at("/regular/amount").decimalValue()).isEqualByComparingTo("900");var latest=documents.findByProductIdOrderByCreatedAtDescIdDesc(ids.get(0)).get(0);assertThat(latest.line(ids.get(0)).beforeAmount).isEqualByComparingTo("850");assertThat(latest.sourceNote).contains("supplier cost");
 }
 @Test void cancellationRequiresReasonAndPreservesApprovalAndOriginalReason()throws Exception{
  var row=draft(input("PROMOTION",List.of(line(0,800))));var approved=approve(row).get("value");String path="/"+row.get("id").asLong()+"/cancel";
  request("POST",path,Map.of("version",approved.get("version").asLong(),"confirmed",true),owner).andExpect(status().isBadRequest());
  var cancelled=data(request("POST",path,Map.of("version",approved.get("version").asLong(),"confirmed",true,"reason","Synthetic campaign withdrawn"),owner)).get("value");assertThat(cancelled.get("status").asText()).isEqualTo("CANCELLED");assertThat(cancelled.get("approvedAt")).isEqualTo(approved.get("approvedAt"));assertThat(cancelled.get("sourceNote")).isEqualTo(approved.get("sourceNote"));assertThat(cancelled.get("cancellationReason").asText()).contains("withdrawn");
 }
 @Test void lineOnlyChangesInvalidateStaleHeaderVersionAndOtherTenantCannotReadOrAct()throws Exception{
  var value=input("PROMOTION",List.of(line(0,800)));var row=draft(value);String path="/"+row.get("id").asLong();value.put("lines",List.of(line(0,700)));var edited=data(request("PUT",path,value,owner)).get("value");assertThat(edited.get("version").asLong()).isGreaterThan(row.get("version").asLong());request("PUT",path,value,owner).andExpect(status().isBadRequest());request("POST",path+"/approve",Map.of("version",edited.get("version").asLong(),"confirmed",true),foreign).andExpect(status().isBadRequest());assertThat(data(request("GET","",Map.of(),foreign))).isEmpty();
 }
}
