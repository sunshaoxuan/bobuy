package com.bobbuy.service;

import com.bobbuy.repository.CostcoOnboardingJobRepository;
import com.bobbuy.repository.UserRepository;
import com.bobbuy.repository.SupplierRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Same bounded SmartLifecycle pattern as MediaIncrementWorker; durable claims, one active task. */
@Component
@ConditionalOnProperty(prefix="bobbuy.ai.costco.worker", name="enabled", havingValue="true")
public class CostcoOnboardingWorker implements SmartLifecycle {
    private final CostcoOnboardingJobRepository jobs; private final CostcoNumberOnboardingService service;
    private final long delay; private final AtomicBoolean busy=new AtomicBoolean();
    private final UserRepository users;private final SupplierRepository suppliers;
    private volatile boolean running; private ScheduledExecutorService scheduler;
    public CostcoOnboardingWorker(CostcoOnboardingJobRepository jobs, CostcoNumberOnboardingService service,UserRepository users,SupplierRepository suppliers,
            @Value("${bobbuy.ai.costco.worker.delay-millis:5000}") long delay) {
        if(delay<1000||delay>60000)throw new IllegalArgumentException("onboarding.worker_bounds");this.jobs=jobs;this.service=service;this.users=users;this.suppliers=suppliers;this.delay=delay;
    }
    void cycle() {
        if(!running||!busy.compareAndSet(false,true))return;
        try { jobs.claimNext(Instant.now()).ifPresent(lease->{
            try { jobs.withLease(lease,()->{
                if(users.findById(lease.job().merchantId()).filter(u->u.isEnabled()&&u.getRoles().contains(com.bobbuy.model.Role.AGENT)).isEmpty()
                        ||suppliers.findById(lease.job().supplierId()).filter(s->Long.valueOf(lease.job().merchantId()).equals(s.getMerchantId())).isEmpty()) {
                    var old=lease.job();var next=new com.bobbuy.model.CostcoOnboardingJob(old.id(),old.idempotencyKey(),old.merchantId(),old.supplierId(),old.market(),old.inputHash(),old.itemNumber(),old.privatePhotoSha256(),old.revision()+1,
                            com.bobbuy.model.CostcoOnboardingJob.State.NEEDS_INPUT,old.evidence(),old.decisions(),null,null,"error.auth.forbidden",Instant.now());
                    jobs.compareAndSet(old,next);return next;
                }
                return lease.job().state()==com.bobbuy.model.CostcoOnboardingJob.State.COMMITTING
                    ?service.reconcile(lease.job().id(),lease.job().merchantId(),lease.job().revision())
                    :service.execute(lease.job().id(),lease.job().merchantId(),lease.job().revision());}); }
            catch(RuntimeException e) { org.slf4j.LoggerFactory.getLogger(getClass()).warn("Costco job retained for bounded retry/reconciliation: {}",lease.job().id()); }
            finally { jobs.release(lease); }
        }); } catch(RuntimeException e){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Costco queue cycle failed; durable work retained");} finally { busy.set(false); }
    }
    @Override public synchronized void start(){if(running)return;running=true;scheduler=Executors.newSingleThreadScheduledExecutor(r->{var t=new Thread(r,"costco-onboarding");t.setDaemon(true);return t;});scheduler.scheduleWithFixedDelay(this::cycle,delay,delay,TimeUnit.MILLISECONDS);}
    @Override public synchronized void stop(){running=false;if(scheduler!=null){scheduler.shutdown();try{if(!scheduler.awaitTermination(35,TimeUnit.SECONDS))scheduler.shutdownNow();}catch(InterruptedException e){scheduler.shutdownNow();Thread.currentThread().interrupt();}}}
    @Override public boolean isRunning(){return running;}
    @Override public int getPhase(){return Integer.MAX_VALUE-110;}
}
