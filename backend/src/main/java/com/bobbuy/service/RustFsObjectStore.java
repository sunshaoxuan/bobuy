package com.bobbuy.service;

import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import java.net.URI;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;

/** Disabled until explicitly configured. Uses dedicated file credentials, no ambient AWS chain. */
@Service
public class RustFsObjectStore implements MediaObjectStore {
 private final S3Client client;private final String bucket;
 RustFsObjectStore(S3Client client,String bucket){this.client=client;this.bucket=bucket;}
 @org.springframework.beans.factory.annotation.Autowired
 public RustFsObjectStore(@Value("${bobbuy.media.rustfs.enabled:false}") boolean enabled,
  @Value("${bobbuy.media.rustfs.endpoint:}") String endpoint,@Value("${bobbuy.media.rustfs.bucket:bobuy-media}") String bucket,
  @Value("${bobbuy.media.rustfs.access-key-file:}") String accessFile,@Value("${bobbuy.media.rustfs.secret-key-file:}") String secretFile,
  @Value("${bobbuy.media.rustfs.ca-file:}") String caFile){
  this.bucket=bucket;
  if(!enabled){client=null;return;}
  try{
   var uri=URI.create(endpoint);if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null)throw new IllegalArgumentException();
   String access=Files.readString(Path.of(accessFile)).trim(),secret=Files.readString(Path.of(secretFile)).trim();
   if(access.isBlank()||secret.isBlank()||access.equals("rustfsadmin")||secret.equals("rustfsadmin"))throw new IllegalArgumentException();
   var http=UrlConnectionHttpClient.builder().connectionTimeout(Duration.ofSeconds(3)).socketTimeout(Duration.ofSeconds(10));
   if(!caFile.isBlank()){var managers=trustManagers(Path.of(caFile));http.tlsTrustManagersProvider(()->managers);}
   client=S3Client.builder().endpointOverride(uri).region(Region.US_EAST_1).forcePathStyle(true)
    .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(access,secret)))
    .httpClientBuilder(http)
    .overrideConfiguration(c->c.apiCallTimeout(Duration.ofSeconds(30)).apiCallAttemptTimeout(Duration.ofSeconds(12))).build();
  }catch(Exception error){throw new IllegalStateException("RustFS configuration unavailable or invalid");}
 }
 static javax.net.ssl.TrustManager[] trustManagers(Path path)throws Exception{
  var store=java.security.KeyStore.getInstance(java.security.KeyStore.getDefaultType());store.load(null,null);
  try(var input=Files.newInputStream(path)){var certs=java.security.cert.CertificateFactory.getInstance("X.509").generateCertificates(input);if(certs.isEmpty())throw new IllegalArgumentException();int n=0;for(var cert:certs){((java.security.cert.X509Certificate)cert).checkValidity();store.setCertificateEntry("rustfs-ca-"+n++,cert);}}
  var factory=javax.net.ssl.TrustManagerFactory.getInstance(javax.net.ssl.TrustManagerFactory.getDefaultAlgorithm());factory.init(store);return factory.getTrustManagers();
 }
 private S3Client client(){if(client==null)throw new IllegalStateException("Object storage is disabled");return client;}
 @Override public void put(String key,byte[] bytes,String type,String hash){
  var s3=client();var metadata=Map.of("raw-sha256",hash);
  if(bytes.length<=5*1024*1024){s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType(type).metadata(metadata).build(),RequestBody.fromBytes(bytes));return;}
  String upload=s3.createMultipartUpload(CreateMultipartUploadRequest.builder().bucket(bucket).key(key).contentType(type).metadata(metadata).build()).uploadId();
  try{
   var parts=new ArrayList<CompletedPart>();int size=5*1024*1024;
   for(int offset=0,number=1;offset<bytes.length;offset+=size,number++){
    var result=s3.uploadPart(UploadPartRequest.builder().bucket(bucket).key(key).uploadId(upload).partNumber(number).build(),RequestBody.fromBytes(Arrays.copyOfRange(bytes,offset,Math.min(offset+size,bytes.length))));
    parts.add(CompletedPart.builder().partNumber(number).eTag(result.eTag()).build());
   }
   s3.completeMultipartUpload(CompleteMultipartUploadRequest.builder().bucket(bucket).key(key).uploadId(upload).multipartUpload(CompletedMultipartUpload.builder().parts(parts).build()).build());
  }catch(RuntimeException error){
   try{s3.abortMultipartUpload(AbortMultipartUploadRequest.builder().bucket(bucket).key(key).uploadId(upload).build());}catch(RuntimeException ignored){/* retry uses the immutable key; stale multipart can be inspected separately */}
   throw new IllegalStateException("Object upload did not complete");
  }
 }
 @Override public ObjectData get(String key){
  var s3=client();HeadObjectResponse head;
  try{head=s3.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build());}catch(S3Exception error){if(error.statusCode()==404)throw new MediaObjectStore.Missing();throw new IllegalStateException("Object metadata read failed");}
  if(head.contentLength()==null||head.contentLength()<=0||head.contentLength()>RecommendationImageValidator.MAX_BYTES)throw new IllegalStateException("Object size is invalid");
  var result=s3.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build());
  if(head.contentLength()!=result.asByteArray().length||!Objects.equals(head.contentType(),result.response().contentType()))throw new IllegalStateException("Object metadata mismatch");
  return new ObjectData(result.asByteArray(),head.contentType(),head.metadata());
 }
 @PreDestroy public void close(){if(client!=null)client.close();}
}
