package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.BobbuyAuthenticatedUser;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.time.Instant;
import java.util.*;
import static com.bobbuy.service.CostcoOnboardingDecision.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Actual catalog assignment/validation/checkpoint code, mocked repositories; not a DB/transaction test. */
class ProductCatalogAutomatedTest {
    private static final class Fixture {
        final ProductRepository products=mock(ProductRepository.class);final RecommendationItemRepository items=mock(RecommendationItemRepository.class);
        final RecommendationImageRepository images=mock(RecommendationImageRepository.class);final RecommendationPostRepository posts=mock(RecommendationPostRepository.class);
        final UserRepository users=mock(UserRepository.class);final RecommendationTaxonomyService taxonomy=mock(RecommendationTaxonomyService.class);
        final MediaBinaryService binaries=mock(MediaBinaryService.class);final ProductCatalogRecoveryRepository recoveries=mock(ProductCatalogRecoveryRepository.class);
        final ProductCatalogService service=new ProductCatalogService(products,items,images,posts,users,taxonomy,binaries,recoveries);
        final Product product=new Product();
        Fixture(){product.setId("master");product.setMerchantId(9L);product.setItemNumber("14110");product.setRecordVersion(7L);product.setBrand("Existing brand");product.setName(Map.of("ja-JP","Existing name"));product.setDescription(Map.of("ja-JP","Existing description"));product.setAttributes(Map.of("sourceMarket","JP"));product.setCatalogData(new ProductCatalogData(Map.of("ja-JP","Existing spec","en-US","Existing English spec"),"Existing model","Existing packaging",List.of(),"supplier-jp",null,22L,Instant.now()));
            when(products.findById("master")).thenReturn(Optional.of(product));when(products.lockById("master")).thenReturn(Optional.of(product));var user=new User();user.setId(9L);when(users.lockById(9L)).thenReturn(Optional.of(user));
            when(products.saveAndFlush(any())).thenAnswer(i->{Product p=i.getArgument(0);p.setRecordVersion(p.getRecordVersion()+1);return p;});
        }
        Candidate candidate(){return new Candidate("14110",null,"New Japanese name",null,null,null,"a".repeat(64),Map.of("ja-JP","New Japanese name","zh-CN","Synthetic CN name","zh-TW","Synthetic TW name","en-US","Synthetic EN name"),List.of(),List.of(),new Target("master",7,ProductCatalogService.sourceHash(product)));}
        ProductCatalogService.Input input(Candidate c){var d=product.getCatalogData();return new ProductCatalogService.Input("master",7,c.translatedNames(),product.getDescription(),"14110",product.getBrand(),d.specification(),d.model(),d.packaging(),d.categoryIds(),d.supplierId(),List.of(),false);}
        CostcoOnboardingJob job(Candidate c){var decisions=new ArrayList<CostcoOnboardingDecision>();for(var stage:Stage.values())decisions.add(new CostcoOnboardingDecision(stage,Verdict.ACCEPT,"unit-fixture-not-live","synthetic-model",CostcoNumberOnboardingService.REQUIRED_NODE,"b".repeat(64),List.of(),"unit-policy","unit-prompt","Unit fixture only","14110",stage==Stage.ADMISSION?c:null,new EngineTrace("c".repeat(64),"d".repeat(64),1,null,null,Map.of())));return new CostcoOnboardingJob("synthetic-job","e".repeat(64),9,"supplier-jp","JP","b".repeat(64),"14110",null,8,CostcoOnboardingJob.State.COMMITTING,List.of(),decisions,null,null,null,Instant.now());}
    }
    @Test void automaticSaveDoesNotImpersonateHumanReviewAndManualSaveStillRequiresConfirmation(){
        var previous=SecurityContextHolder.getContext();var scoped=SecurityContextHolder.createEmptyContext();scoped.setAuthentication(new UsernamePasswordAuthenticationToken(new BobbuyAuthenticatedUser(9L,"synthetic","Synthetic",Set.of(Role.AGENT)),null,List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));SecurityContextHolder.setContext(scoped);
        try {
            var rejected=new Fixture();assertThrows(ApiException.class,()->rejected.service.save(List.of(rejected.input(rejected.candidate())),false));verifyNoInteractions(rejected.products,rejected.users,rejected.recoveries);
            var ai=new Fixture();var c=ai.candidate();var result=ai.service.saveAutomated(ai.job(c),c,CostcoNumberOnboardingService.candidateHash(c),List.of(ai.input(c)));
            assertEquals(1,result.size());assertNull(ai.product.getCatalogData().reviewedBy());assertNull(ai.product.getCatalogData().reviewedAt());assertNull(ai.product.getCatalogData().translatedSource());assertEquals("Existing English spec",ai.product.getCatalogData().specification().get("en-US"));verify(ai.recoveries).saveAndFlush(any(ProductCatalogRecovery.class));
            var human=new Fixture();human.service.save(List.of(human.input(human.candidate())),true);assertEquals(9L,human.product.getCatalogData().reviewedBy());assertNotNull(human.product.getCatalogData().reviewedAt());verify(human.recoveries).saveAndFlush(any(ProductCatalogRecovery.class));
        }finally{SecurityContextHolder.setContext(previous);}
    }
}
