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
 ResultActions pricing(String path,Object body,String token)throws Exception{return mvc.perform(post("/api/merchant/product-pricing/"+ids.get(0)+path).header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(body)));}
 JsonNode regular(int amount,long revision)throws Exception{return data(mvc.perform(put("/api/merchant/product-pricing/"+ids.get(0)+"/regular").header("Authorization","Bearer "+owner).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("amount",amount,"currency","JPY","unit","1 pack","revision",revision,"replaceExisting",true,"enabled",true,"confirmed",true,"reason","Synthetic confirmed regular")))));}
 @Test void identicalConfirmationIsNoOpAndConcurrentRetryCannotCreateAnotherEffectiveDocument()throws Exception{
  regular(2998,0);var saved=products.findById(ids.get(0)).orElseThrow();long revision=saved.getSale().revision();long count=documents.count();regular(2998,revision);assertThat(documents.count()).isEqualTo(count);assertThat(products.findById(ids.get(0)).orElseThrow().getSale().revision()).isEqualTo(revision);
  var executor=java.util.concurrent.Executors.newFixedThreadPool(2);
  try{var jobs=new ArrayList<java.util.concurrent.Callable<Integer>>();for(int i=0;i<2;i++)jobs.add(()->mvc.perform(put("/api/merchant/product-pricing/"+ids.get(0)+"/regular").header("Authorization","Bearer "+owner).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("amount",3000,"currency","JPY","unit","1 pack","revision",revision,"replaceExisting",true,"enabled",true,"confirmed",true,"reason","Synthetic concurrent confirmation")))).andReturn().getResponse().getStatus());var codes=new ArrayList<Integer>();for(var result:executor.invokeAll(jobs))codes.add(result.get());assertThat(codes).containsExactlyInAnyOrder(200,400);assertThat(documents.count()).isEqualTo(count+1);}finally{executor.shutdownNow();}
 }
 @Test void unitCorrectionPreservesActiveAndScheduledOriginalTermsAndRejectsStaleOrForeignRequests()throws Exception{
  regular(2998,0);when(time.now()).thenReturn(now.plusSeconds(2));var scheduled=input("PROMOTION",List.of(line(0,2500)));scheduled.put("startsAt",now.plusSeconds(60));approve(draft(scheduled));
  var originals=documents.findByProductIdOrderByCreatedAtDescIdDesc(ids.get(0));var versions=new TreeMap<Long,Long>();originals.forEach(d->versions.put(d.id,d.version));
  var body=new HashMap<String,Object>(Map.of("amount",2998,"currency","JPY","unit","case","revision",1,"documents",versions,"reason","Synthetic label correction only","confirmed",true));
  pricing("/unit-correction",body,foreign).andExpect(status().isNotFound());body.put("amount",3000);pricing("/unit-correction",body,owner).andExpect(status().isBadRequest());body.put("amount",2998);
  var corrected=data(pricing("/unit-correction",body,owner));assertThat(corrected.at("/regular/unit").asText()).isEqualTo("case");assertThat(corrected.at("/effective/amount").decimalValue()).isEqualByComparingTo("2998");assertThat(documents.count()).isEqualTo(4);
  for(var old:originals){var kept=documents.findById(old.id).orElseThrow();assertThat(kept.status).isEqualTo(ProductPriceAdjustment.Status.CANCELLED);assertThat(kept.line(ids.get(0)).unit).isEqualTo("1 pack");assertThat(kept.evidence).containsKey("supersededBy");}
  var p=products.findById(ids.get(0)).orElseThrow();assertThat(sales.quoteAt(p,now.plusSeconds(70)).orElseThrow().amount()).isEqualByComparingTo("2500");assertThat(sales.quoteAt(p,now.plusSeconds(3600)).orElseThrow().amount()).isEqualByComparingTo("2998");pricing("/unit-correction",body,owner).andExpect(status().isBadRequest());assertThat(documents.count()).isEqualTo(4);
 }
 @Test void cancellingConfirmedPermanentRestoresSurvivingRegularAndPreservesHistory()throws Exception{
  regular(2998,0);when(time.now()).thenReturn(now.plusSeconds(2));regular(3200,1);var latest=documents.findByProductIdOrderByCreatedAtDescIdDesc(ids.get(0)).get(0);assertThat(products.findById(ids.get(0)).orElseThrow().getSale().amount()).isEqualByComparingTo("3200");
  var preview=data(request("GET","/"+latest.id+"/cancellation-preview",Map.of(),owner));assertThat(preview.at("/impacts/0/amountAfter").decimalValue()).isEqualByComparingTo("2998");var body=Map.of("version",preview.get("version").asLong(),"token",preview.get("token").asText(),"confirmed",true,"reason","Synthetic incorrect confirmation withdrawn");
  request("POST","/"+latest.id+"/cancel-reviewed",body,foreign).andExpect(status().isBadRequest());data(request("POST","/"+latest.id+"/cancel-reviewed",body,owner));var p=products.findById(ids.get(0)).orElseThrow();assertThat(p.getSale().amount()).isEqualByComparingTo("2998");assertThat(sales.quote(p).orElseThrow().amount()).isEqualByComparingTo("2998");var kept=documents.findById(latest.id).orElseThrow();assertThat(kept.line(p.getId()).amount).isEqualByComparingTo("3200");assertThat(kept.approvedAt).isEqualTo(latest.approvedAt);assertThat(kept.evidence).containsKey("cancellationPreview");request("POST","/"+latest.id+"/cancel-reviewed",body,owner).andExpect(status().isBadRequest());
  var remaining=documents.findByProductIdOrderByCreatedAtDescIdDesc(p.getId()).stream().filter(d->d.status==ProductPriceAdjustment.Status.APPROVED).findFirst().orElseThrow();request("GET","/"+remaining.id+"/cancellation-preview",Map.of(),owner).andExpect(status().isBadRequest());
 }
 @Test void cancellationPreviewRejectsChangedPriceContextAndCoversScheduledAllLines()throws Exception{
  var row=approve(draft(input("TEMPORARY",List.of(line(0,800),line(1,900))))).get("value");var preview=data(request("GET","/"+row.get("id").asLong()+"/cancellation-preview",Map.of(),owner));assertThat(preview.get("impacts")).hasSize(2);regular(1200,0);
  var body=new HashMap<String,Object>(Map.of("version",preview.get("version").asLong(),"token",preview.get("token").asText(),"confirmed",true,"reason","Synthetic cancel planned document"));request("POST","/"+row.get("id").asLong()+"/cancel-reviewed",body,owner).andExpect(status().isBadRequest());var fresh=data(request("GET","/"+row.get("id").asLong()+"/cancellation-preview",Map.of(),owner));body.put("token",fresh.get("token").asText());data(request("POST","/"+row.get("id").asLong()+"/cancel-reviewed",body,owner));assertThat(sales.quoteAt(products.findById(ids.get(0)).orElseThrow(),now.plusSeconds(2)).orElseThrow().amount()).isEqualByComparingTo("1200");
 }
 @Test void confirmedPrivatePriceStaysPrivateUntilExplicitProductPublication()throws Exception{
  var p=products.findById(ids.get(0)).orElseThrow();p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);products.saveAndFlush(p);regular(2998,0);assertThat(sales.quote(products.findById(p.getId()).orElseThrow())).isEmpty();mvc.perform(get("/api/storefront/product-sales").param("productIds",p.getId())).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
  mvc.perform(patch("/api/mobile/products/"+p.getId()).header("Authorization","Bearer "+owner).contentType(MediaType.APPLICATION_JSON).content("{\"visibilityStatus\":\"PUBLIC\"}")).andExpect(status().isOk());assertThat(sales.quote(products.findById(p.getId()).orElseThrow()).orElseThrow().amount()).isEqualByComparingTo("2998");mvc.perform(get("/api/storefront/product-sales").param("productIds",p.getId())).andExpect(status().isOk()).andExpect(jsonPath("$.data[0].price").value(2998));
 }

 @Autowired CategoryTreeNodeRepository categoryNodes;@Autowired ProductPrimaryCategoryPathRepository categoryPaths;
 @Test void stockProjectionUsesPrimaryPathInsteadOfLegacyCategory()throws Exception{
  String root="price-path-root-"+UUID.randomUUID(),leaf="price-path-leaf-"+UUID.randomUUID();categoryNodes.saveAndFlush(new CategoryTreeNode(root,null,Map.of("ja-JP","飲料","en-US","Drinks"),List.of(root),0,null));categoryNodes.saveAndFlush(new CategoryTreeNode(leaf,root,Map.of("ja-JP","ジュース","en-US","Juice"),List.of(root,leaf),0,null));categoryPaths.saveAndFlush(new ProductPrimaryCategoryPath(ids.get(0),leaf));
  try{mvc.perform(get("/api/mobile/products/"+ids.get(0)).header("Authorization","Bearer "+owner).header("Accept-Language","en-US")).andExpect(status().isOk()).andExpect(jsonPath("$.data.categoryPath").value("Drinks › Juice"));mvc.perform(get("/api/mobile/products/"+ids.get(0)).header("Authorization","Bearer "+owner).header("Accept-Language","ja-JP")).andExpect(status().isOk()).andExpect(jsonPath("$.data.categoryPath").value("飲料 › ジュース"));}finally{categoryPaths.deleteById(ids.get(0));categoryNodes.deleteById(leaf);categoryNodes.deleteById(root);}
 }

 @Test void metadataOnlyConfirmationRetainsIndependentBaseForLaterCancellation()throws Exception{
  var row=approve(draft(input("PERMANENT",List.of(line(0,850))))).get("value");when(time.now()).thenReturn(now.plusSeconds(2));
  data(mvc.perform(put("/api/merchant/product-pricing/"+ids.get(0)+"/regular").header("Authorization","Bearer "+owner).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("amount",850,"currency","JPY","unit","1 pack","revision",0,"replaceExisting",true,"enabled",false,"confirmed",true,"reason","Synthetic sale disabled without changing amount")))));
  assertThat(documents.count()).isEqualTo(1);assertThat(products.findById(ids.get(0)).orElseThrow().getSale().amount()).isEqualByComparingTo("1000");var preview=data(request("GET","/"+row.get("id").asLong()+"/cancellation-preview",Map.of(),owner));assertThat(preview.at("/impacts/0/regularAfter").decimalValue()).isEqualByComparingTo("1000");
 }

}
