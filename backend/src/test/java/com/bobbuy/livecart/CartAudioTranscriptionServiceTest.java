package com.bobbuy.livecart;

import com.bobbuy.api.response.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;

class CartAudioTranscriptionServiceTest {
    private final AudioTranscriptionProvider mock = new AudioTranscriptionProvider() {
        public String id(){return "contract-mock";}
        public Set<String> supportedMimeTypes(){return Set.of("audio/webm","audio/mp4");}
        public String transcribe(byte[] bytes,String mime,String locale){return " two cartons of milk ";}
    };
    private CartAudioTranscriptionService service(boolean approved,int rate){return new CartAudioTranscriptionService(List.of(mock),"contract-mock",approved,approved,60,100,1,rate,Duration.ofMinutes(1),Clock.systemUTC());}

    @Test void mockProviderHasRepeatableCapabilityAndTranscriptContract(){
        var service=service(true,2);assertTrue(service.capability().enabled());assertEquals(List.of("audio/mp4","audio/webm"),service.capability().mimeTypes());
        var file=new MockMultipartFile("audio","clip.mp4","audio/mp4",mp4(12.5));
        assertEquals("two cartons of milk",service.transcribe("customer-1",file,12.5,"en-US").text());
    }
    @Test void remainsHiddenWithoutApprovalAndRejectsSpoofedFormatDurationLimitsAndRate(){
        assertFalse(service(false,2).capability().enabled());var service=service(true,1);
        assertThrows(ApiException.class,()->service.transcribe("a",new MockMultipartFile("audio","x.mp4","audio/mp4",new byte[]{1}),2,"en"));
        assertThrows(ApiException.class,()->service.transcribe("a",new MockMultipartFile("audio","x.webm","audio/webm",mp4(2)),2,"en"));
        assertThrows(ApiException.class,()->service.transcribe("a",new MockMultipartFile("audio","x.mp4","audio/mp4",mp4(61)),61,"en"));
        assertThrows(ApiException.class,()->service.transcribe("a",new MockMultipartFile("audio","x.mp4","audio/mp4",mp4(20)),2,"en"));
        service.transcribe("b",new MockMultipartFile("audio","x.mp4","audio/mp4",mp4(2)),2,"en");
        assertThrows(ApiException.class,()->service.transcribe("b",new MockMultipartFile("audio","x.mp4","audio/mp4",mp4(2)),2,"en"));
    }
    @Test void timeoutInterruptsProviderWorkerAndReleasesConcurrency() throws Exception {
        CountDownLatch interrupted=new CountDownLatch(1);
        AudioTranscriptionProvider blocking=new AudioTranscriptionProvider(){public String id(){return "blocking";}public Set<String> supportedMimeTypes(){return Set.of("audio/mp4");}public String transcribe(byte[] b,String m,String l)throws Exception{try{Thread.sleep(30_000);return "late";}catch(InterruptedException ex){interrupted.countDown();throw ex;}}};
        var service=new CartAudioTranscriptionService(List.of(blocking),"blocking",true,true,60,100,1,5,Duration.ofMinutes(1),Clock.systemUTC(),Duration.ofMillis(20));
        assertThrows(ApiException.class,()->service.transcribe("a",new MockMultipartFile("audio","x.mp4","audio/mp4",mp4(2)),2,"en"));
        assertTrue(interrupted.await(1,TimeUnit.SECONDS));
    }
    private static byte[] mp4(double seconds){byte[] out=new byte[48];out[3]=24;System.arraycopy("ftyp".getBytes(),0,out,4,4);System.arraycopy("M4A ".getBytes(),0,out,8,4);System.arraycopy("mvhd".getBytes(),0,out,24,4);java.nio.ByteBuffer b=java.nio.ByteBuffer.wrap(out);b.putInt(40,1000);b.putInt(44,(int)(seconds*1000));return out;}
}
