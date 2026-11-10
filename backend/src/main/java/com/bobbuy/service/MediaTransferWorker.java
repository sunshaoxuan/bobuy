package com.bobbuy.service;
import org.springframework.stereotype.Service;
import java.util.Objects;

/** One durable leased transfer. Scheduling and migration activation are explicit and separate. */
@Service
public class MediaTransferWorker {
 private final MediaBinaryService binaries;private final MediaObjectStore objects;
 public MediaTransferWorker(MediaBinaryService binaries,MediaObjectStore objects){this.binaries=binaries;this.objects=objects;}
 public boolean transferOne(){
  var claim=binaries.claim();if(claim==null)return false;boolean verified=false;
  try{
   MediaObjectStore.ObjectData copied;
   try{copied=objects.get(claim.key());}catch(MediaObjectStore.Missing missing){objects.put(claim.key(),claim.bytes(),claim.type(),claim.sha256());copied=objects.get(claim.key());}
   verified=copied.bytes().length==claim.bytes().length&&MediaBinaryService.sha(copied.bytes()).equals(claim.sha256())&&Objects.equals(copied.contentType(),claim.type())&&claim.sha256().equals(copied.metadata().get("raw-sha256"));
  }catch(RuntimeException ignored){/* persist a generic retry state, never external exception/secret text */}
  binaries.finish(claim,verified);return true;
 }
}
