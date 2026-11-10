package com.bobbuy.repository;

import com.bobbuy.model.*;
import com.bobbuy.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Mocked SQL intent and budget semantics only. Real PG row locks/concurrency remain NOT_RUN. */
class CostcoOnboardingQuotaTest {
    private final JdbcTemplate jdbc=mock(JdbcTemplate.class);private final UserRepository users=mock(UserRepository.class);
    private final ObjectMapper mapper=new ObjectMapper().findAndRegisterModules();
    private final JdbcCostcoOnboardingJobRepository jobs=new JdbcCostcoOnboardingJobRepository(jdbc,mapper,users,32,250);
    private final CostcoEvidencePersistence store=new CostcoEvidencePersistence(jdbc,mapper,users,8*1024*1024);
    private User active(){var user=new User();user.setId(9L);user.setName("Synthetic");user.setRoles(Set.of(Role.AGENT));user.setEnabled(true);return user;}
    private CostcoOnboardingJob queued(){return new CostcoOnboardingJob("job","a".repeat(64),9,"supplier-jp","JP","b".repeat(64),"14110",null,0,CostcoOnboardingJob.State.QUEUED,List.of(),List.of(),null,null,null,Instant.now());}
    @Test @SuppressWarnings("unchecked") void sameExplicitKeyIsReturnedBeforeBudgetChecksOrInsert(){var q=queued();when(users.lockById(9L)).thenReturn(Optional.of(active()));doReturn(List.of(q)).when(jdbc).query(anyString(),any(RowMapper.class),any(Object[].class));assertEquals(q,jobs.createOrGet(q));var order=inOrder(users,jdbc);order.verify(users).lockById(9L);order.verify(jdbc).query(anyString(),any(RowMapper.class),any(Object[].class));verify(jdbc,never()).queryForObject(anyString(),eq(Long.class),any(Object[].class));verify(jdbc,never()).update(anyString(),any(Object[].class));}
    @Test void pendingQuotaRejectsBeforeAnyInsert(){when(users.lockById(9L)).thenReturn(Optional.of(active()));when(jdbc.queryForObject(anyString(),eq(Long.class),any(Object[].class))).thenReturn(32L);var error=assertThrows(CostcoOnboardingQuotaException.class,()->jobs.createOrGet(queued()));assertEquals("onboarding.pending_quota",error.getMessage());verify(jdbc,never()).update(anyString(),any(Object[].class));}
    @Test void rollingDailyQuotaIsSeparateAndStillInsideOwnerLock(){when(users.lockById(9L)).thenReturn(Optional.of(active()));when(jdbc.queryForObject(anyString(),eq(Long.class),any(Object[].class))).thenReturn(0L,250L);var error=assertThrows(CostcoOnboardingQuotaException.class,()->jobs.createOrGet(queued()));assertEquals("onboarding.daily_quota",error.getMessage());verify(jdbc,never()).update(anyString(),any(Object[].class));assertTrue(JdbcCostcoOnboardingJobRepository.class.getDeclaredMethods().length>0);assertTrue(Arrays.stream(JdbcCostcoOnboardingJobRepository.class.getDeclaredMethods()).filter(m->m.getName().equals("createOrGet")).allMatch(m->m.isAnnotationPresent(org.springframework.transaction.annotation.Transactional.class)));}
    @Test @SuppressWarnings("unchecked") void sameEvidenceHashReusesOriginalBytesBeforeCapacityChecks(){byte[] bytes={1,2,3};String hash=CostcoEvidencePersistence.hash(bytes);when(users.lockById(9L)).thenReturn(Optional.of(active()));doReturn(List.of(bytes)).when(jdbc).query(anyString(),any(RowMapper.class),any(Object[].class));var query=new CostcoOfficialEvidenceFetcher.Query(9,"supplier-jp","JP","14110",null,"a".repeat(64));var receipt=new CostcoOfficialEvidence("doc",URI.create("https://example.test/product"),URI.create("https://example.test/product"),hash,Instant.now(),"text/html",null,null,List.of());store.put(query,receipt,bytes);verify(jdbc,never()).queryForObject(anyString(),eq(Long.class),any(Object[].class));verify(jdbc,never()).update(anyString(),any(Object[].class));}
    @Test @SuppressWarnings("unchecked") void newEvidenceOverCapacityDoesNotInsertOrDeleteAnyByte(){byte[] bytes={1,2,3};String hash=CostcoEvidencePersistence.hash(bytes);when(users.lockById(9L)).thenReturn(Optional.of(active()));when(jdbc.queryForObject(anyString(),eq(Long.class),any(Object[].class))).thenReturn(8*1024*1024-1L);var query=new CostcoOfficialEvidenceFetcher.Query(9,"supplier-jp","JP","14110",null,"a".repeat(64));var receipt=new CostcoOfficialEvidence("doc",URI.create("https://example.test/product"),URI.create("https://example.test/product"),hash,Instant.now(),"text/html",null,null,List.of());assertThrows(CostcoOnboardingQuotaException.class,()->store.put(query,receipt,bytes));var order=inOrder(users,jdbc);order.verify(users).lockById(9L);order.verify(jdbc).query(anyString(),any(RowMapper.class),any(Object[].class));order.verify(jdbc).queryForObject(anyString(),eq(Long.class),any(Object[].class));verify(jdbc,never()).update(anyString(),any(Object[].class));}
    @Test void revokedActorCannotReserveOrInsertBudgetedWork(){var actor=active();actor.setEnabled(false);when(users.lockById(9L)).thenReturn(Optional.of(actor));assertThrows(CostcoNumberOnboardingService.NeedsInput.class,()->jobs.createOrGet(queued()));verifyNoInteractions(jdbc);}
}
