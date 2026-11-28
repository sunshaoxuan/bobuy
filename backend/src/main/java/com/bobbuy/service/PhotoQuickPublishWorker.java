package com.bobbuy.service;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;
import java.util.concurrent.*;

@Component @ConditionalOnProperty(prefix="bobbuy.photo-quick-publish.worker",name="enabled",havingValue="true")
public class PhotoQuickPublishWorker implements SmartLifecycle {
 private final PhotoQuickPublishService service;private volatile boolean running;private ScheduledExecutorService scheduler;
 public PhotoQuickPublishWorker(PhotoQuickPublishService service){this.service=service;}
 void cycle(){if(!running)return;try{service.claim().ifPresent(service::process);}catch(RuntimeException e){org.slf4j.LoggerFactory.getLogger(getClass()).warn("quick-publish work retained",e);}}
 public synchronized void start(){if(running)return;running=true;scheduler=Executors.newSingleThreadScheduledExecutor(r->{var t=new Thread(r,"photo-quick-publish");t.setDaemon(true);return t;});scheduler.scheduleWithFixedDelay(this::cycle,1000,2000,TimeUnit.MILLISECONDS);}
 public synchronized void stop(){running=false;if(scheduler!=null)scheduler.shutdownNow();}
 public boolean isRunning(){return running;}public int getPhase(){return Integer.MAX_VALUE-100;}
}
