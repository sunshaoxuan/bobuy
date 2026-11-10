package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.BobbuyAuthenticatedUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static com.bobbuy.service.CostcoOnboardingDecision.*;

/** Real catalog adapter. No legacy zero-price creation or arbitrary duplicate selection. */
@Component
public class CostcoCatalogCommitter implements CostcoNumberOnboardingService.CatalogCommitter {
    private final ProductCatalogService catalog;private final ProductRepository products;private final UserRepository users;
    private final SupplierRepository suppliers;private final CostcoEvidenceStore evidence;private final JdbcTemplate jdbc;private final ObjectMapper mapper;
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;
    public CostcoCatalogCommitter(ProductCatalogService catalog,ProductRepository products,UserRepository users,SupplierRepository suppliers,CostcoEvidenceStore evidence,JdbcTemplate jdbc,ObjectMapper mapper){this.catalog=catalog;this.products=products;this.users=users;this.suppliers=suppliers;this.evidence=evidence;this.jdbc=jdbc;this.mapper=mapper;}
    private void admission(CostcoOnboardingJob job,Candidate candidate,String hash) {
        if(job.state()!=CostcoOnboardingJob.State.COMMITTING||!CostcoNumberOnboardingService.candidateHash(candidate).equals(hash))throw new IllegalArgumentException("onboarding.commit_contract");
        for(var stage:Stage.values()) {
            var d=job.decisions().stream().filter(x->x.stage()==stage).reduce((a,b)->b).orElseThrow(()->new CostcoNumberOnboardingService.NeedsInput("onboarding.admission_missing"));
            if(d.verdict()!=Verdict.ACCEPT||d.trace()==null||!CostcoNumberOnboardingService.REQUIRED_NODE.equals(d.endpoint())||!job.inputHash().equals(d.inputHash()))throw new CostcoNumberOnboardingService.NeedsInput("onboarding.admission_missing");
        }
        var names=candidate.translatedNames();
        if(!names.keySet().containsAll(Set.of("ja-JP","zh-CN","zh-TW","en-US"))||names.values().stream().anyMatch(v->v==null||v.isBlank())||!Objects.equals(names.get("ja-JP"),candidate.name()))
            throw new CostcoNumberOnboardingService.NeedsInput("onboarding.translations_missing");
        if(suppliers.findById(job.supplierId()).filter(s->Long.valueOf(job.merchantId()).equals(s.getMerchantId())).isEmpty())throw new CostcoNumberOnboardingService.NeedsInput("onboarding.supplier_not_found");
    }
    @Override @Transactional public CostcoNumberOnboardingService.CommitReceipt commitOnce(CostcoOnboardingJob job,Candidate candidate,String hash) {
        admission(job,candidate,hash);users.lockById(job.merchantId()).orElseThrow();
        var prior=reconcile(job,hash);if(prior.isPresent())return prior.get();
        var actor=users.findById(job.merchantId()).filter(u->u.isEnabled()&&u.getRoles()!=null&&u.getRoles().contains(Role.AGENT)).orElseThrow(()->new CostcoNumberOnboardingService.NeedsInput("error.auth.forbidden"));
        var matches=products.findAllByMerchantIdAndItemNumber(job.merchantId(),candidate.itemNumber()).stream()
                .filter(p->p.getCatalogData()!=null&&job.supplierId().equals(p.getCatalogData().supplierId())&&job.market().equals(p.getAttributes().get("sourceMarket"))).toList();
        // A draft task already durably contains all candidate facts. A new sale price must stay unknown.
        if(matches.isEmpty())throw new CostcoNumberOnboardingService.NeedsInput("onboarding.new_master_needs_price_policy");
        if(candidate.target()==null)throw new CostcoNumberOnboardingService.NeedsInput("onboarding.target_required");
        var target=matches.stream().filter(x->candidate.target().productId().equals(x.getId())).findFirst().orElseThrow(()->new CostcoNumberOnboardingService.NeedsInput("onboarding.target_conflict"));
        var p=products.lockById(target.getId()).orElseThrow();entityManager.refresh(p,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if(!Long.valueOf(job.merchantId()).equals(p.getMerchantId())||!job.itemNumber().equals(p.getItemNumber())||p.getCatalogData()==null
                ||!job.supplierId().equals(p.getCatalogData().supplierId())||!job.market().equals(p.getAttributes().get("sourceMarket"))
                ||!Long.valueOf(candidate.target().version()).equals(p.getRecordVersion())||!ProductCatalogService.sourceHash(p).equals(candidate.target().sourceHash()))
            throw new CostcoNumberOnboardingService.NeedsInput("onboarding.target_conflict");
        var previous=SecurityContextHolder.getContext();var context=SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(new BobbuyAuthenticatedUser(actor.getId(),actor.getUsername(),actor.getName(),actor.getRoles()),null,List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));
        SecurityContextHolder.setContext(context);
        try {
            var source=job.evidence().stream().filter(e->e.sha256().equals(candidate.officialImageSha256())).findFirst().orElseThrow();
            if(source.canonicalUrl().getRawQuery()!=null||source.canonicalUrl().getRawFragment()!=null||source.canonicalUrl().getRawUserInfo()!=null)
                throw new CostcoNumberOnboardingService.NeedsInput("onboarding.canonical_source_required");
            if(candidate.name().length()>200)throw new CostcoNumberOnboardingService.NeedsInput("onboarding.catalog_validation");
            byte[] bytes=evidence.readVerified(job.merchantId(),source.sha256());
            var media=catalog.upload(p.getId(),RecommendationImageValidator.validate(bytes),source.canonicalUrl().toString(),candidate.name(),true);
            var original=catalog.get(p.getId()).value();var gallery=new ArrayList<>(original.gallery());
            if(gallery.stream().noneMatch(m->Objects.equals(m.getUrl(),media.getUrl())))gallery.add(media);
            var specification=new LinkedHashMap<>(original.specification());
            if(candidate.specification()!=null)specification.put("ja-JP",candidate.specification());
            var input=new ProductCatalogService.Input(p.getId(),original.version(),candidate.translatedNames(),original.description(),candidate.itemNumber(),candidate.brand()==null?original.brand():candidate.brand(),specification,candidate.model()==null?original.model():candidate.model(),candidate.packaging()==null?original.packaging():candidate.packaging(),original.categoryIds(),job.supplierId(),gallery,false);
            // AI provenance stays in the durable job; this path never impersonates human review.
            var saved=catalog.saveAutomated(job,candidate,hash,List.of(input)).get(0).value();var reopened=catalog.get(p.getId()).value();
            if(!mapper.valueToTree(saved).equals(mapper.valueToTree(reopened)))throw new IllegalStateException("onboarding.reopen_mismatch");
            jdbc.update("insert into bb_costco_onboarding_commit(idempotency_key,merchant_id,candidate_hash,product_id,product_version) values(?,?,?,?,?)",job.idempotencyKey(),job.merchantId(),hash,p.getId(),reopened.version());
            return new CostcoNumberOnboardingService.CommitReceipt(job.idempotencyKey(),hash,p.getId(),reopened.version(),true);
        } catch(com.bobbuy.api.response.ApiException rejection){
            var code=rejection.getErrorCode();
            if(code==com.bobbuy.api.response.ErrorCode.INVALID_REQUEST||code==com.bobbuy.api.response.ErrorCode.RESOURCE_NOT_FOUND
                    ||code==com.bobbuy.api.response.ErrorCode.INVALID_STATUS||code==com.bobbuy.api.response.ErrorCode.FORBIDDEN)
                throw new CostcoNumberOnboardingService.NeedsInput("onboarding.catalog_validation");
            throw rejection;
        } finally {SecurityContextHolder.setContext(previous);}
    }
    @Override @Transactional(readOnly=true) public Optional<CostcoNumberOnboardingService.CommitReceipt> reconcile(CostcoOnboardingJob job,String hash) {
        var rows=jdbc.query("select candidate_hash,product_id,product_version from bb_costco_onboarding_commit where idempotency_key=? and merchant_id=?",(rs,n)->new CostcoNumberOnboardingService.CommitReceipt(job.idempotencyKey(),rs.getString(1),rs.getString(2),rs.getLong(3),false),job.idempotencyKey(),job.merchantId());
        if(rows.isEmpty())return Optional.empty();var r=rows.get(0);
        if(!hash.equals(r.candidateHash()))throw new IllegalStateException("onboarding.idempotency_conflict");
        var current=products.findById(r.productId()).filter(p->Long.valueOf(job.merchantId()).equals(p.getMerchantId()));
        if(current.isEmpty()||current.get().getRecordVersion()==null||current.get().getRecordVersion()<r.productVersion())throw new IllegalStateException("onboarding.commit_reconciliation_required");
        return Optional.of(new CostcoNumberOnboardingService.CommitReceipt(r.idempotencyKey(),r.candidateHash(),r.productId(),r.productVersion(),true));
    }
}
