package com.bobbuy.livecart;

import com.bobbuy.api.response.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;

class CartAudioTranscriptionServiceTest {
    private final AudioTranscriptionProvider mock = new AudioTranscriptionProvider() {
        public String id(){return "contract-mock";}
        public Set<String> supportedMimeTypes(){return Set.of("audio/webm","audio/mp4");}
        public String transcribe(byte[] bytes,String mime,String locale){return " two cartons of milk ";}
    };
    private CartAudioTranscriptionService service(boolean approved,int rate){return new CartAudioTranscriptionService(List.of(mock),"contract-mock",approved,approved,60,10,1,rate,Duration.ofMinutes(1),Clock.systemUTC());}

    @Test void mockProviderHasRepeatableCapabilityAndTranscriptContract(){
        var service=service(true,2);assertTrue(service.capability().enabled());assertEquals(List.of("audio/mp4","audio/webm"),service.capability().mimeTypes());
        var file=new MockMultipartFile("audio","clip.webm","audio/webm;codecs=opus",new byte[]{1,2});
        assertEquals("two cartons of milk",service.transcribe("customer-1",file,12.5,"en-US").text());
    }
    @Test void remainsHiddenWithoutApprovalAndRejectsLimitsFormatAndRate(){
        assertFalse(service(false,2).capability().enabled());
        var service=service(true,1);
        assertThrows(ApiException.class,()->service.transcribe("a",new MockMultipartFile("audio","x","audio/wav",new byte[]{1}),2,"en"));
        assertThrows(ApiException.class,()->service.transcribe("a",new MockMultipartFile("audio","x","audio/webm",new byte[11]),2,"en"));
        service.transcribe("b",new MockMultipartFile("audio","x","audio/webm",new byte[]{1}),2,"en");
        assertThrows(ApiException.class,()->service.transcribe("b",new MockMultipartFile("audio","x","audio/webm",new byte[]{1}),2,"en"));
    }
}
