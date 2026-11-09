package com.bobbuy.repository;

import com.bobbuy.model.CostcoOnboardingJob;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import static com.bobbuy.model.CostcoOnboardingJob.State.*;

/** Short DB transactions only. External retrieval/AI/catalog work runs after claim commits. */
@Repository
public class JdbcCostcoOnboardingJobRepository implements CostcoOnboardingJobRepository {
    /** RHS uses the old row values in this same UPDATE; history is separate from payload, never recursive. */
    private static final String ARCHIVE_ATTEMPT="attempt_history=case when state<>'COMMITTING' and attempts>0 and not exists (select 1 from jsonb_array_elements(attempt_history) as archived(value) where (archived.value->>'attempt')::integer=attempts) then attempt_history || jsonb_build_array(jsonb_build_object('attempt',attempts,'payload',payload,'lastUpdatedAt',updated_at)) else attempt_history end,";
    private final JdbcTemplate jdbc; private final ObjectMapper mapper;private final UserRepository users;private final int maxPending;private final int maxPerDay;
    private final ThreadLocal<Lease> active = new ThreadLocal<>();
    public JdbcCostcoOnboardingJobRepository(JdbcTemplate jdbc,ObjectMapper mapper,UserRepository users,
            @org.springframework.beans.factory.annotation.Value("${bobbuy.ai.costco.quota.pending:32}")int maxPending,
            @org.springframework.beans.factory.annotation.Value("${bobbuy.ai.costco.quota.daily:250}")int maxPerDay) {
        if(maxPending<1||maxPending>4096||maxPerDay<1||maxPerDay>10000)throw new IllegalArgumentException("onboarding.quota_config");
        this.jdbc=jdbc;this.mapper=mapper;this.users=users;this.maxPending=maxPending;this.maxPerDay=maxPerDay;
    }
    private String json(CostcoOnboardingJob value) { try { return mapper.writeValueAsString(value); } catch (Exception e) { throw new IllegalStateException("onboarding.job_encoding", e); } }
    private CostcoOnboardingJob parse(String value) { try { return mapper.readValue(value, CostcoOnboardingJob.class); } catch (Exception e) { throw new IllegalStateException("onboarding.job_encoding", e); } }
    @Override @Transactional public CostcoOnboardingJob createOrGet(CostcoOnboardingJob q) {
        users.lockById(q.merchantId()).filter(u->u.isEnabled()&&u.getRoles().contains(com.bobbuy.model.Role.AGENT)).orElseThrow(()->new com.bobbuy.service.CostcoNumberOnboardingService.NeedsInput("onboarding.scope_changed"));
        var prior=jdbc.query("select cast(payload as text) from bb_costco_onboarding_job where idempotency_key=? and merchant_id=?",(rs,n)->parse(rs.getString(1)),q.idempotencyKey(),q.merchantId());
        if(!prior.isEmpty())return prior.get(0); // Explicit retries consume neither quota nor another row.
        Long pending=jdbc.queryForObject("select count(*) from bb_costco_onboarding_job where merchant_id=? and state in ('QUEUED','AI_INTAKE','EVIDENCE_FETCH','AI_REVIEW','COMMITTING','RETRY_WAIT')",Long.class,q.merchantId());
        if(pending!=null&&pending>=maxPending)throw new com.bobbuy.service.CostcoOnboardingQuotaException("onboarding.pending_quota",30);
        Long daily=jdbc.queryForObject("select count(*) from bb_costco_onboarding_job where merchant_id=? and created_at>=current_timestamp-interval '24 hours'",Long.class,q.merchantId());
        if(daily!=null&&daily>=maxPerDay)throw new com.bobbuy.service.CostcoOnboardingQuotaException("onboarding.daily_quota",3600);
        jdbc.update("insert into bb_costco_onboarding_job(id,merchant_id,supplier_id,market,idempotency_key,input_hash,revision,state,payload) values(?,?,?,?,?,?,?,?,cast(? as jsonb)) on conflict(idempotency_key) do nothing",
                q.id(), q.merchantId(), q.supplierId(), q.market(), q.idempotencyKey(), q.inputHash(), q.revision(), q.state().name(), json(q));
        return parse(jdbc.queryForObject("select cast(payload as text) from bb_costco_onboarding_job where idempotency_key=? and merchant_id=?", String.class, q.idempotencyKey(), q.merchantId()));
    }
    @Override @Transactional(readOnly = true) public Optional<CostcoOnboardingJob> findOwned(String id, long merchantId) {
        return jdbc.query("select cast(payload as text) from bb_costco_onboarding_job where id=? and merchant_id=?", (rs,n) -> parse(rs.getString(1)), id, merchantId).stream().findFirst();
    }
    @Transactional(readOnly = true) public List<CostcoOnboardingJob> recent(long merchantId) {
        return jdbc.query("select cast(payload as text) from bb_costco_onboarding_job where merchant_id=? order by updated_at desc limit 40", (rs,n) -> parse(rs.getString(1)), merchantId);
    }
    @Override @Transactional public boolean compareAndSet(CostcoOnboardingJob old, CostcoOnboardingJob next) {
        var lease = active.get();
        if (lease == null || !lease.job().id().equals(old.id()) || old.merchantId() != next.merchantId()
                || next.revision() != old.revision() + 1 || !old.idempotencyKey().equals(next.idempotencyKey())) return false;
        return jdbc.update("update bb_costco_onboarding_job set payload=cast(? as jsonb),revision=?,state=?,updated_at=?,lease_until=? where id=? and merchant_id=? and revision=? and lease_token=? and lease_until>current_timestamp",
                json(next), next.revision(), next.state().name(), Timestamp.from(next.updatedAt()), Timestamp.from(Instant.now().plusSeconds(900)),
                old.id(), old.merchantId(), old.revision(), lease.token()) == 1;
    }
    @Override @Transactional public Optional<Lease> claimNext(Instant now) {
        var exhausted=jdbc.query("select cast(payload as text) from bb_costco_onboarding_job where attempts>=3 and state in ('QUEUED','RETRY_WAIT','AI_INTAKE','EVIDENCE_FETCH','AI_REVIEW') and (lease_until is null or lease_until<=?) order by id limit 10 for update skip locked",(rs,n)->parse(rs.getString(1)),Timestamp.from(now));
        for(var old:exhausted){var failed=new CostcoOnboardingJob(old.id(),old.idempotencyKey(),old.merchantId(),old.supplierId(),old.market(),old.inputHash(),old.itemNumber(),old.privatePhotoSha256(),old.revision()+1,FAILED,old.evidence(),old.decisions(),null,null,"onboarding.retry_exhausted",now);
            jdbc.update("update bb_costco_onboarding_job set "+ARCHIVE_ATTEMPT+"payload=cast(? as jsonb),revision=?,state='FAILED',lease_token=null,lease_until=null,updated_at=? where id=?",json(failed),failed.revision(),Timestamp.from(now),old.id());}
        var candidates = jdbc.query("select cast(payload as text),attempts from bb_costco_onboarding_job where (lease_until is null or lease_until<=?) and next_run_at<=? and ((state in ('QUEUED','RETRY_WAIT','AI_INTAKE','EVIDENCE_FETCH','AI_REVIEW') and attempts<3) or (state='COMMITTING' and attempts<10)) order by next_run_at,id limit 1 for update skip locked",
                (rs,n) -> parse(rs.getString(1)), Timestamp.from(now), Timestamp.from(now));
        if (candidates.isEmpty()) return Optional.empty();
        var old = candidates.get(0); var value = old;
        if (old.state() != QUEUED && old.state() != COMMITTING) {
            value = new CostcoOnboardingJob(old.id(), old.idempotencyKey(), old.merchantId(), old.supplierId(), old.market(), old.inputHash(), old.itemNumber(), old.privatePhotoSha256(), old.revision()+1, QUEUED, List.of(), List.of(), null, null, null, now);
        }
        String token = UUID.randomUUID().toString();
        String archive=old.state()==COMMITTING?"":ARCHIVE_ATTEMPT;
        jdbc.update("update bb_costco_onboarding_job set "+archive+"payload=cast(? as jsonb),state=?,revision=?,attempts=attempts+1,lease_token=?,lease_until=?,updated_at=? where id=?", json(value), value.state().name(), value.revision(), token, Timestamp.from(now.plusSeconds(900)), Timestamp.from(now), value.id());
        return Optional.of(new Lease(value, token));
    }
    @Override public <T> T withLease(Lease lease, java.util.function.Supplier<T> action) {
        if (active.get() != null) throw new IllegalStateException("onboarding.nested_lease");
        active.set(lease); try { return action.get(); } finally { active.remove(); }
    }
    @Override @Transactional public void release(Lease lease) {
        jdbc.update("update bb_costco_onboarding_job set lease_token=null,lease_until=null,next_run_at=? where id=? and merchant_id=? and lease_token=?",
                Timestamp.from(Instant.now().plusSeconds(30)), lease.job().id(), lease.job().merchantId(), lease.token());
    }
}
