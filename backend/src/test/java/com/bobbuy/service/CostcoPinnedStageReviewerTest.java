package com.bobbuy.service;

import com.bobbuy.model.CostcoOnboardingJob;
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
