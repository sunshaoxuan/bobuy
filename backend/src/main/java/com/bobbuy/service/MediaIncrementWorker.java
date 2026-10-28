package com.bobbuy.service;

import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Explicitly activated, bounded outbox drain. Durable leases survive process loss.
 * Never scans business data at startup, creates security assets or deletes objects. */
@Component
@ConditionalOnProperty(prefix="bobbuy.media",name={"worker.enabled","rustfs.enabled"},havingValue="true")
public class MediaIncrementWorker implements SmartLifecycle {
 private final MediaTransferWorker worker;private final long delayMillis;private final int batch;
 private final AtomicBoolean busy=new AtomicBoolean();private volatile boolean running;private ScheduledExecutorService scheduler;
 public MediaIncrementWorker(MediaTransferWorker worker,@Value("${bobbuy.media.worker.delay-millis:5000}")long delayMillis,@Value("${bobbuy.media.worker.batch:10}")int batch){
  if(delayMillis<1000||delayMillis>60000||batch<1||batch>100)throw new IllegalArgumentException("Invalid media worker bounds");this.worker=worker;this.delayMillis=delayMillis;this.batch=batch;
 }
 void runCycle(){
  if(!running||!busy.compareAndSet(false,true))return;
  try{for(int i=0;i<batch&&running;i++)if(!worker.transferOne())break;}
  catch(RuntimeException failure){LoggerFactory.getLogger(MediaIncrementWorker.class).warn("Media outbox cycle failed; durable work retained for retry");}
  finally{busy.set(false);}
 }
 @Override public synchronized void start(){if(running)return;running=true;scheduler=Executors.newSingleThreadScheduledExecutor(task->{var thread=new Thread(task,"media-outbox");thread.setDaemon(true);return thread;});scheduler.scheduleWithFixedDelay(this::runCycle,delayMillis,delayMillis,TimeUnit.MILLISECONDS);}
 @Override public synchronized void stop(){running=false;if(scheduler==null)return;scheduler.shutdown();try{if(!scheduler.awaitTermination(35,TimeUnit.SECONDS))scheduler.shutdownNow();}catch(InterruptedException interrupted){scheduler.shutdownNow();Thread.currentThread().interrupt();}finally{scheduler=null;}}
 @Override public boolean isRunning(){return running;}
 @Override public int getPhase(){return Integer.MAX_VALUE-100;}
}
