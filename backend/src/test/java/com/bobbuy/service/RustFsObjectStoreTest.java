package com.bobbuy.service;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.ResponseBytes;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.mockito.ArgumentCaptor;

/** AWS SDK calls are mocked. These tests do not establish RustFS interoperability. */
class RustFsObjectStoreTest {
 @Test void migrationInventoryListsOnlyCasPrefixAndRequiresAdvancingServerCursor(){
  var sdk=mock(S3Client.class);var adapter=new RustFsObjectStore(sdk,"bobuy-media");
  when(sdk.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(ListObjectsV2Response.builder().contents(S3Object.builder().key("blobs/v1/sha256/ab/abc").size(12L).build()).isTruncated(true).nextContinuationToken("next").build());
  var page=adapter.list("blobs/v1/sha256/",null);assertThat(page.objects()).containsExactly(new MediaObjectStore.ListedObject("blobs/v1/sha256/ab/abc",12));assertThat(page.nextToken()).isEqualTo("next");
  var capture=ArgumentCaptor.forClass(ListObjectsV2Request.class);verify(sdk).listObjectsV2(capture.capture());assertThat(capture.getValue().bucket()).isEqualTo("bobuy-media");assertThat(capture.getValue().prefix()).isEqualTo("blobs/v1/sha256/");
  assertThatThrownBy(()->adapter.list("",null)).hasMessageContaining("Only the media CAS prefix");
  when(sdk.listObjectsV2(any(ListObjectsV2Request.class))).thenReturn(ListObjectsV2Response.builder().isTruncated(true).build());assertThatThrownBy(()->adapter.list("blobs/v1/sha256/",null)).hasMessageContaining("cursor");
 }
 @Test void proposedPolicyUsesRustFsActionFamiliesAndArnResourcesWithoutBroadeningAllows() throws Exception {
  // RustFS 1.0.4 Statement::is_valid rejects mixed S3/admin families;
  // Resource::try_from requires a resource ARN, including for wildcard denies.
  var policy=new com.fasterxml.jackson.databind.ObjectMapper().readTree(java.nio.file.Path.of("../infra/rustfs/media-policy.proposed.json").toFile());
  var allows=new java.util.HashSet<String>();var denied=new java.util.HashSet<String>();
  for(var statement:policy.get("Statement")){
   var families=new java.util.HashSet<String>();
   for(var action:statement.get("Action")){
    var value=action.asText();families.add(value.split(":")[0]);
    if(statement.get("Effect").asText().equals("Allow"))allows.add(value);else denied.add(value);
   }
   assertThat(families).hasSize(1);
   for(var resource:statement.get("Resource"))assertThat(resource.asText()).startsWith("arn:aws:s3:::");
  }
  assertThat(allows).containsExactlyInAnyOrder("s3:ListBucket","s3:GetObject","s3:PutObject","s3:AbortMultipartUpload");
  assertThat(denied).contains("s3:DeleteObject","s3:DeleteBucket","admin:*");
 }
 @Test void disabledAdapterNeedsNoFilesAndRejectsInsecureEnabledEndpoint(){
  var disabled=new RustFsObjectStore(false,"","bobuy-media","missing-access","missing-secret","");
  assertThatThrownBy(()->disabled.get("test")).hasMessage("Object storage is disabled");disabled.close();
  assertThatThrownBy(()->new RustFsObjectStore(true,"http://rustfs:9000","bobuy-media","missing-access","missing-secret","")).hasMessage("RustFS configuration unavailable or invalid").hasNoCause();
 }
 @Test void simplePutStoresExactTypeAndRawHashWithoutBucketOrAclAdministration(){
  var sdk=mock(S3Client.class);var adapter=new RustFsObjectStore(sdk,"bobuy-media");byte[] bytes={1,2};adapter.put("media/v1/test",bytes,"image/png","hash");
  var request=ArgumentCaptor.forClass(PutObjectRequest.class);verify(sdk).putObject(request.capture(),any(RequestBody.class));
  assertThat(request.getValue().bucket()).isEqualTo("bobuy-media");assertThat(request.getValue().contentType()).isEqualTo("image/png");assertThat(request.getValue().metadata()).containsEntry("raw-sha256","hash");assertThat(request.getValue().acl()).isNull();
  verifyNoMoreInteractions(sdk);
 }
 @Test void multipartCompletesInOrderAndFailureAbortsWithoutLeakingProviderMessage(){
  var sdk=mock(S3Client.class);var adapter=new RustFsObjectStore(sdk,"bobuy-media");
  when(sdk.createMultipartUpload(any(CreateMultipartUploadRequest.class))).thenReturn(CreateMultipartUploadResponse.builder().uploadId("synthetic-upload").build());
  when(sdk.uploadPart(any(UploadPartRequest.class),any(RequestBody.class))).thenReturn(UploadPartResponse.builder().eTag("part").build());
  adapter.put("test",new byte[6*1024*1024],"image/jpeg","hash");var completion=ArgumentCaptor.forClass(CompleteMultipartUploadRequest.class);verify(sdk).completeMultipartUpload(completion.capture());assertThat(completion.getValue().multipartUpload().parts()).extracting(CompletedPart::partNumber).containsExactly(1,2);
  when(sdk.uploadPart(any(UploadPartRequest.class),any(RequestBody.class))).thenThrow(new IllegalStateException("SYNTHETIC_SECRET_MUST_NOT_LEAK"));
  assertThatThrownBy(()->adapter.put("test",new byte[6*1024*1024],"image/jpeg","hash")).hasMessage("Object upload did not complete").hasNoCause();verify(sdk).abortMultipartUpload(any(AbortMultipartUploadRequest.class));
 }
 @Test void readsValidateHeadLengthAndTypeBeforeReturningBytes(){
  var sdk=mock(S3Client.class);var adapter=new RustFsObjectStore(sdk,"bobuy-media");
  when(sdk.headObject(any(HeadObjectRequest.class))).thenReturn(HeadObjectResponse.builder().contentLength(2L).contentType("image/png").metadata(Map.of("raw-sha256","hash")).build());
  when(sdk.getObjectAsBytes(any(GetObjectRequest.class))).thenReturn(ResponseBytes.fromByteArray(GetObjectResponse.builder().contentType("image/png").build(),new byte[]{1,2}));
  assertThat(adapter.get("test").bytes()).containsExactly(1,2);
  when(sdk.headObject(any(HeadObjectRequest.class))).thenReturn(HeadObjectResponse.builder().contentLength(3L).contentType("image/png").build());assertThatThrownBy(()->adapter.get("test")).hasMessage("Object metadata mismatch");
 }
}
