package com.bobbuy.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class MediaGalleryCompatibilityTest {
 @Test void retainsLegacyOptionalHashAndSourceMetadataOnRoundTrip()throws Exception{
  var mapper=new ObjectMapper();
  var media=mapper.readValue("{\"url\":\"/synthetic.png\",\"type\":\"IMAGE\",\"visible\":true,\"sha256\":\"legacy-fixture-hash\",\"sourceDomain\":\"example.invalid\",\"title\":{\"en-US\":\"Synthetic\"}}",MediaGalleryItem.class);
  assertThat(media.getSha256()).isEqualTo("legacy-fixture-hash");assertThat(media.getSourceDomain()).isEqualTo("example.invalid");
  var restored=mapper.readValue(mapper.writeValueAsBytes(media),MediaGalleryItem.class);
  assertThat(restored.getSha256()).isEqualTo(media.getSha256());assertThat(restored.getTitle()).containsEntry("en-US","Synthetic");
 }
}
