package com.bobbuy.service;

import com.bobbuy.model.CostcoOnboardingJob;
import com.bobbuy.model.CategoryTreeNode;
import com.bobbuy.model.StorageCondition;
import com.bobbuy.repository.CategoryTreeNodeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.net.URI;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import static com.bobbuy.service.CostcoOnboardingDecision.*;
import static org.junit.jupiter.api.Assertions.*;

class CostcoPinnedStageReviewerTest {
    static final String INPUT="a".repeat(64);static final URI PAGE=URI.create("https://www.costco.co.jp/p/00123");
    final ObjectMapper mapper=new ObjectMapper().findAndRegisterModules();
    static class FakeGateway extends LlmGatewayPinnedTest.Fake {
        String answer="{\"verdict\":\"AMBIGUOUS\",\"reason\":\"Two packaging variants in retrieved source\",\"identifiedItemNumber\":\"00123\",\"candidate\":null}";
        String prompt;List<PinnedImage> images;int calls;String failure;
        @Override public PinnedCompletion generatePinned(URI required,String text,List<PinnedImage> views){calls++;assertEquals(CostcoEvidenceAcquisitionPlanner.REQUIRED_NODE,required);prompt=text;images=views;if(failure!=null)throw new PinnedFailure(failure);return new PinnedCompletion(answer,"fixture-real-route","fixture-model",required,7,null,5L);}
    }
    static class Store implements CostcoEvidenceStore {
        final Map<String,byte[]> contents=new HashMap<>();
        @Override public void put(CostcoOfficialEvidenceFetcher.Query q,CostcoOfficialEvidence e,byte[] b){contents.put(e.sha256(),b.clone());}
        @Override public byte[] readVerified(long owner,String hash){assertEquals(7L,owner);return contents.get(hash).clone();}
    }
    CostcoOnboardingJob job(List<CostcoOfficialEvidence> evidence,List<CostcoOnboardingDecision> decisions,String photo){return new CostcoOnboardingJob("fixture-job","b".repeat(64),7L,"supplier-string","JP",INPUT,"00123",photo,2,CostcoOnboardingJob.State.AI_REVIEW,evidence,decisions,null,null,null,Instant.parse("2026-11-09T01:00:00Z"));}
    CostcoOfficialEvidence document(Store store){byte[] bytes="<h1>Actual fixture 00123</h1><script type=\"application/ld+json\">{\"packaging\":\"80 x 2\"}</script>".getBytes(java.nio.charset.StandardCharsets.UTF_8);String hash=CostcoPinnedStageReviewer.digest(bytes);store.contents.put(hash,bytes);return new CostcoOfficialEvidence("doc",PAGE,PAGE,hash,Instant.parse("2026-11-09T01:00:00Z"),"text/html",null,null,List.of());}
    CostcoOfficialEvidence exactCostcoDocument(Store store)throws Exception{byte[] bytes=getClass().getResourceAsStream("/costco/product-53432.html").readAllBytes();String hash=CostcoPinnedStageReviewer.digest(bytes);store.contents.put(hash,bytes);URI page=URI.create("https://www.costco.co.jp/c/Frozen-Mixed-Seafood-1kg/p/53432");return new CostcoOfficialEvidence("real-html-fixture",page,page,hash,Instant.parse("2026-11-28T01:00:00Z"),"text/html",null,null,List.of());}
    byte[] png()throws Exception{var b=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(4,4,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",b);return b.toByteArray();}
    @Test void semanticAmbiguityComesFromModelAndActualTextIsBoundToTrace(){
        var gateway=new FakeGateway();var store=new Store();var doc=document(store);
        var decision=new CostcoPinnedStageReviewer(gateway,mapper,store).review(Stage.IDENTITY,job(List.of(doc),List.of(),null));
        assertEquals(Verdict.AMBIGUOUS,decision.verdict());assertEquals("fixture-real-route",decision.provider());assertEquals(List.of(doc.sha256()),decision.evidenceHashes());
        assertTrue(gateway.prompt.contains("Actual fixture 00123"));assertTrue(gateway.prompt.contains("80 x 2"));assertNull(decision.trace().promptTokens());assertEquals(5L,decision.trace().completionTokens());assertEquals(64,decision.trace().inputRef().length());
    }
    @Test void photoIntakeAndImageReviewUseVerifiedActualPixelsNotOnlyUrls()throws Exception{
        var gateway=new FakeGateway();var store=new Store();byte[] bytes=png();String hash=CostcoPinnedStageReviewer.digest(bytes);store.contents.put(hash,bytes);
        var reviewer=new CostcoPinnedStageReviewer(gateway,mapper,store);var intake=reviewer.review(Stage.INTAKE,job(List.of(),List.of(),hash));
        assertEquals(1,gateway.images.size());assertTrue(intake.trace().imageViewHashes().containsKey(hash));
        var image=new CostcoOfficialEvidence("image",PAGE,URI.create("https://images.costco.co.jp/item.png"),hash,Instant.parse("2026-11-09T01:00:00Z"),"image/png",4,4,List.of());
        var decision=reviewer.review(Stage.IMAGE_SOURCE,job(List.of(document(store),image),List.of(),null));assertEquals(1,gateway.images.size());assertTrue(decision.trace().imageViewHashes().containsKey(hash));
    }
    @Test void intakeKeepsVerbatimLabelsAndSeparatePriceKindsWithPrivateEvidence()throws Exception{
        var gateway=new FakeGateway();
        var store=new Store();
        byte[] bytes=png();
        String hash=CostcoPinnedStageReviewer.digest(bytes);
        store.contents.put(hash,bytes);
        var transcript=new PhotoTranscription(List.of(
                new PhotoTag("00123 試験食品\n税込 ¥980 - ¥200", "00123","試験食品","試験ブランド","1箱","2袋",
                        "1 kg","2袋","税込","会員限定","11月21日まで",List.of(
                        new PhotoTagPrice(PhotoTagPriceKind.TOTAL,"¥980",new java.math.BigDecimal("980"),"JPY"),
                        new PhotoTagPrice(PhotoTagPriceKind.DISCOUNT,"- ¥200",new java.math.BigDecimal("200"),"JPY"))),
                new PhotoTag("00456 別商品\n¥320","00456","別商品",null,null,null,null,null,null,null,null,List.of())),
                List.of("箱に青いロゴ"),List.of("同じ写真に二つの値札"));
        var facts=new PhotoFacts(null,null,null,null,"UNKNOWN",true,transcript);
        var candidate=new Candidate("00123",null,"試験食品",null,null,null,null,Map.of(),List.of(),List.of(),null,facts);
        gateway.answer=mapper.writeValueAsString(Map.of("verdict","AMBIGUOUS","reason","Two tags",
                "identifiedItemNumber","00123","candidate",candidate));
        var reviewer=new CostcoPinnedStageReviewer(gateway,mapper,store);
        var decision=reviewer.review(Stage.INTAKE,job(List.of(),List.of(),hash));
        var durable=mapper.readValue(mapper.writeValueAsString(decision),CostcoOnboardingDecision.class);
        assertEquals(transcript,durable.candidate().photoFacts().transcription());
        assertNull(durable.candidate().photoFacts().amount());
        assertTrue(durable.trace().imageViewHashes().containsKey(hash));
        assertFalse(gateway.prompt.contains(transcript.tags().get(0).rawText()));
        assertThrows(IllegalStateException.class,()->reviewer.review(Stage.FACTS,job(List.of(document(store)),List.of(),hash)));
        assertNull(mapper.readValue("""
                {"amount":999,"currency":"JPY","unit":"1 kg","conditions":"","priceKind":"WAREHOUSE","productVisible":true}
                """,PhotoFacts.class).transcription());
    }
    @Test void incompleteTagTextKeepsCoreIdentityAndVerifiedPhotoButDoesNotSupplyWarehousePrice()throws Exception{
        var gateway=new FakeGateway();var store=new Store();
        byte[] bytes=png();String hash=CostcoPinnedStageReviewer.digest(bytes);store.contents.put(hash,bytes);
        gateway.answer="""
            {"verdict":"ACCEPT","reason":"clear item","identifiedItemNumber":"53432","candidate":{
              "itemNumber":"53432","name":"Seafood","translatedNames":{},"unknownFields":[],"referencePrices":[],
              "photoFacts":{"amount":2698,"currency":"JPY","unit":"1 kg","priceKind":"WAREHOUSE",
                "productVisible":true,"priceTagVisible":true,"transcription":{
                  "tags":[{"itemNumber":"53432","prices":[{"kind":"TOTAL","amount":2698}]}],
                  "productFeatures":["1 kg package"],"uncertainties":[]}}
            }}
            """;
        var result=new CostcoPinnedStageReviewer(gateway,mapper,store).review(Stage.INTAKE,job(List.of(),List.of(),hash));
        assertEquals("53432",result.identifiedItemNumber());
        assertEquals("Seafood",result.candidate().name());
        assertTrue(result.trace().imageViewHashes().containsKey(hash));
        var facts=result.candidate().photoFacts();
        assertNull(facts.amount());
        assertTrue(facts.transcription().incompleteTagText());
        assertEquals(List.of("1 kg package"),facts.transcription().productFeatures());
        var response=mapper.readTree(gateway.answer);
        var fieldTag=(com.fasterxml.jackson.databind.node.ObjectNode)response.at("/candidate/photoFacts/transcription/tags/0");
        fieldTag.put("rawText","53432 JPY 2698");
        ((com.fasterxml.jackson.databind.node.ObjectNode)fieldTag.at("/prices/0")).put("rawText","JPY 2698").put("currency","JPY");
        gateway.answer=response.toString();
        var complete=new CostcoPinnedStageReviewer(gateway,mapper,store).review(Stage.INTAKE,job(List.of(),List.of(),hash));
        assertEquals(new java.math.BigDecimal("2698"),complete.candidate().photoFacts().amount());
        assertFalse(complete.candidate().photoFacts().transcription().incompleteTagText());
    }
    @Test void packagingOnlyKeepsPrintedNumberAndBothPricesAsPackagingEvidence()throws Exception{
        var gateway=new FakeGateway();var store=new Store();
        byte[] bytes=png();String hash=CostcoPinnedStageReviewer.digest(bytes);store.contents.put(hash,bytes);
        gateway.answer="""
            {"verdict":"NEEDS_EVIDENCE","reason":"packaging only","identifiedItemNumber":"93963","candidate":{
              "itemNumber":"93963","name":"Matcha muffins","translatedNames":{},"unknownFields":[],"referencePrices":[],
              "photoFacts":{"amount":798,"currency":"JPY","unit":"6 pack","priceKind":"WAREHOUSE",
                "productVisible":true,"priceTagVisible":false,"transcription":{
                  "tags":[],"packagingLabels":[{"rawText":"93963 税抜739円 税込798円","itemNumber":"93963","prices":[
                   {"kind":"TOTAL","rawText":"税抜739円","amount":739,"currency":"JPY"},
                   {"kind":"TOTAL","rawText":"税込798円","amount":798,"currency":"JPY"}]}],
                  "productFeatures":[],"uncertainties":[]}}
            }}
            """;
        var result=new CostcoPinnedStageReviewer(gateway,mapper,store).review(Stage.INTAKE,job(List.of(),List.of(),hash));
        assertNull(result.identifiedItemNumber());
        assertNull(result.candidate().itemNumber());
        var facts=result.candidate().photoFacts();
        assertNull(facts.amount());
        var label=facts.transcription().packagingLabels().get(0);
        assertEquals("93963",label.itemNumber());
        assertEquals(List.of(739,798),label.prices().stream().map(p->p.amount().intValueExact()).toList());
    }
    @Test void supplementedIntakeUsesUncroppedFieldPixelsFirstAndPackagingAsContext() throws Exception {
        var gateway=new FakeGateway();
        var store=new Store();
        var fixtures=java.nio.file.Path.of("../docs/reports/evidence/product-photo-intake-20261120");
        byte[] field=java.nio.file.Files.readAllBytes(fixtures.resolve("synthetic-edge-tag.png"));
        byte[] pack=java.nio.file.Files.readAllBytes(fixtures.resolve("synthetic-packaging.png"));
        String fieldHash=CostcoPinnedStageReviewer.digest(field),packHash=CostcoPinnedStageReviewer.digest(pack);
        store.contents.put(fieldHash,field);store.contents.put(packHash,pack);
        var original=job(List.of(),List.of(),fieldHash);
        var supplemented=new CostcoOnboardingJob(original.id(),original.idempotencyKey(),original.merchantId(),
                original.supplierId(),original.market(),original.inputHash(),null,fieldHash,original.revision(),
                original.state(),List.of(),List.of(),null,null,null,original.updatedAt(),packHash);
        var result=new CostcoPinnedStageReviewer(gateway,mapper,store).review(Stage.INTAKE,supplemented);
        assertEquals(java.util.Set.of(fieldHash,packHash),result.trace().imageViewHashes().keySet());
        assertTrue(gateway.prompt.contains("current in-store photo"));
        assertEquals(720,javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(gateway.images.get(0).bytes())).getHeight());
        assertEquals(320,javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(gateway.images.get(1).bytes())).getHeight());
    }
    @Test void photoArchiveDetailsUseKnownLeafCategoriesAndSupportedStorage()throws Exception{
        var gateway=new FakeGateway();var store=new Store();byte[] bytes=png();
        String hash=CostcoPinnedStageReviewer.digest(bytes);store.contents.put(hash,bytes);
        var categories=org.mockito.Mockito.mock(CategoryTreeNodeRepository.class);
        var root=new CategoryTreeNode("food",null,Map.of("ja-JP","食品"),List.of("food"),0,null);
        var leaf=new CategoryTreeNode("frozen","food",Map.of("ja-JP","冷凍食品"),List.of("food","frozen"),0,null);
        org.mockito.Mockito.when(categories.findAll()).thenReturn(List.of(root,leaf));
        var reviewer=new CostcoPinnedStageReviewer(gateway,mapper,store,null,categories);
        var candidate=new Candidate("00123",null,"試験食品",null,null,null,null,Map.of(),List.of());
        var reply=mapper.valueToTree(Map.of("verdict","ACCEPT","reason","Fixture","identifiedItemNumber","00123","candidate",candidate));
        var details=((com.fasterxml.jackson.databind.node.ObjectNode)reply.path("candidate")).putObject("archiveDetails");
        details.put("descriptionJa","冷凍食品").put("categoryNodeId","frozen").put("storageCondition","FROZEN");
        gateway.answer=reply.toString();
        var result=reviewer.review(Stage.INTAKE,job(List.of(),List.of(),hash));
        assertEquals(new ArchiveDetails("冷凍食品","frozen",StorageCondition.FROZEN),result.candidate().archiveDetails());
        assertTrue(gateway.prompt.contains("食品 / 冷凍食品"));
        details.put("categoryNodeId","food").put("storageCondition","ULTRA_COLD");
        gateway.answer=reply.toString();
        assertEquals(new ArchiveDetails("冷凍食品",null,null),
                reviewer.review(Stage.INTAKE,job(List.of(),List.of(),hash)).candidate().archiveDetails());
    }
    @Test void wrongBytesAndPrivilegeFieldsNeverReachAcceptedDecision(){
        var badStore=new Store();var badDoc=document(badStore);badStore.contents.put(badDoc.sha256(),new byte[]{9});var gateway=new FakeGateway();
        assertThrows(IllegalStateException.class,()->new CostcoPinnedStageReviewer(gateway,mapper,badStore).review(Stage.FACTS,job(List.of(badDoc),List.of(),null)));assertEquals(0,gateway.calls);
        var finalStore=new Store();var finalDoc=document(finalStore);gateway.answer=gateway.answer.substring(0,gateway.answer.length()-1)+",\"merchantId\":99}";
        assertThrows(IllegalStateException.class,()->new CostcoPinnedStageReviewer(gateway,mapper,finalStore).review(Stage.FACTS,job(List.of(finalDoc),List.of(),null)));
    }
    @Test void missingCapabilityIsActionableNeedsInputNotPretendVision(){
        var gateway=new FakeGateway();gateway.failure="ai.pinned_vision_unattested";var store=new Store();
        assertThrows(CostcoNumberOnboardingService.NeedsInput.class,()->new CostcoPinnedStageReviewer(gateway,mapper,store).review(Stage.INTAKE,job(List.of(),List.of(),null)));
    }
    @Test void admissionCannotSelectAnImageNeverViewedByImageStage()throws Exception{
        var gateway=new FakeGateway();var store=new Store();var doc=document(store);byte[] bytes=png();String hash=CostcoPinnedStageReviewer.digest(bytes);store.contents.put(hash,bytes);
        var candidate=new Candidate("00123","Fixture brand","Pure fixture name",null,"one unit","80 x 2",hash,Map.of(),List.of());
        gateway.answer=mapper.writeValueAsString(Map.of("verdict","ACCEPT","reason","Synthetic model decision","identifiedItemNumber","00123","candidate",candidate));
        assertThrows(CostcoNumberOnboardingService.NeedsInput.class,()->new CostcoPinnedStageReviewer(gateway,mapper,store).review(Stage.ADMISSION,job(List.of(doc),List.of(),null)));
    }
    @Test void plannerSecondRoundReadsActualDocumentAndDoesNotCallMockSearch(){
        var gateway=new FakeGateway();var store=new Store();var doc=document(store);gateway.answer="{\"sources\":[],\"discoveryComplete\":true}";
        var plan=new CostcoPinnedEvidencePlanner(gateway,mapper,store).plan(new CostcoOfficialEvidenceFetcher.Query(7,"supplier-string","JP","00123",null,INPUT),List.of(doc));
        assertTrue(plan.discoveryComplete());assertTrue(plan.sources().isEmpty());assertTrue(gateway.prompt.contains(doc.sha256()));assertTrue(gateway.prompt.contains("Actual fixture 00123"));assertEquals(INPUT,plan.inputHash());
    }
    @Test void plannerInitialSeedIsFetchedRoutingOnlyAndNeverMarksDiscoveryComplete(){
        var gateway=new FakeGateway();gateway.answer="{\"sources\":[],\"discoveryComplete\":true}";var store=new Store();
        var plan=new CostcoPinnedEvidencePlanner(gateway,mapper,store).plan(new CostcoOfficialEvidenceFetcher.Query(7,"supplier-string","JP","00123",null,INPUT));
        assertFalse(plan.discoveryComplete());assertEquals(1,plan.sources().size());assertEquals("https://www.costco.co.jp/search?text=00123",plan.sources().get(0).fetchUrl().toString());
    }
    @Test void rapidTextOnlyPlannerRejectsImageDiscoveryProposals()throws Exception{
        var gateway=new FakeGateway();var store=new Store();
        gateway.answer="""
                {"sources":[{"canonicalUrl":"https://www.costco.co.jp/p/00123",
                "fetchUrl":"https://www.costco.co.jp/image.jpg","kind":"IMAGE","priority":"COSTCO"}],
                "discoveryComplete":true}
                """;
        var query=new CostcoOfficialEvidenceFetcher.Query(7,"supplier-string","JP","53432",
                "c".repeat(64),INPUT,CostcoOfficialEvidenceFetcher.Acquisition.TEXT_ONLY);
        var plan=new CostcoPinnedEvidencePlanner(gateway,mapper,store).plan(query,List.of(exactCostcoDocument(store)));
        assertTrue(plan.discoveryComplete());
        assertTrue(plan.sources().isEmpty());
        assertTrue(gateway.prompt.contains("DOCUMENT sources only"));
    }
    @Test void rapidTextOnlyCompletesWithVerifiedExactProductDespiteMoreCopyProposals() throws Exception {
        var gateway=new FakeGateway();var store=new Store();
        var document=exactCostcoDocument(store);
        gateway.answer="""
                {"sources":[{"canonicalUrl":"https://www.costco.co.jp/c/Frozen-Mixed-Seafood-1kg/p/53432",
                "fetchUrl":"https://www.costco.co.jp/c/Frozen-Mixed-Seafood-1kg/p/53432","kind":"DOCUMENT","priority":"COSTCO"}],
                "discoveryComplete":false}
                """;
        var textOnly=new CostcoOfficialEvidenceFetcher.Query(7,"supplier-string","JP","53432",
                "c".repeat(64),INPUT,CostcoOfficialEvidenceFetcher.Acquisition.TEXT_ONLY);
        var plan=new CostcoPinnedEvidencePlanner(gateway,mapper,store).plan(textOnly,List.of(document));
        assertTrue(plan.discoveryComplete());
        assertTrue(plan.sources().isEmpty());

        var wrongSku=new CostcoOfficialEvidenceFetcher.Query(7,"supplier-string","JP","99999",
                "c".repeat(64),INPUT,CostcoOfficialEvidenceFetcher.Acquisition.TEXT_ONLY);
        gateway.answer="{\"sources\":[],\"discoveryComplete\":true}";
        assertThrows(CostcoNumberOnboardingService.NeedsInput.class,
                ()->new CostcoPinnedEvidencePlanner(gateway,mapper,store).plan(wrongSku,List.of(document)));

        var full=new CostcoOfficialEvidenceFetcher.Query(7,"supplier-string","JP","53432",
                "c".repeat(64),INPUT,CostcoOfficialEvidenceFetcher.Acquisition.FULL);
        gateway.answer="""
                {"sources":[{"canonicalUrl":"https://www.costco.co.jp/c/Frozen-Mixed-Seafood-1kg/p/53432",
                "fetchUrl":"https://www.costco.co.jp/c/Frozen-Mixed-Seafood-1kg/p/53432","kind":"DOCUMENT","priority":"COSTCO"}],
                "discoveryComplete":false}
                """;
        var fullPlan=new CostcoPinnedEvidencePlanner(gateway,mapper,store).plan(full,List.of(document));
        assertFalse(fullPlan.discoveryComplete());
        assertEquals(1,fullPlan.sources().size());
    }
    @Test void photoDiscoveryStartsAtExactItemAndCanReviewTextWithoutAnImage(){
        var gateway=new FakeGateway();
        gateway.answer="{\"sources\":[],\"discoveryComplete\":false}";
        var store=new Store();
        var planner=new CostcoPinnedEvidencePlanner(gateway,mapper,store);
        var photo=new CostcoOfficialEvidenceFetcher.Query(7,"supplier-string","JP","00123","c".repeat(64),INPUT);
        assertEquals(PAGE,planner.plan(photo).sources().get(0).fetchUrl());
        assertTrue(planner.plan(photo,List.of(document(store))).discoveryComplete());
        var number=new CostcoOfficialEvidenceFetcher.Query(7,"supplier-string","JP","00123",null,INPUT);
        assertThrows(CostcoNumberOnboardingService.NeedsInput.class,()->planner.plan(number,List.of(document(store))));
    }

    @Test void rejectedOfficialPhotoReviewDoesNotReplaceTheIntakeCandidate() throws Exception {
        var gateway=new FakeGateway();
        var store=new Store();
        var wrong=new Candidate("98765",null,"Wrong variant",null,null,null,null,Map.of(),List.of());
        gateway.answer=mapper.writeValueAsString(Map.of("verdict","NEEDS_EVIDENCE","reason","Generic storefront page",
                "identifiedItemNumber","00123","candidate",wrong));
        var reviewer=new CostcoPinnedStageReviewer(gateway,mapper,store);
        assertNull(reviewer.review(Stage.IDENTITY,job(List.of(document(store)),List.of(),"c".repeat(64))).candidate());
        gateway.answer=gateway.answer.replace("NEEDS_EVIDENCE","ACCEPT");
        assertThrows(CostcoNumberOnboardingService.NeedsInput.class,
                ()->reviewer.review(Stage.FACTS,job(List.of(document(store)),List.of(),"c".repeat(64))));
    }
    @Test void exactOfficialProductSectionKeepsSpecificationAndRejectsWrongSku() {
        var receipt=document(new Store());
        String html="""
                <script type="application/ld+json">{"@type":"product","sku":"00123","name":"Exact product"}</script>
                <table><tr><td class="attrib">保存方法（温度）</td>
                <td class="attrib-val">-18 ℃</td></tr></table>
                """;
        var section=CostcoPinnedStageReviewer.costcoProductSection(html,receipt,"00123",mapper);
        assertEquals(Map.of("保存方法（温度）","-18 ℃"),section.get("specifications"));
        assertTrue(CostcoPinnedStageReviewer.costcoProductSection(html.replace("00123","00456"),receipt,"00123",mapper).isEmpty());
        assertTrue(CostcoPinnedStageReviewer.costcoProductSection("<title>Costco</title>",receipt,"00123",mapper).isEmpty());
    }
    @Test void photoAdmissionReceivesPrivatePhotoAndPreviouslyReviewedOfficialPixels() throws Exception {
        var gateway=new FakeGateway();
        var store=new Store();
        var doc=document(store);
        byte[] bytes=png();
        String hash=CostcoPinnedStageReviewer.digest(bytes);
        store.contents.put(hash,bytes);
        var raw=new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2,3,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",raw);
        byte[] photo=raw.toByteArray();
        String photoHash=CostcoPinnedStageReviewer.digest(photo);
        store.contents.put(photoHash,photo);
        var media=new CostcoOfficialEvidence("image",PAGE,URI.create("https://www.costco.co.jp/item.png"),
                hash,doc.fetchedAt(),"image/png",4,4,List.of(),doc.sha256());
        var imageReview=new CostcoOnboardingDecision(Stage.IMAGE_SOURCE,Verdict.ACCEPT,"fixture-route","fixture-model",
                CostcoEvidenceAcquisitionPlanner.REQUIRED_NODE,INPUT,List.of(hash),"policy","fixture","Pixel review",
                "00123",null,new EngineTrace(INPUT,INPUT,1,null,null,Map.of(hash,hash)));
        var reviewer=new CostcoPinnedStageReviewer(gateway,mapper,store);
        var unrelated=new CostcoOfficialEvidence("image2",PAGE,URI.create("https://www.costco.co.jp/other.png"),
                "d".repeat(64),doc.fetchedAt(),"image/png",4,4,List.of(),doc.sha256());
        reviewer.review(Stage.ADMISSION,job(List.of(doc,media,unrelated),List.of(imageReview),photoHash));
        assertEquals(2,gateway.images.size());
        assertArrayEquals(photo,gateway.images.get(0).bytes());
        assertArrayEquals(bytes,gateway.images.get(1).bytes());
    }
    @Test void admissionTargetMustBindActualOwnedMasterVersionAndSourceHash()throws Exception{
        var gateway=new FakeGateway();var store=new Store();var doc=document(store);byte[] imageBytes=png();String imageHash=CostcoPinnedStageReviewer.digest(imageBytes);store.contents.put(imageHash,imageBytes);
        var image=new CostcoOfficialEvidence("image",PAGE,URI.create("https://images.costco.co.jp/item.png"),imageHash,Instant.parse("2026-11-09T01:00:00Z"),"image/png",4,4,List.of(),doc.sha256());
        var product=new com.bobbuy.model.Product();product.setId("owned-master");product.setMerchantId(7L);product.setItemNumber("00123");product.setRecordVersion(3L);
        product.setName(Map.of("ja-JP","既存資料"));product.setDescription(Map.of());product.setAttributes(Map.of("sourceMarket","JP"));product.setCatalogData(new com.bobbuy.model.ProductCatalogData(Map.of("ja-JP","unit"),"model","80 x 2",List.of(),"supplier-string",null,null,null));
        var repository=(com.bobbuy.repository.ProductRepository)java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(),new Class[]{com.bobbuy.repository.ProductRepository.class},(proxy,method,args)->{if(method.getName().equals("findAllByMerchantIdAndItemNumber")){assertEquals(7L,args[0]);assertEquals("00123",args[1]);return List.of(product);}throw new AssertionError("Unexpected repository method "+method.getName());});
        var target=new Target(product.getId(),3,ProductCatalogService.sourceHash(product));
        var candidate=new Candidate("00123","Fixture brand","Pure name",null,"unit","80 x 2",imageHash,Map.of("ja-JP","Pure name"),List.of(),List.of(),target);
        var viewed=new CostcoOnboardingDecision(Stage.IMAGE_SOURCE,Verdict.ACCEPT,"fixture-real-route","fixture-model",CostcoEvidenceAcquisitionPlanner.REQUIRED_NODE,INPUT,List.of(doc.sha256(),imageHash),"policy","prompt","Synthetic pixel decision","00123",null,new EngineTrace(INPUT,INPUT,1,null,null,Map.of(imageHash,imageHash)));
        gateway.answer=mapper.writeValueAsString(Map.of("verdict","ACCEPT","reason","Synthetic same variant decision","identifiedItemNumber","00123","candidate",candidate));
        var reviewer=new CostcoPinnedStageReviewer(gateway,mapper,store,repository);
        var accepted=reviewer.review(Stage.ADMISSION,job(List.of(doc,image),List.of(viewed),null));assertEquals(target,accepted.candidate().target());assertTrue(gateway.prompt.contains(target.sourceHash()));
        product.setRecordVersion(4L);
        assertThrows(CostcoNumberOnboardingService.NeedsInput.class,()->reviewer.review(Stage.ADMISSION,job(List.of(doc,image),List.of(viewed),null)));
    }
    @Test void revocationBeforeRedirectStopsNextDnsAndHttpRequest()throws Exception{
        var store=new Store();var checks=new java.util.concurrent.atomic.AtomicInteger();var calls=new java.util.concurrent.atomic.AtomicInteger();var resolves=new java.util.concurrent.atomic.AtomicInteger();
        CostcoEvidenceAcquisitionPlanner planner=q->new CostcoEvidenceAcquisitionPlanner.Plan(q.inputHash(),"fixture-route","fixture-model",CostcoEvidenceAcquisitionPlanner.REQUIRED_NODE,List.of(new CostcoEvidenceAcquisitionPlanner.Source(PAGE,PAGE,CostcoEvidenceAcquisitionPlanner.Kind.DOCUMENT,CostcoEvidenceAcquisitionPlanner.Priority.COSTCO)));
        var fetcher=new CostcoPublicEvidenceFetcher(planner,store,host->{resolves.incrementAndGet();return new java.net.InetAddress[]{java.net.InetAddress.getByName("93.184.216.34")};},(url,address,max,timeout)->{calls.incrementAndGet();return new CostcoPublicEvidenceFetcher.Response(302,Map.of("location",List.of("https://www.costco.co.jp/new")),new byte[0]);},java.time.Clock.systemUTC(),q->{if(checks.incrementAndGet()==3)throw new CostcoNumberOnboardingService.NeedsInput("onboarding.scope_changed");});
        assertThrows(CostcoNumberOnboardingService.NeedsInput.class,()->fetcher.fetch(new CostcoOfficialEvidenceFetcher.Query(7,"supplier-string","JP","00123",null,INPUT)));
        assertEquals(1,calls.get());assertEquals(1,resolves.get());
    }
    @Test void xhtmlAndJsonLdAreActualRetrievedInputForBothReviewAndDiscovery(){
        for(String mime:List.of("application/xhtml+xml","application/ld+json")){
            var gateway=new FakeGateway();var store=new Store();byte[] bytes=(mime.contains("xhtml")?"<h1>Actual MIME fixture</h1>":"{\"name\":\"Actual MIME fixture\"}").getBytes(java.nio.charset.StandardCharsets.UTF_8);String hash=CostcoPinnedStageReviewer.digest(bytes);store.contents.put(hash,bytes);
            var evidence=new CostcoOfficialEvidence("mime-doc",PAGE,PAGE,hash,Instant.parse("2026-11-09T01:00:00Z"),mime,null,null,List.of());
            new CostcoPinnedStageReviewer(gateway,mapper,store).review(Stage.IDENTITY,job(List.of(evidence),List.of(),null));assertTrue(gateway.prompt.contains("Actual MIME fixture"));assertTrue(gateway.prompt.contains(hash));
            gateway.answer="{\"sources\":[],\"discoveryComplete\":true}";
            new CostcoPinnedEvidencePlanner(gateway,mapper,store).plan(new CostcoOfficialEvidenceFetcher.Query(7,"supplier-string","JP","00123",null,INPUT),List.of(evidence));assertTrue(gateway.prompt.contains("Actual MIME fixture"));assertTrue(gateway.prompt.contains(hash));
        }
    }
}
