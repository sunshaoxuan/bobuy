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
    private static final String ARCHIVE_ATTEMPT="attempt_history=case when state<>'COMMITTING' and attempts>0 and not exists (select 1 from jsonb_array_elements(attempt_history) as archived(value) where (archived.value->>'attempt')::integer=attempts and (payload->>'privatePhotoSha256' is null or archived.value->'payload'->>'revision'=cast(revision as text))) then attempt_history || jsonb_build_array(jsonb_build_object('attempt',attempts,'payload',payload,'lastUpdatedAt',updated_at)) else attempt_history end,";
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
        var alias = jdbc.query("""
                select cast(j.payload as text) from bb_product_photo_request r
                join bb_costco_onboarding_job j on j.id=r.job_id
                where r.request_key=? and j.merchant_id=?
                """, (rs,n)->parse(rs.getString(1)), q.idempotencyKey(), q.merchantId());
        if (!alias.isEmpty()) return alias.get(0);
        if (q.privatePhotoSha256() == null) {
            Long pending=jdbc.queryForObject("select count(*) from bb_costco_onboarding_job where merchant_id=? and payload->>'privatePhotoSha256' is null and state in ('QUEUED','AI_INTAKE','EVIDENCE_FETCH','AI_REVIEW','COMMITTING','RETRY_WAIT')",Long.class,q.merchantId());
            if(pending!=null&&pending>=maxPending)throw new com.bobbuy.service.CostcoOnboardingQuotaException("onboarding.pending_quota",30);
            Long daily=jdbc.queryForObject("select count(*) from bb_costco_onboarding_job where merchant_id=? and payload->>'privatePhotoSha256' is null and created_at>=current_timestamp-interval '24 hours'",Long.class,q.merchantId());
            if(daily!=null&&daily>=maxPerDay)throw new com.bobbuy.service.CostcoOnboardingQuotaException("onboarding.daily_quota",3600);
        } else {
            var matching = jdbc.query("""
                    select cast(j.payload as text) from bb_costco_onboarding_job j
                    left join bb_product_photo_observation o on o.job_id=j.id
                    where j.merchant_id=? and j.input_hash=? and j.payload->>'privatePhotoSha256' is not null
                    order by (o.id is not null) desc, j.created_at, j.id limit 1
                    """, (rs,n)->parse(rs.getString(1)), q.merchantId(), q.inputHash());
            if (!matching.isEmpty()) {
                var existing = matching.get(0);
                jdbc.update("insert into bb_product_photo_request(request_key,job_id) values(?,?)",
                        q.idempotencyKey(), existing.id());
                return existing;
            }
        }
        jdbc.update("insert into bb_costco_onboarding_job(id,merchant_id,supplier_id,market,idempotency_key,input_hash,revision,state,payload) values(?,?,?,?,?,?,?,?,cast(? as jsonb)) on conflict(idempotency_key) do nothing",
                q.id(), q.merchantId(), q.supplierId(), q.market(), q.idempotencyKey(), q.inputHash(), q.revision(), q.state().name(), json(q));
        return parse(jdbc.queryForObject("select cast(payload as text) from bb_costco_onboarding_job where idempotency_key=? and merchant_id=?", String.class, q.idempotencyKey(), q.merchantId()));
    }
    @Override @Transactional(readOnly = true) public Optional<CostcoOnboardingJob> findOwned(String id, long merchantId) {
        return jdbc.query("select cast(payload as text) from bb_costco_onboarding_job where id=? and merchant_id=?", (rs,n) -> parse(rs.getString(1)), id, merchantId).stream().findFirst();
    }
    @Transactional(readOnly = true) public List<CostcoOnboardingJob> recent(long merchantId, boolean numbersOnly) {
        return jdbc.query("""
                select cast(payload as text) from bb_costco_onboarding_job where merchant_id=?
                    and (not ? or payload->>'privatePhotoSha256' is null)
                order by updated_at desc limit 40
                """, (rs,n) -> parse(rs.getString(1)), merchantId, numbersOnly);
    }
    public record PhotoQueueRow(String id,String state,long revision,String itemNumber,String productId,
                                String failureCode,String supplierId,String market,Instant createdAt,boolean reviewReady) {}

    @Transactional(readOnly = true) public List<PhotoQueueRow> photos(long merchantId) {
        return jdbc.query("""
                select j.id,case when o.id is not null then 'COMPLETED' else j.state end,j.revision,
                    j.payload->>'itemNumber',o.product_id,j.payload->>'failureCode',j.supplier_id,j.market,j.created_at,
                    j.state in ('NEEDS_INPUT','FAILED') and j.payload->>'itemNumber' is not null and exists (
                        select 1 from jsonb_array_elements(j.payload->'decisions') d
                        where d->>'stage'='INTAKE' and jsonb_typeof(d->'candidate'->'photoFacts')='object'
                    )
                from bb_costco_onboarding_job j
                left join bb_product_photo_observation o on o.job_id=j.id and o.merchant_id=j.merchant_id
                where j.merchant_id=? and j.payload->>'privatePhotoSha256' is not null
                order by j.created_at desc,j.id desc
                """, (rs,n)->new PhotoQueueRow(rs.getString(1),rs.getString(2),rs.getLong(3),rs.getString(4),
                rs.getString(5),rs.getString(6),rs.getString(7),rs.getString(8),rs.getTimestamp(9).toInstant(),rs.getBoolean(10)),merchantId);
    }

    @Transactional
    public CostcoOnboardingJob retryPhoto(CostcoOnboardingJob old) {
        Instant now=Instant.now();
        var queued=new CostcoOnboardingJob(old.id(),old.idempotencyKey(),old.merchantId(),old.supplierId(),
                old.market(),old.inputHash(),null,old.privatePhotoSha256(),old.revision()+1,QUEUED,
                List.of(),List.of(),null,null,null,now,old.packagingPhotoSha256());
        int updated=jdbc.update("update bb_costco_onboarding_job set "+ARCHIVE_ATTEMPT+"""
                payload=cast(? as jsonb),state='QUEUED',revision=?,attempts=0,
                    lease_token=null,lease_until=null,next_run_at=?,updated_at=?
                where id=? and merchant_id=? and revision=?
                  and payload->>'privatePhotoSha256' is not null
                  and state in ('NEEDS_INPUT','FAILED','CANCELLED','RETRY_WAIT')
                """,json(queued),queued.revision(),Timestamp.from(now),Timestamp.from(now),
                old.id(),old.merchantId(),old.revision());
        return updated==1?queued:findOwned(old.id(),old.merchantId()).orElseThrow();
    }

    @Transactional
    public CostcoOnboardingJob supplementPhoto(CostcoOnboardingJob old,String hash) {
        Instant now=Instant.now();
        var queued=new CostcoOnboardingJob(old.id(),old.idempotencyKey(),old.merchantId(),old.supplierId(),
                old.market(),old.inputHash(),null,hash,old.revision()+1,QUEUED,
                List.of(),List.of(),null,null,null,now,old.packagingPhotoSha256()==null?old.privatePhotoSha256():old.packagingPhotoSha256());
        int updated=jdbc.update("""
                update bb_costco_onboarding_job set
                    attempt_history=attempt_history || jsonb_build_array(
                        jsonb_build_object('attempt',attempts,'payload',payload,'lastUpdatedAt',updated_at)),
                    payload=cast(? as jsonb),state='QUEUED',revision=?,attempts=0,
                    lease_token=null,lease_until=null,next_run_at=?,updated_at=?
                where id=? and merchant_id=? and revision=? and state='NEEDS_INPUT'
                    and payload->>'failureCode'='photo.tag_missing'
                """,json(queued),queued.revision(),Timestamp.from(now),Timestamp.from(now),old.id(),old.merchantId(),old.revision());
        if(updated!=1)throw new com.bobbuy.api.response.ApiException(com.bobbuy.api.response.ErrorCode.INVALID_STATUS,"photo.conflict");
        return queued;
    }

    /** Attach the optional packaging view before a queued job can be claimed. */
    @Transactional
    public CostcoOnboardingJob attachPackagingPhoto(CostcoOnboardingJob old,String hash) {
        if(old.packagingPhotoSha256()!=null)return old;
        var next=new CostcoOnboardingJob(old.id(),old.idempotencyKey(),old.merchantId(),old.supplierId(),old.market(),old.inputHash(),old.itemNumber(),old.privatePhotoSha256(),old.revision()+1,old.state(),old.evidence(),old.decisions(),old.productId(),old.productVersion(),old.failureCode(),Instant.now(),hash);
        int changed=jdbc.update("update bb_costco_onboarding_job set payload=cast(? as jsonb),revision=?,updated_at=? where id=? and merchant_id=? and revision=? and state='QUEUED' and lease_token is null",json(next),next.revision(),Timestamp.from(next.updatedAt()),old.id(),old.merchantId(),old.revision());
        if(changed!=1)throw new com.bobbuy.api.response.ApiException(com.bobbuy.api.response.ErrorCode.INVALID_STATUS,"photo.conflict");
        return next;
    }

    /** Reopens the same durable photo job after missing packaging evidence is supplied. */
    @Transactional
    public CostcoOnboardingJob restartWithPackagingPhoto(CostcoOnboardingJob old, String hash) {
        if (!java.util.Set.of(FAILED, NEEDS_INPUT).contains(old.state()) || old.packagingPhotoSha256() != null)
            throw new com.bobbuy.api.response.ApiException(com.bobbuy.api.response.ErrorCode.INVALID_STATUS,"photo.conflict");
        var now=Instant.now();
        var next=new CostcoOnboardingJob(old.id(),old.idempotencyKey(),old.merchantId(),old.supplierId(),old.market(),old.inputHash(),
                old.itemNumber(),old.privatePhotoSha256(),old.revision()+1,QUEUED,List.of(),List.of(),null,null,null,now,hash);
        int changed=jdbc.update("update bb_costco_onboarding_job set "+ARCHIVE_ATTEMPT+"payload=cast(? as jsonb),revision=?,state='QUEUED',attempts=0,lease_token=null,lease_until=null,next_run_at=current_timestamp,updated_at=? where id=? and merchant_id=? and revision=? and state in ('FAILED','NEEDS_INPUT') and lease_token is null",
                json(next),next.revision(),Timestamp.from(now),old.id(),old.merchantId(),old.revision());
        if(changed!=1)throw new com.bobbuy.api.response.ApiException(com.bobbuy.api.response.ErrorCode.INVALID_STATUS,"photo.conflict");
        return next;
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
        for(var old:exhausted){var failed=new CostcoOnboardingJob(old.id(),old.idempotencyKey(),old.merchantId(),old.supplierId(),old.market(),old.inputHash(),old.itemNumber(),old.privatePhotoSha256(),old.revision()+1,FAILED,old.evidence(),old.decisions(),null,null,"onboarding.retry_exhausted",now,old.packagingPhotoSha256());
            jdbc.update("update bb_costco_onboarding_job set "+ARCHIVE_ATTEMPT+"payload=cast(? as jsonb),revision=?,state='FAILED',lease_token=null,lease_until=null,updated_at=? where id=?",json(failed),failed.revision(),Timestamp.from(now),old.id());}
        var candidates = jdbc.query("select cast(payload as text),attempts from bb_costco_onboarding_job where (lease_until is null or lease_until<=?) and next_run_at<=? and ((state in ('QUEUED','RETRY_WAIT','AI_INTAKE','EVIDENCE_FETCH','AI_REVIEW') and attempts<3) or (state='COMMITTING' and attempts<10)) order by next_run_at,id limit 1 for update skip locked",
                (rs,n) -> parse(rs.getString(1)), Timestamp.from(now), Timestamp.from(now));
        if (candidates.isEmpty()) return Optional.empty();
        var old = candidates.get(0); var value = old;
        if (old.state() != QUEUED && old.state() != COMMITTING) {
            value = new CostcoOnboardingJob(old.id(), old.idempotencyKey(), old.merchantId(), old.supplierId(), old.market(), old.inputHash(), old.privatePhotoSha256()==null?old.itemNumber():null, old.privatePhotoSha256(), old.revision()+1, QUEUED, List.of(), List.of(), null, null, null, now,old.packagingPhotoSha256());
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
