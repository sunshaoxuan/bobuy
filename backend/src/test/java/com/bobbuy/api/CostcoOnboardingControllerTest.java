package com.bobbuy.api;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.BobbuyAuthenticatedUser;
import com.bobbuy.service.*;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.multipart.MultipartFile;
import java.time.Clock;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CostcoOnboardingControllerTest {
    private static final String REQUEST="00000000-0000-0000-0000-000000000001";
    private static final class MemoryJobs implements CostcoOnboardingJobRepository {
        final Map<String,CostcoOnboardingJob> values=new HashMap<>();
        public CostcoOnboardingJob createOrGet(CostcoOnboardingJob j){return values.computeIfAbsent(j.idempotencyKey(),key->j);}
        public Optional<CostcoOnboardingJob> findOwned(String id,long owner){return values.values().stream().filter(j->j.id().equals(id)&&j.merchantId()==owner).findFirst();}
        public boolean compareAndSet(CostcoOnboardingJob a,CostcoOnboardingJob b){throw new AssertionError("Queue API must not process or save products");}
    }
    private final MemoryJobs memory=new MemoryJobs();
    private final JdbcCostcoOnboardingJobRepository jobs=mock(JdbcCostcoOnboardingJobRepository.class);
    private final SupplierRepository suppliers=mock(SupplierRepository.class);
    private final CostcoEvidencePersistence evidence=mock(CostcoEvidencePersistence.class);
    private final CostcoNumberOnboardingService service=new CostcoNumberOnboardingService(memory,q->{throw new AssertionError("No fetch in request");},(stage,j)->{throw new AssertionError("No AI in request");},(j,c,h)->{throw new AssertionError("No catalog in request");},Clock.systemUTC());
    private final CostcoOnboardingController controller=new CostcoOnboardingController(service,jobs,suppliers,evidence,true);
    private Authentication auth(long id,String role){return new UsernamePasswordAuthenticationToken(new BobbuyAuthenticatedUser(id,"synthetic","Synthetic",Set.of(Role.valueOf(role))),null,List.of(new SimpleGrantedAuthority("ROLE_"+role)));}
    private void supplier(long owner){var supplier=new Supplier();supplier.setId("supplier-jp");supplier.setMerchantId(owner);when(suppliers.findById("supplier-jp")).thenReturn(Optional.of(supplier));}
    private CostcoOnboardingController.NumberInput request(){return new CostcoOnboardingController.NumberInput(REQUEST,"supplier-jp","JP","００１４１１０");}
    @Test void agentQueuesUsingOnlyServerPrincipalAndDoesNotRunPipeline(){supplier(9);controller.number(auth(9,"AGENT"),request());assertEquals(1,memory.values.size());var job=memory.values.values().iterator().next();assertEquals(9,job.merchantId());assertEquals("supplier-jp",job.supplierId());assertEquals("0014110",job.itemNumber());assertEquals(CostcoOnboardingJob.State.QUEUED,job.state());}
    @Test void customerOrStringPrincipalCannotBorrowAgentScope(){assertThrows(ApiException.class,()->controller.number(auth(9,"CUSTOMER"),request()));var fake=new UsernamePasswordAuthenticationToken("agent-9",null,List.of(new SimpleGrantedAuthority("ROLE_AGENT")));assertThrows(ApiException.class,()->controller.number(fake,request()));verifyNoInteractions(suppliers,evidence);assertTrue(memory.values.isEmpty());}
    @Test void otherMerchantsSupplierIsNotAccepted(){supplier(10);assertThrows(ApiException.class,()->controller.number(auth(9,"AGENT"),request()));assertTrue(memory.values.isEmpty());verifyNoInteractions(evidence);}
    @Test void changedPayloadUnderSameExplicitIntentIsAConflict(){supplier(9);controller.number(auth(9,"AGENT"),request());assertThrows(org.springframework.web.server.ResponseStatusException.class,()->controller.number(auth(9,"AGENT"),new CostcoOnboardingController.NumberInput(REQUEST,"supplier-jp","JP","77839")));assertEquals(1,memory.values.size());}
    @Test void requestRejectsIdentityApprovalAndPriceFieldsEvenWhenUnknownPropertiesIgnored(){var mapper=new ObjectMapper().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);var raw="{\"requestId\":\""+REQUEST+"\",\"supplierId\":\"supplier-jp\",\"market\":\"JP\",\"itemNumber\":\"14110\"";for(var field:List.of("merchantId","ownerId","reviewed","price","roles","state"))assertThrows(Exception.class,()->mapper.readValue(raw+",\""+field+"\":1}",CostcoOnboardingController.NumberInput.class));}
    @Test void readsAreAlwaysScopedToPrincipalAndViewDoesNotContainPrivatePhoto(){supplier(9);controller.number(auth(9,"AGENT"),request());var job=memory.values.values().iterator().next();when(jobs.findOwned(job.id(),9)).thenReturn(Optional.of(job));when(jobs.findOwned(job.id(),10)).thenReturn(Optional.empty());assertNotNull(controller.get(auth(9,"AGENT"),job.id()));assertThrows(ApiException.class,()->controller.get(auth(10,"AGENT"),job.id()));assertFalse(Arrays.stream(CostcoOnboardingController.View.class.getRecordComponents()).anyMatch(c->c.getName().contains("Photo")||c.getName().contains("merchant")));}
    @Test void photoQueuesOwnedOriginalHashThroughSameJobPath() throws Exception {supplier(9);var file=mock(MultipartFile.class);byte[] original={1,2,3};when(file.getSize()).thenReturn(3L);when(file.getBytes()).thenReturn(original);when(evidence.putPrivatePhoto(9,original)).thenReturn("a".repeat(64));controller.photo(auth(9,"AGENT"),REQUEST,"supplier-jp","JP",file);var job=memory.values.values().iterator().next();assertEquals("a".repeat(64),job.privatePhotoSha256());assertNull(job.itemNumber());verify(evidence).putPrivatePhoto(9,original);}
    @Test void disabledWorkerDoesNotAcceptForeverQueuedTasks(){var disabled=new CostcoOnboardingController(service,jobs,suppliers,evidence,false);assertThrows(ApiException.class,()->disabled.number(auth(9,"AGENT"),request()));verifyNoInteractions(suppliers,evidence);assertTrue(memory.values.isEmpty());}
    @Test void quotaIsTyped429WithARecoverableRetryHint(){var response=controller.quota(new CostcoOnboardingQuotaException("onboarding.pending_quota",30));assertEquals(429,response.getStatusCode().value());assertEquals("30",response.getHeaders().getFirst("Retry-After"));}
}
