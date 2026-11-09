package com.bobbuy.repository;

import com.bobbuy.model.CostcoOnboardingJob;
import com.bobbuy.service.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import static com.bobbuy.model.CostcoOnboardingJob.State.*;
import static com.bobbuy.service.CostcoOnboardingDecision.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** SQL call-contract and immutable snapshot tests only; no SQL/JSONB/PG execution is simulated or claimed. */
class CostcoOnboardingAttemptHistoryTest {
    private static final Instant NOW=Instant.parse("2026-11-09T11:00:00Z");
    private final ObjectMapper mapper=new ObjectMapper().findAndRegisterModules();
    private CostcoOnboardingJob old(CostcoOnboardingJob.State state){
        var trace=new EngineTrace("c".repeat(64),"d".repeat(64),37,123L,45L,Map.of());
        var decision=new CostcoOnboardingDecision(Stage.INTAKE,Verdict.ACCEPT,"synthetic-not-live","synthetic-model",CostcoNumberOnboardingService.REQUIRED_NODE,"b".repeat(64),List.of(),"unit-policy","unit-prompt","Synthetic fixture","14110",null,trace);
        return new CostcoOnboardingJob("job","a".repeat(64),9,"supplier-jp","JP","b".repeat(64),"14110",null,4,state,List.of(),List.of(decision),null,null,"onboarding.stage_failed",NOW.minusSeconds(60));
    }
    private void assertArchiveContract(String sql){
        assertTrue(sql.contains("attempt_history=case"));assertTrue(sql.contains("state<>'COMMITTING' and attempts>0"));
        assertTrue(sql.contains("not exists (select 1 from jsonb_array_elements(attempt_history)"));
        assertTrue(sql.contains("(archived.value->>'attempt')::integer=attempts"));
        assertTrue(sql.contains("attempt_history || jsonb_build_array(jsonb_build_object('attempt',attempts,'payload',payload,'lastUpdatedAt',updated_at))"));
        assertTrue(sql.contains("else attempt_history end,payload=cast(? as jsonb)"));
    }
    private void assertTrace(JsonNode payload){var trace=payload.path("decisions").get(0).path("trace");assertEquals("c".repeat(64),trace.path("inputRef").asText());assertEquals("d".repeat(64),trace.path("outputRef").asText());assertEquals(123,trace.path("promptTokens").asInt());assertEquals(45,trace.path("completionTokens").asInt());assertEquals(37,trace.path("latencyMs").asLong());}
    @Test @SuppressWarnings("unchecked") void retryAndCrashedStagesArchiveOldColumnPayloadInTheSameUpdateThatClearsCurrentDecisions() throws Exception {
        for(var state:List.of(RETRY_WAIT,AI_INTAKE,EVIDENCE_FETCH,AI_REVIEW)){
            var jdbc=mock(JdbcTemplate.class);var previous=old(state);var before=mapper.valueToTree(previous);
            doAnswer(call->((String)call.getArgument(0)).contains("attempts>=3")?List.of():List.of(previous)).when(jdbc).query(anyString(),any(RowMapper.class),any(Object[].class));
            var jobs=new JdbcCostcoOnboardingJobRepository(jdbc,mapper,mock(UserRepository.class),32,250);var lease=jobs.claimNext(NOW).orElseThrow();
            var sql=ArgumentCaptor.forClass(String.class);var args=ArgumentCaptor.forClass(Object[].class);verify(jdbc).update(sql.capture(),args.capture());assertArchiveContract(sql.getValue());
            var current=mapper.readTree((String)args.getValue()[0]);assertEquals("QUEUED",current.path("state").asText());assertEquals(0,current.path("decisions").size());assertEquals(0,current.path("evidence").size());assertEquals(previous.inputHash(),current.path("inputHash").asText());
            assertTrue(current.path("attempt_history").isMissingNode());assertTrue(current.path("attemptHistory").isMissingNode());assertTrace(before);assertEquals(before,mapper.valueToTree(previous));assertEquals(QUEUED,lease.job().state());
        }
    }
    @Test @SuppressWarnings("unchecked") void exhaustionArchivesFinalUnarchivedAttemptBeforeReplacingItsFailureCode() throws Exception {
        var jdbc=mock(JdbcTemplate.class);var previous=old(RETRY_WAIT);
        doAnswer(call->((String)call.getArgument(0)).contains("attempts>=3")?List.of(previous):List.of()).when(jdbc).query(anyString(),any(RowMapper.class),any(Object[].class));
        var jobs=new JdbcCostcoOnboardingJobRepository(jdbc,mapper,mock(UserRepository.class),32,250);assertTrue(jobs.claimNext(NOW).isEmpty());
        var sql=ArgumentCaptor.forClass(String.class);var args=ArgumentCaptor.forClass(Object[].class);verify(jdbc).update(sql.capture(),args.capture());assertArchiveContract(sql.getValue());assertTrue(sql.getValue().contains("state='FAILED'"));
        var failed=mapper.readTree((String)args.getValue()[0]);assertEquals("onboarding.retry_exhausted",failed.path("failureCode").asText());assertTrace(failed);assertEquals("onboarding.stage_failed",previous.failureCode());
    }
    @Test @SuppressWarnings("unchecked") void committingOnlyReclaimsForReconciliationWithoutResetOrHistoryAppend() throws Exception {
        var jdbc=mock(JdbcTemplate.class);var previous=old(COMMITTING);
        doAnswer(call->((String)call.getArgument(0)).contains("attempts>=3")?List.of():List.of(previous)).when(jdbc).query(anyString(),any(RowMapper.class),any(Object[].class));
        var jobs=new JdbcCostcoOnboardingJobRepository(jdbc,mapper,mock(UserRepository.class),32,250);var lease=jobs.claimNext(NOW).orElseThrow();
        var sql=ArgumentCaptor.forClass(String.class);var args=ArgumentCaptor.forClass(Object[].class);verify(jdbc).update(sql.capture(),args.capture());assertFalse(sql.getValue().contains("attempt_history"));
        var current=mapper.readTree((String)args.getValue()[0]);assertEquals(mapper.writeValueAsString(previous),args.getValue()[0]);assertTrace(current);assertEquals(previous,lease.job());
    }
}
