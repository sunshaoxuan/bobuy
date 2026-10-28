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
