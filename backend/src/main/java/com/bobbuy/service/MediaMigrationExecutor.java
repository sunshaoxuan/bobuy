package com.bobbuy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import javax.sql.DataSource;
import java.nio.file.*;
import java.nio.channels.FileChannel;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.time.Instant;

/** Explicit operator operation only: never scheduled or exposed through a business API. */
@Service
public class MediaMigrationExecutor {
 public enum Mode {DRY_RUN,TRANSFER,VERIFY}
 public record Options(Mode mode,Path checkpoint,Path report,int batch,int maxPages,int maxTransfers,int workers,int seconds,String targetIdentity){
  public Options{if(mode==null||report==null||batch<1||batch>100||maxPages<1||maxPages>100000||maxTransfers<1||maxTransfers>1000000||workers<1||workers>4||seconds<1||seconds>3600||targetIdentity==null||targetIdentity.isBlank()||(mode==Mode.TRANSFER&&checkpoint==null))throw new IllegalArgumentException("Invalid migration options");}
 }
 public record Checkpoint(int format,String sourceIdentity,String targetIdentity,String after,boolean scanComplete,long attempts){}
 public record Result(String status,boolean readOnly,boolean sourceBytesRetained,boolean scanComplete,int transfersAttempted,String checkpointAfter,MediaMigrationAudit.Summary audit,String at){}
 private final DataSource data;private final MediaBinaryService binaries;private final MediaTransferWorker worker;private final MediaObjectStore objects;
 private final ObjectMapper json=new ObjectMapper();
 public MediaMigrationExecutor(DataSource data,MediaBinaryService binaries,MediaTransferWorker worker,MediaObjectStore objects){this.data=data;this.binaries=binaries;this.worker=worker;this.objects=objects;}
 public Result run(Options options)throws Exception{
  Path report=options.report().toAbsolutePath().normalize();
  if(options.checkpoint()!=null){Path checkpoint=options.checkpoint().toAbsolutePath().normalize();if(checkpoint.equals(report)||checkpoint.resolveSibling(checkpoint.getFileName()+".lock").equals(report))throw new IllegalArgumentException("Report must differ from checkpoint and lock");}
  safe(report);if(Files.exists(report)){var prior=json.readTree(Files.readAllBytes(report));if(!prior.has("status")||!prior.path("sourceBytesRetained").asBoolean())throw new IllegalArgumentException("Refusing to overwrite an unrelated report file");}
  if(options.mode()==Mode.TRANSFER){Path checkpoint=options.checkpoint().toAbsolutePath().normalize();safe(checkpoint);Path lockPath=checkpoint.resolveSibling(checkpoint.getFileName()+".lock");safe(lockPath);
   try(var channel=FileChannel.open(lockPath,StandardOpenOption.CREATE,StandardOpenOption.WRITE);var lock=channel.tryLock()){if(lock==null)throw new IllegalStateException("This checkpoint is already in use");return withReport(options,report);}
  }
  return withReport(options,report);
 }
 private Result withReport(Options options,Path report)throws Exception{
  write(report,Map.of("status","RUNNING","sourceBytesRetained",true,"readOnly",options.mode()!=Mode.TRANSFER));
  try{return execute(options);}catch(Exception failure){write(report,Map.of("status","STOPPED","sourceBytesRetained",true,"readOnly",options.mode()!=Mode.TRANSFER,"errorType",failure.getClass().getSimpleName()));throw failure;}
 }
 private Result execute(Options options)throws Exception{
  long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(options.seconds());var audit=new MediaMigrationAudit(data,objects);
  if(options.mode()!=Mode.TRANSFER){var summary=audit.inspect(options.mode()==Mode.VERIFY,deadline);var result=new Result(options.mode()==Mode.DRY_RUN?"DRY_RUN":summary.complete()?"VERIFIED":"INCOMPLETE",true,true,false,0,null,summary,Instant.now().toString());write(options.report(),result);return result;}
  if(objects instanceof RustFsObjectStore store&&!store.enabled())throw new IllegalStateException("Object adapter must be explicitly enabled for transfer");
  var checkpoint=options.checkpoint().toAbsolutePath().normalize();safe(checkpoint);safe(options.report());
  if(checkpoint.equals(options.report().toAbsolutePath().normalize()))throw new IllegalArgumentException("Checkpoint and report must differ");
  {
   String identity=audit.identity();Checkpoint state=Files.exists(checkpoint)?json.readValue(Files.readAllBytes(checkpoint),Checkpoint.class):new Checkpoint(1,identity,options.targetIdentity(),"",false,0);
   if(state.format()!=1||!identity.equals(state.sourceIdentity())||!options.targetIdentity().equals(state.targetIdentity()))throw new IllegalStateException("Checkpoint belongs to another source or object target");
   // A new run can rescan safely; an existing run resumes only its exact database/target.
   for(int page=0;!state.scanComplete()&&page<options.maxPages()&&System.nanoTime()<deadline;page++){
    String next=binaries.backfillPage(state.after(),options.batch());state=new Checkpoint(1,identity,options.targetIdentity(),next==null?state.after():next,next==null,state.attempts());write(checkpoint,state);
   }
   int attempted=0;
   if(System.nanoTime()<deadline){
    var slots=new AtomicInteger();var finished=new AtomicInteger();var pool=Executors.newFixedThreadPool(options.workers());
    try{
     var jobs=new ArrayList<Future<?>>();for(int i=0;i<options.workers();i++)jobs.add(pool.submit(()->{while(System.nanoTime()<deadline&&slots.getAndIncrement()<options.maxTransfers()){if(!worker.transferOne())break;finished.incrementAndGet();}}));
     for(var job:jobs)job.get();attempted=finished.get();
    }finally{pool.shutdown();if(!pool.awaitTermination(35,TimeUnit.SECONDS))pool.shutdownNow();}
   }
   state=new Checkpoint(1,identity,options.targetIdentity(),state.after(),state.scanComplete(),state.attempts()+attempted);write(checkpoint,state);
   // Bounded partial runs do not waste a full remote audit of unscanned source rows.
   var inventory=audit.inspect(false,deadline);boolean verify=state.scanComplete()&&inventory.pendingRows()==0&&inventory.boundRows()==inventory.mediaRows()&&inventory.metadataErrors()==0;
   var summary=verify?audit.inspect(true,deadline):inventory;
   String status=verify&&summary.complete()?"VERIFIED":"INCOMPLETE";
   var result=new Result(status,false,true,state.scanComplete(),attempted,state.after(),summary,Instant.now().toString());write(options.report(),result);return result;
  }
 }
 private static void safe(Path path)throws Exception{
  path=path.toAbsolutePath().normalize();if(path.getParent()==null||!Files.isDirectory(path.getParent()))throw new IllegalArgumentException("Migration output parent must already exist");
  for(Path part=path;part!=null;part=part.getParent())if(Files.isSymbolicLink(part))throw new IllegalArgumentException("Migration state cannot use symbolic links");
 }
 private void write(Path destination,Object value)throws Exception{
  destination=destination.toAbsolutePath().normalize();safe(destination);Path temp=Files.createTempFile(destination.getParent(),".media-migration-",".tmp");
  try{try{Files.setPosixFilePermissions(temp,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));}catch(UnsupportedOperationException ignored){/* metadata-only files inherit the operator's approved directory ACL on Windows */}
   Files.write(temp,json.writerWithDefaultPrettyPrinter().writeValueAsBytes(value),StandardOpenOption.TRUNCATE_EXISTING);try(var channel=FileChannel.open(temp,StandardOpenOption.WRITE)){channel.force(true);}Files.move(temp,destination,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
  }finally{Files.deleteIfExists(temp);}
 }
}
