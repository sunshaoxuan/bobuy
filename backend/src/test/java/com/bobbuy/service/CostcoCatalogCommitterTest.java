package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import static com.bobbuy.service.CostcoOnboardingDecision.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Adapter unit gates. Transaction rollback, PostgreSQL and real media/catalog effects remain CI gates. */
class CostcoCatalogCommitterTest {
    private final ProductCatalogService catalog=mock(ProductCatalogService.class);private final ProductRepository products=mock(ProductRepository.class);
    private final UserRepository users=mock(UserRepository.class);private final SupplierRepository suppliers=mock(SupplierRepository.class);
    private final CostcoEvidenceStore evidence=mock(CostcoEvidenceStore.class);private final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    private final CostcoCatalogCommitter adapter=new CostcoCatalogCommitter(catalog,products,users,suppliers,evidence,jdbc,new ObjectMapper());
    private final Candidate candidate=new Candidate("14110","Synthetic brand","Synthetic Japanese",null,"80 g","80 × 2","a".repeat(64),Map.of("ja-JP","Synthetic Japanese","zh-CN","Synthetic CN","zh-TW","Synthetic TW","en-US","Synthetic EN"),List.of());
    private CostcoOnboardingJob job(boolean trace) {return job(trace,candidate);}
    private CostcoOnboardingJob job(boolean trace,Candidate selected) {
        var list=new ArrayList<CostcoOnboardingDecision>();
        for(var stage:Stage.values())list.add(new CostcoOnboardingDecision(stage,Verdict.ACCEPT,"unit-fixture-not-live","unit-model",CostcoNumberOnboardingService.REQUIRED_NODE,"b".repeat(64),List.of(selected.officialImageSha256()),"unit-policy","unit-prompt","Synthetic unit fixture","14110",stage==Stage.ADMISSION?selected:null,trace?new EngineTrace("c".repeat(64),"d".repeat(64),1,null,null,Map.of()):null));
        return new CostcoOnboardingJob("synthetic-job","e".repeat(64),9,"supplier-jp","JP","b".repeat(64),"14110",null,9,CostcoOnboardingJob.State.COMMITTING,List.of(new CostcoOfficialEvidence("image",URI.create("https://example.test/product"),URI.create("https://example.test/image.png"),selected.officialImageSha256(),Instant.now(),"image/png",1200,900,List.of())),list,null,null,null,Instant.now());
    }
    private void actor(boolean enabled) {
        var supplier=new Supplier();supplier.setId("supplier-jp");supplier.setMerchantId(9L);when(suppliers.findById("supplier-jp")).thenReturn(Optional.of(supplier));
        var user=new User();user.setId(9L);user.setName("Synthetic");user.setUsername("synthetic");user.setRoles(Set.of(Role.AGENT));user.setEnabled(enabled);when(users.lockById(9L)).thenReturn(Optional.of(user));when(users.findById(9L)).thenReturn(Optional.of(user));
    }
    @Test void missingEngineTraceNeverBecomesReviewedCatalogWrite(){var job=job(false);assertThrows(CostcoNumberOnboardingService.NeedsInput.class,()->adapter.commitOnce(job,candidate,CostcoNumberOnboardingService.candidateHash(candidate)));verifyNoInteractions(catalog,evidence,products,users);}
    @Test void unknownNewMasterSellingPriceStaysInTaskWithoutCreatingAZeroPricedProduct(){actor(true);var job=job(true);when(products.findAllByMerchantIdAndItemNumber(9L,"14110")).thenReturn(List.of());var error=assertThrows(CostcoNumberOnboardingService.NeedsInput.class,()->adapter.commitOnce(job,candidate,CostcoNumberOnboardingService.candidateHash(candidate)));assertEquals("onboarding.new_master_needs_price_policy",error.getMessage());verifyNoInteractions(catalog,evidence);verify(products,never()).save(any());verify(products,never()).saveAndFlush(any());}
    @Test void aUniqueMatchStillNeedsAnExplicitModelReviewedTarget(){actor(true);var product=new Product();product.setId("master");product.setMerchantId(9L);product.setItemNumber("14110");product.setAttributes(Map.of("sourceMarket","JP"));product.setCatalogData(new ProductCatalogData(Map.of(),null,null,List.of(),"supplier-jp",null,9L,Instant.now()));when(products.findAllByMerchantIdAndItemNumber(9L,"14110")).thenReturn(List.of(product));var job=job(true);var error=assertThrows(CostcoNumberOnboardingService.NeedsInput.class,()->adapter.commitOnce(job,candidate,CostcoNumberOnboardingService.candidateHash(candidate)));assertEquals("onboarding.target_required",error.getMessage());verifyNoInteractions(catalog,evidence);verify(products,never()).lockById(any());}
    @Test void revokedActorCannotSpendOrWriteThroughAnOldQueuedJob(){actor(false);var job=job(true);assertThrows(CostcoNumberOnboardingService.NeedsInput.class,()->adapter.commitOnce(job,candidate,CostcoNumberOnboardingService.candidateHash(candidate)));verifyNoInteractions(catalog,evidence,products);}
    @Test @SuppressWarnings({"unchecked","rawtypes"}) void savingRetainsAllKnownSpecificationLanguagesWhenAiOmitsOrUpdatesJapanese() throws Exception {
        var picture=new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB);var encoded=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(picture,"png",encoded);byte[] pixels=encoded.toByteArray();String imageHash=CostcoEvidencePersistence.hash(pixels);
        for(boolean updateJapanese:List.of(false,true)){
            reset(catalog,products,users,suppliers,evidence,jdbc);actor(true);
            var specifications=new LinkedHashMap<String,String>();specifications.put("ja-JP","Original Japanese spec");specifications.put("zh-CN","Original simplified spec");specifications.put("zh-TW","Original traditional spec");specifications.put("en-US","Original English spec");
            var p=new Product();p.setId("master");p.setMerchantId(9L);p.setItemNumber("14110");p.setRecordVersion(7L);p.setBasePrice(123);p.setBrand("Original brand");p.setName(Map.of("ja-JP","Original product"));p.setDescription(Map.of());p.setAttributes(Map.of("sourceMarket","JP"));p.setCatalogData(new ProductCatalogData(specifications,"M-1","80 × 2",List.of(),"supplier-jp",null,9L,Instant.now()));
            var selected=new Candidate("14110",updateJapanese?candidate.brand():null,candidate.name(),updateJapanese?"M-2":null,updateJapanese?"New Japanese spec":null,updateJapanese?"80 × 3":null,imageHash,candidate.translatedNames(),List.of(),List.of(),new Target(p.getId(),7,ProductCatalogService.sourceHash(p)));
            var task=job(true,selected);when(products.findAllByMerchantIdAndItemNumber(9L,"14110")).thenReturn(List.of(p));when(products.lockById("master")).thenReturn(Optional.of(p));
            var entityManager=mock(jakarta.persistence.EntityManager.class);var field=CostcoCatalogCommitter.class.getDeclaredField("entityManager");field.setAccessible(true);field.set(adapter,entityManager);
            var original=new ProductCatalogService.Input("master",7,p.getName(),p.getDescription(),"14110",p.getBrand(),specifications,"M-1","80 × 2",List.of(),"supplier-jp",List.of(),false);
            var expected=new LinkedHashMap<>(specifications);if(updateJapanese)expected.put("ja-JP","New Japanese spec");
            var media=new MediaGalleryItem("/api/storefront/recommendation-images/unit",MediaType.IMAGE,Map.of("ja-JP",selected.name()));media.setSha256(imageHash);
            var saved=new ProductCatalogService.Input("master",8,selected.translatedNames(),Map.of(),"14110",updateJapanese?selected.brand():original.brand(),expected,updateJapanese?selected.model():original.model(),updateJapanese?selected.packaging():original.packaging(),List.of(),"supplier-jp",List.of(media),false);
            when(evidence.readVerified(9,imageHash)).thenReturn(pixels);when(catalog.upload(eq("master"),any(RecommendationImageValidator.Image.class),eq("https://example.test/product"),eq(selected.name()),eq(true))).thenReturn(media);
            String candidateHash=CostcoNumberOnboardingService.candidateHash(selected);
            when(catalog.get("master")).thenReturn(new ProductCatalogService.Profile(original,true,List.of()),new ProductCatalogService.Profile(saved,true,List.of()));when(catalog.saveAutomated(eq(task),eq(selected),eq(candidateHash),anyList())).thenReturn(List.of(new ProductCatalogService.Profile(saved,true,List.of())));
            assertTrue(adapter.commitOnce(task,selected,candidateHash).reopenedAndMatched());
            org.mockito.ArgumentCaptor<List<ProductCatalogService.Input>> captured=(org.mockito.ArgumentCaptor)org.mockito.ArgumentCaptor.forClass(List.class);verify(catalog).saveAutomated(eq(task),eq(selected),eq(candidateHash),captured.capture());var input=captured.getValue().get(0);
            assertEquals(expected,input.specification());assertEquals(specifications.get("zh-CN"),input.specification().get("zh-CN"));assertEquals(specifications.get("zh-TW"),input.specification().get("zh-TW"));assertEquals(specifications.get("en-US"),input.specification().get("en-US"));assertFalse(input.translationsReviewed());assertEquals(123,p.getBasePrice());
            assertEquals(saved.brand(),input.brand());assertEquals(saved.model(),input.model());assertEquals(saved.packaging(),input.packaging());verify(catalog,never()).save(anyList(),anyBoolean());
            verify(entityManager).refresh(p,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);verify(products,never()).save(any());
        }
    }
    @Test void aQueryOnlySourceNeedsCanonicalEvidenceBeforeAnyUploadOrSave() throws Exception {
        actor(true);var p=new Product();p.setId("master");p.setMerchantId(9L);p.setItemNumber("14110");p.setRecordVersion(7L);p.setName(Map.of("ja-JP","Original product"));p.setDescription(Map.of());p.setAttributes(Map.of("sourceMarket","JP"));p.setCatalogData(new ProductCatalogData(Map.of("ja-JP","Original spec"),null,"80 × 2",List.of(),"supplier-jp",null,9L,Instant.now()));
        var selected=new Candidate(candidate.itemNumber(),candidate.brand(),candidate.name(),candidate.model(),candidate.specification(),candidate.packaging(),candidate.officialImageSha256(),candidate.translatedNames(),List.of(),List.of(),new Target(p.getId(),7,ProductCatalogService.sourceHash(p)));
        var original=job(true,selected);var queryEvidence=new CostcoOfficialEvidence("query-image",URI.create("https://example.test/product?item=14110"),URI.create("https://example.test/image.png"),selected.officialImageSha256(),Instant.now(),"image/png",1200,900,List.of());
        var task=new CostcoOnboardingJob(original.id(),original.idempotencyKey(),original.merchantId(),original.supplierId(),original.market(),original.inputHash(),original.itemNumber(),original.privatePhotoSha256(),original.revision(),original.state(),List.of(queryEvidence),original.decisions(),null,null,null,original.updatedAt());
        when(products.findAllByMerchantIdAndItemNumber(9L,"14110")).thenReturn(List.of(p));when(products.lockById("master")).thenReturn(Optional.of(p));var field=CostcoCatalogCommitter.class.getDeclaredField("entityManager");field.setAccessible(true);field.set(adapter,mock(jakarta.persistence.EntityManager.class));
        var error=assertThrows(CostcoNumberOnboardingService.NeedsInput.class,()->adapter.commitOnce(task,selected,CostcoNumberOnboardingService.candidateHash(selected)));assertEquals("onboarding.canonical_source_required",error.getMessage());verifyNoInteractions(catalog,evidence);verify(products,never()).save(any());
    }
    @Test void knownCatalogValidationBecomesNeedsInputButUnknownStorageFailureRemainsUncertain() throws Exception {
        actor(true);var picture=new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB);var encoded=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(picture,"png",encoded);byte[] pixels=encoded.toByteArray();String imageHash=CostcoEvidencePersistence.hash(pixels);
        var p=new Product();p.setId("master");p.setMerchantId(9L);p.setItemNumber("14110");p.setRecordVersion(7L);p.setName(Map.of("ja-JP","Original product"));p.setDescription(Map.of());p.setAttributes(Map.of("sourceMarket","JP"));p.setCatalogData(new ProductCatalogData(Map.of("ja-JP","Original spec"),null,"80 × 2",List.of(),"supplier-jp",null,9L,Instant.now()));
        var selected=new Candidate(candidate.itemNumber(),candidate.brand(),candidate.name(),candidate.model(),candidate.specification(),candidate.packaging(),imageHash,candidate.translatedNames(),List.of(),List.of(),new Target(p.getId(),7,ProductCatalogService.sourceHash(p)));var task=job(true,selected);
        when(products.findAllByMerchantIdAndItemNumber(9L,"14110")).thenReturn(List.of(p));when(products.lockById("master")).thenReturn(Optional.of(p));when(evidence.readVerified(9,imageHash)).thenReturn(pixels);
        var field=CostcoCatalogCommitter.class.getDeclaredField("entityManager");field.setAccessible(true);field.set(adapter,mock(jakarta.persistence.EntityManager.class));
        when(catalog.upload(eq("master"),any(RecommendationImageValidator.Image.class),anyString(),anyString(),eq(true))).thenThrow(new com.bobbuy.api.response.ApiException(com.bobbuy.api.response.ErrorCode.INVALID_REQUEST,"gallery.invalid"));
        var rejected=assertThrows(CostcoNumberOnboardingService.NeedsInput.class,()->adapter.commitOnce(task,selected,CostcoNumberOnboardingService.candidateHash(selected)));assertEquals("onboarding.catalog_validation",rejected.getMessage());verify(catalog,never()).save(anyList(),anyBoolean());verify(catalog,never()).saveAutomated(any(),any(),anyString(),anyList());
        var unknown=new IllegalStateException("synthetic_uncertain_storage");doThrow(unknown).when(catalog).upload(eq("master"),any(RecommendationImageValidator.Image.class),anyString(),anyString(),eq(true));
        assertSame(unknown,assertThrows(IllegalStateException.class,()->adapter.commitOnce(task,selected,CostcoNumberOnboardingService.candidateHash(selected))));verify(catalog,never()).save(anyList(),anyBoolean());verify(catalog,never()).saveAutomated(any(),any(),anyString(),anyList());
    }
}
