package com.bobbuy.service;
import com.bobbuy.model.MediaType;
import com.bobbuy.repository.JdbcCostcoOnboardingJobRepository;
import com.bobbuy.repository.ProductRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;import java.util.concurrent.*;

/** Independent consumer. It records reviewed official candidates and never changes publication or gallery data. */
@Component @ConditionalOnProperty(prefix="bobbuy.official-image-lookup.worker",name="enabled",havingValue="true")
public class OfficialImageLookupWorker implements SmartLifecycle {
 private final JdbcTemplate jdbc;private final JdbcCostcoOnboardingJobRepository jobs;private final ProductRepository products;private volatile boolean running;private ScheduledExecutorService scheduler;
 public OfficialImageLookupWorker(JdbcTemplate jdbc,JdbcCostcoOnboardingJobRepository jobs,ProductRepository products){this.jdbc=jdbc;this.jobs=jobs;this.products=products;}
 record Work(String id,String itemId,long merchant,String product,String token){}
 @Transactional Work claim(){var rows=jdbc.query("select cast(id as text),cast(item_id as text),merchant_id,product_id from bb_official_image_lookup where state in ('QUEUED','RETRY') and (lease_until is null or lease_until<current_timestamp) order by created_at,id limit 1 for update skip locked",(r,n)->new Object[]{r.getString(1),r.getString(2),r.getLong(3),r.getString(4)});if(rows.isEmpty())return null;var x=rows.get(0);String token=UUID.randomUUID().toString();jdbc.update("update bb_official_image_lookup set state='RUNNING',lease_token=cast(? as uuid),lease_until=current_timestamp+interval '5 minutes',attempts=attempts+1 where id=cast(? as uuid)",token,x[0]);return new Work((String)x[0],(String)x[1],(Long)x[2],(String)x[3],token);}
 void cycle(){if(!running)return;Work w=claim();if(w==null)return;try{lookup(w);}catch(RuntimeException e){complete(w,"NOT_FOUND",null,null,null,"official_image.unavailable");}}
 void lookup(Work w){var product=products.findById(w.product()).filter(p->Long.valueOf(w.merchant()).equals(p.getMerchantId())).orElseThrow();if(product.getMediaGallery().stream().anyMatch(m->m.isVisible()&&m.getType()==MediaType.IMAGE)){complete(w,"EXISTING_IMAGE",null,null,null,null);return;}String job=jdbc.queryForObject("select onboarding_job_id from bb_photo_publish_item where id=cast(? as uuid)",String.class,w.itemId());var value=jobs.findOwned(job,w.merchant()).orElseThrow();var candidate=value.decisions().stream().filter(d->d.candidate()!=null).reduce((a,b)->b).map(CostcoOnboardingDecision::candidate).orElse(null);if(candidate==null||candidate.officialImageSha256()==null){complete(w,"NOT_FOUND",null,null,null,"official_image.not_found");return;}var source=value.evidence().stream().filter(e->candidate.officialImageSha256().equals(e.sha256())&&e.mediaType().startsWith("image/")).findFirst().orElse(null);if(source==null){complete(w,"NOT_FOUND",null,null,null,"official_image.not_verified");return;}complete(w,"CANDIDATE",source.canonicalUrl().toString(),source.canonicalUrl().toString(),"verified item number, market and package evidence",null);}
 void complete(Work w,String state,String candidate,String page,String basis,String issue){jdbc.update("update bb_official_image_lookup set state=?,candidate_url=?,source_page=?,match_basis=?,issue_code=?,lease_token=null,lease_until=null,updated_at=current_timestamp where id=cast(? as uuid) and lease_token=cast(? as uuid)",state,candidate,page,basis,issue,w.id(),w.token());}
 public synchronized void start(){if(running)return;running=true;scheduler=Executors.newSingleThreadScheduledExecutor(r->{var t=new Thread(r,"official-image-lookup");t.setDaemon(true);return t;});scheduler.scheduleWithFixedDelay(this::cycle,2000,5000,TimeUnit.MILLISECONDS);}public synchronized void stop(){running=false;if(scheduler!=null)scheduler.shutdownNow();}public boolean isRunning(){return running;}public int getPhase(){return Integer.MAX_VALUE-90;}
}
