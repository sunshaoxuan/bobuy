package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.MerchantScope;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/** Private observations only: does not call sale, stock, publication or catalog auto-commit APIs. */
@Service
public class ProductPhotoIntakeService {
    public record Match(String id,Long version,Map<String,String> name,Map<String,String> specification,String packaging,boolean eligible) {}
    public record Observation(String id,String productId,String supplierId,String market,BigDecimal amount,String currency,String unit,String conditions,
        boolean inStock,boolean priceChanged,Instant observedAt,Instant confirmedAt) {}
    public record Review(String jobId,long revision,String supplierId,String market,String itemNumber,String status,
        CostcoOnboardingDecision.Candidate candidate,CostcoOnboardingDecision.PhotoFacts photoFacts,List<Match> matches,
        List<Observation> history,Observation saved,List<CostcoOfficialEvidence> sources,boolean officialImageAvailable,CostcoOnboardingDecision.ArchiveDetails archiveDetails) {}
    public record Confirm(long revision,String itemNumber,String productId,Long productVersion,String previousId,
        boolean identityConfirmed,boolean priceConfirmed,BigDecimal amount,String currency,String unit,String conditions,
        boolean inStock,Instant observedAt,ManualProductCreationService.Input product,String model,String packaging,boolean useOfficialImage) {}
    private final JdbcCostcoOnboardingJobRepository jobs;
    private final ProductRepository products;private final SupplierRepository suppliers;private final UserRepository users;
    private final CurrencyRepository currencies;private final ManualProductCreationService creation;
    private final JdbcTemplate jdbc;private final ObjectMapper mapper;private final ProductCatalogService catalog;private final CostcoEvidencePersistence evidence;
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entities;
    public ProductPhotoIntakeService(JdbcCostcoOnboardingJobRepository jobs,ProductRepository products,SupplierRepository suppliers,
        UserRepository users,CurrencyRepository currencies,ManualProductCreationService creation,JdbcTemplate jdbc,ObjectMapper mapper,ProductCatalogService catalog,CostcoEvidencePersistence evidence){
        this.jobs=jobs;this.products=products;this.suppliers=suppliers;this.users=users;this.currencies=currencies;this.creation=creation;this.jdbc=jdbc;this.mapper=mapper;this.catalog=catalog;this.evidence=evidence;
    }
    private static ApiException invalid(String key){return new ApiException(ErrorCode.INVALID_REQUEST,key);}
    private static ApiException conflict(){return new ApiException(ErrorCode.INVALID_STATUS,"photo.conflict");}
    private long owner(){Long owner=MerchantScope.current();if(owner==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");return owner;}
    private CostcoOnboardingJob job(String id,long owner){
        var j=jobs.findOwned(id,owner).filter(x->x.privatePhotoSha256()!=null).orElseThrow(()->new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"onboarding.not_found"));
        if(suppliers.findById(j.supplierId()).filter(s->Long.valueOf(owner).equals(s.getMerchantId())).isEmpty())throw new ApiException(ErrorCode.FORBIDDEN,"onboarding.supplier_not_found");return j;
    }
    private boolean eligible(Product p,CostcoOnboardingJob j){return p.getCatalogData()!=null&&j.supplierId().equals(p.getCatalogData().supplierId())&&j.market().equals(p.getAttributes().get("sourceMarket"));}
    private List<Product> candidates(CostcoOnboardingJob j,String item){return products.findAllByMerchantIdAndItemNumber(j.merchantId(),item).stream().filter(p->p.getCatalogData()==null||p.getCatalogData().supplierId()==null||p.getAttributes().get("sourceMarket")==null||eligible(p,j)).toList();}
    private String json(Object value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
    private Observation parse(String value){try{return mapper.readValue(value,Observation.class);}catch(Exception e){throw new IllegalStateException(e);}}
    private List<Observation> history(long owner,String product,String supplier,String market){return jdbc.query("select cast(receipt as text) from bb_product_photo_observation where merchant_id=? and product_id=? and supplier_id=? and market=? order by confirmed_at desc,id desc limit 50",(r,n)->parse(r.getString(1)),owner,product,supplier,market);}
    private Observation saved(String job,long owner){return jdbc.query("select cast(receipt as text) from bb_product_photo_observation where job_id=? and merchant_id=?",(r,n)->parse(r.getString(1)),job,owner).stream().findFirst().orElse(null);}
    @Transactional(readOnly=true) public Review review(String id,String corrected){
        long owner=owner();var j=job(id,owner);String item=corrected==null?j.itemNumber():CostcoNumberOnboardingService.normalizeItemNumber(corrected);
        var matches=item==null?List.<Product>of():candidates(j,item);
        String status=item==null?"IDENTITY_REQUIRED":products.deletedCodeCount(owner,item)>0?"DELETED":matches.isEmpty()?"NEW":matches.size()==1&&eligible(matches.get(0),j)?"MATCH":"SELECT";
        var candidate=j.decisions().stream().map(CostcoOnboardingDecision::candidate).filter(Objects::nonNull)
                .filter(c->item==null||item.equals(c.itemNumber())).reduce((a,b)->b).orElse(null);
        // Photo prices always come from the intake pixels, never a later online-source suggestion.
        var facts=j.decisions().stream().filter(d->d.stage()==CostcoOnboardingDecision.Stage.INTAKE&&d.candidate()!=null).map(d->d.candidate().photoFacts()).filter(Objects::nonNull).findFirst().orElse(null);
        return new Review(id,j.revision(),j.supplierId(),j.market(),item,status,candidate,facts,matches.stream().map(p->new Match(p.getId(),p.getRecordVersion(),p.getName(),p.getCatalogData()==null?Map.of():p.getCatalogData().specification(),p.getCatalogData()==null?null:p.getCatalogData().packaging(),eligible(p,j))).toList(),matches.stream().flatMap(p->history(owner,p.getId(),j.supplierId(),j.market()).stream()).toList(),saved(id,owner),j.evidence(),officialSource(j,item).isPresent(),archiveDetails(j,item));
    }
    private CostcoOnboardingDecision.ArchiveDetails archiveDetails(CostcoOnboardingJob job,String item){
        if(item==null||!item.equals(job.itemNumber()))return null;
        return job.decisions().stream().filter(d->d.stage()==CostcoOnboardingDecision.Stage.INTAKE
                        ||d.stage()==CostcoOnboardingDecision.Stage.FACTS&&d.verdict()==CostcoOnboardingDecision.Verdict.ACCEPT)
                .map(CostcoOnboardingDecision::candidate).filter(c->c!=null&&item.equals(c.itemNumber()))
                .map(CostcoOnboardingDecision.Candidate::archiveDetails).filter(Objects::nonNull)
                .reduce((photo,official)->new CostcoOnboardingDecision.ArchiveDetails(
                        official.descriptionJa()!=null?official.descriptionJa():photo.descriptionJa(),
                        official.categoryNodeId()!=null?official.categoryNodeId():photo.categoryNodeId(),
                        official.storageCondition()!=null?official.storageCondition():photo.storageCondition()))
                .orElse(null);
    }
    private Optional<CostcoOfficialEvidence> officialSource(CostcoOnboardingJob j,String item){
        if(item==null||!item.equals(j.itemNumber()))return Optional.empty();
        var candidate=j.decisions().stream().filter(d->d.candidate()!=null).reduce((a,b)->b).map(CostcoOnboardingDecision::candidate).orElse(null);
        if(candidate==null||!item.equals(candidate.itemNumber())||candidate.officialImageSha256()==null||candidate.officialImageSha256().equals(j.privatePhotoSha256()))return Optional.empty();
        String hash=candidate.officialImageSha256();
        boolean viewed=j.decisions().stream().anyMatch(d->d.stage()==CostcoOnboardingDecision.Stage.IMAGE_SOURCE&&d.verdict()==CostcoOnboardingDecision.Verdict.ACCEPT&&d.trace()!=null&&d.trace().imageViewHashes().containsKey(hash));
        if(!viewed)return Optional.empty();
        return j.evidence().stream().filter(e->hash.equals(e.sha256())&&e.mediaType().startsWith("image/")&&e.canonicalUrl().getRawQuery()==null&&e.canonicalUrl().getRawFragment()==null&&e.canonicalUrl().getUserInfo()==null).findFirst();
    }
    @Transactional(readOnly=true) public RecommendationImageValidator.Image officialImage(String id){
        long owner=owner();var j=job(id,owner);var source=officialSource(j,j.itemNumber()).orElseThrow(()->invalid("photo.official_unavailable"));
        return RecommendationImageValidator.validate(evidence.readVerified(owner,source.sha256()));
    }
    @Transactional(readOnly=true) public List<Observation> productHistory(String product){long owner=owner();if(!products.existsByIdAndMerchantId(product,owner))throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"product.not_found");return jdbc.query("select cast(receipt as text) from bb_product_photo_observation where merchant_id=? and product_id=? order by confirmed_at desc,id desc limit 50",(r,n)->parse(r.getString(1)),owner,product);}
    @Transactional public Observation confirm(String id,Confirm input){
        long owner=owner();users.lockById(owner).filter(u->u.isEnabled()&&u.getRoles().contains(Role.AGENT)).orElseThrow(()->new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden"));
        // Serialize with worker transitions as well as concurrent confirmations.
        jdbc.queryForList("select id from bb_costco_onboarding_job where id=? and merchant_id=? for update",id,owner);
        var j=job(id,owner);String hash=CostcoEvidencePersistence.hash(json(input).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var hashes=jdbc.queryForList("select request_hash from bb_product_photo_observation where job_id=? and merchant_id=?",String.class,id,owner);
        if(!hashes.isEmpty()){if(!hashes.get(0).equals(hash))throw conflict();return saved(id,owner);}
        if(input==null||!input.identityConfirmed()||j.revision()!=input.revision()||!Set.of(CostcoOnboardingJob.State.NEEDS_INPUT,CostcoOnboardingJob.State.FAILED).contains(j.state()))throw conflict();
        String item=CostcoNumberOnboardingService.normalizeItemNumber(input.itemNumber());
        if(products.deletedCodeCount(owner,item)>0)throw invalid("photo.deleted");
        if(input.observedAt()==null||input.observedAt().isAfter(Instant.now().plusSeconds(60))||input.observedAt().isBefore(Instant.now().minusSeconds(86400*30L)))throw invalid("photo.observed_invalid");
        validatePrice(input);
        var matches=candidates(j,item);Product p;
        if(input.productId()!=null){
            p=products.lockById(input.productId()).orElseThrow(ProductPhotoIntakeService::conflict);entities.refresh(p,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            if(!Long.valueOf(owner).equals(p.getMerchantId())||!item.equals(p.getItemNumber())||!eligible(p,j)||!Objects.equals(input.productVersion(),p.getRecordVersion()))throw conflict();
            if(matches.stream().noneMatch(m->m.getId().equals(input.productId())))throw conflict();
        }else{
            if(!matches.isEmpty()||input.product()==null)throw conflict();
            var source=input.useOfficialImage()?officialSource(j,item).orElseThrow(()->invalid("photo.official_unavailable")):null;
            var n=input.product();
            // Bind create identity to this durable job; never trust an AI/client ID or selling-price field.
            if(n.priceTiers()!=null&&!n.priceTiers().isEmpty()||n.mediaGallery()!=null&&!n.mediaGallery().isEmpty())throw invalid("photo.private_evidence");
            p=creation.createPhoto(new ManualProductCreationService.Input(UUID.fromString(j.id()),n.name(),n.description(),n.specification(),item,n.brand(),n.categoryNodeId(),Map.of(),Map.of(),List.of(),n.storageCondition(),OrderMethod.PRE_ORDER,List.of()),j.supplierId(),j.market());
            if(!Long.valueOf(owner).equals(p.getMerchantId())||!item.equals(p.getItemNumber())||!eligible(p,j))throw conflict();
            if(input.model()!=null&&input.model().length()>200||input.packaging()!=null&&input.packaging().length()>1000)throw invalid("master.invalid");
            var data=p.getCatalogData();p.setCatalogData(new ProductCatalogData(data.specification(),input.model(),input.packaging(),data.categoryIds(),data.supplierId(),null,null,null));products.saveAndFlush(p);
            if(source!=null){
                var media=catalog.upload(p.getId(),RecommendationImageValidator.validate(evidence.readVerified(owner,source.sha256())),source.canonicalUrl().toString(),p.getName().get("ja-JP"),true);
                var current=catalog.get(p.getId()).value();
                catalog.save(List.of(new ProductCatalogService.Input(p.getId(),current.version(),current.name(),current.description(),current.itemNumber(),current.brand(),current.specification(),current.model(),current.packaging(),current.categoryIds(),current.supplierId(),List.of(media),false)),true);
            }
        }
        var history=history(owner,p.getId(),j.supplierId(),j.market());
        if(!Objects.equals(input.previousId(),history.isEmpty()?null:history.get(0).id()))throw conflict();
        var previous=history.stream().filter(o->o.amount()!=null&&Objects.equals(o.currency(),input.currency())&&Objects.equals(o.unit(),input.unit())).findFirst().orElse(null);
        boolean changed=input.amount()!=null&&(previous==null||previous.amount().compareTo(input.amount())!=0||!Objects.equals(previous.conditions(),input.conditions()));
        var result=new Observation(UUID.randomUUID().toString(),p.getId(),j.supplierId(),j.market(),input.amount(),input.amount()==null?null:input.currency(),input.amount()==null?null:input.unit(),input.conditions(),input.inStock(),changed,input.observedAt(),Instant.now());
        jdbc.update("insert into bb_product_photo_observation(id,job_id,merchant_id,supplier_id,market,product_id,request_hash,amount,currency,unit,conditions,in_stock,price_changed,observed_at,confirmed_at,photo_sha256,receipt) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,cast(? as jsonb))",result.id(),j.id(),owner,j.supplierId(),j.market(),p.getId(),hash,result.amount(),result.currency(),result.unit(),result.conditions(),result.inStock(),changed,java.sql.Timestamp.from(result.observedAt()),java.sql.Timestamp.from(result.confirmedAt()),j.privatePhotoSha256(),json(result));
        return saved(id,owner);
    }
    void validatePrice(Confirm input){
        if(input.conditions()!=null&&input.conditions().length()>1000)throw invalid("photo.price_invalid");
        if(input.amount()==null){if(!input.inStock())throw invalid("photo.observation_required");return;}
        if(!input.priceConfirmed()||input.currency()==null||input.unit()==null||input.unit().isBlank()||input.unit().length()>100)throw invalid("photo.price_invalid");
        var currency=currencies.findById(input.currency()).orElseThrow(()->invalid("photo.price_invalid"));
        if(input.amount().signum()<=0||input.amount().compareTo(new BigDecimal("1000000000"))>0||input.amount().stripTrailingZeros().scale()>Math.min(4,currency.fractionDigits))throw invalid("photo.price_invalid");
    }
}
