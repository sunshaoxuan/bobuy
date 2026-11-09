package com.bobbuy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.security.MessageDigest;
import java.util.HexFormat;

/** Owner-scoped, private evidence bytes in the existing DB. No public URLs or credential material. */
@Component
public class CostcoEvidencePersistence implements CostcoEvidenceStore {
    private final JdbcTemplate jdbc; private final ObjectMapper mapper;private final com.bobbuy.repository.UserRepository users;private final long maxBytes;
    public CostcoEvidencePersistence(JdbcTemplate jdbc,ObjectMapper mapper,com.bobbuy.repository.UserRepository users,
            @org.springframework.beans.factory.annotation.Value("${bobbuy.ai.costco.quota.evidence-bytes:536870912}")long maxBytes) {
        if(maxBytes<8*1024*1024||maxBytes>8L*1024*1024*1024)throw new IllegalArgumentException("onboarding.quota_config");this.jdbc=jdbc;this.mapper=mapper;this.users=users;this.maxBytes=maxBytes;
    }
    public static String hash(byte[] content) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content)); } catch(Exception e) { throw new IllegalStateException(e); } }
    private void validate(long owner, String hash, byte[] bytes) {
        if (owner<=0 || bytes==null || bytes.length==0 || bytes.length>8*1024*1024 || !hash(bytes).equals(hash)) throw new IllegalArgumentException("onboarding.evidence_bytes");
    }
    private boolean reserve(long owner,String hash,byte[] bytes){
        users.lockById(owner).filter(u->u.isEnabled()&&u.getRoles().contains(com.bobbuy.model.Role.AGENT)).orElseThrow(()->new CostcoNumberOnboardingService.NeedsInput("onboarding.scope_changed"));
        var prior=jdbc.query("select content from bb_costco_onboarding_evidence where merchant_id=? and sha256=?",(rs,n)->rs.getBytes(1),owner,hash);
        if(!prior.isEmpty()){validate(owner,hash,prior.get(0));if(!java.util.Arrays.equals(prior.get(0),bytes))throw new IllegalStateException("onboarding.evidence_collision");return false;}
        Long used=jdbc.queryForObject("select coalesce(sum(octet_length(content)),0) from bb_costco_onboarding_evidence where merchant_id=?",Long.class,owner);
        if(used!=null&&used>maxBytes-bytes.length)throw new CostcoOnboardingQuotaException("onboarding.evidence_quota",3600);return true;
    }
    @Override @Transactional public void put(CostcoOfficialEvidenceFetcher.Query query, CostcoOfficialEvidence evidence, byte[] content) {
        validate(query.merchantId(), evidence.sha256(), content);
        if(!reserve(query.merchantId(),evidence.sha256(),content))return;
        try {
            jdbc.update("insert into bb_costco_onboarding_evidence(merchant_id,sha256,supplier_id,input_hash,kind,content_type,content,receipt) values(?,?,?,?,'OFFICIAL_EVIDENCE',?,?,cast(? as jsonb)) on conflict(merchant_id,sha256) do nothing",
                    query.merchantId(), evidence.sha256(), query.supplierId(), query.inputHash(), evidence.mediaType(), content, mapper.writeValueAsString(evidence));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException("onboarding.evidence_encoding", e); }
        if (!java.util.Arrays.equals(readVerified(query.merchantId(), evidence.sha256()), content)) throw new IllegalStateException("onboarding.evidence_collision");
    }
    @Transactional public String putPrivatePhoto(long owner, byte[] content) {
        var image = RecommendationImageValidator.validate(content); String hash = hash(content); validate(owner, hash, content);
        if(!reserve(owner,hash,content))return hash;
        jdbc.update("insert into bb_costco_onboarding_evidence(merchant_id,sha256,kind,content_type,content) values(?,?,'PRIVATE_PHOTO',?,?) on conflict(merchant_id,sha256) do nothing", owner, hash, image.contentType(), content);
        return hash;
    }
    @Override @Transactional(readOnly = true) public byte[] readVerified(long owner, String hash) {
        if (owner<=0 || hash==null || !hash.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("onboarding.evidence_scope");
        var rows = jdbc.query("select content from bb_costco_onboarding_evidence where merchant_id=? and sha256=?", (rs,n)->rs.getBytes(1), owner, hash);
        if (rows.isEmpty()) throw new IllegalArgumentException("onboarding.evidence_missing");
        byte[] result=rows.get(0); validate(owner,hash,result); return result.clone();
    }
}
