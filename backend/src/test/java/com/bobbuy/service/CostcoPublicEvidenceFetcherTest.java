package com.bobbuy.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static com.bobbuy.service.CostcoEvidenceAcquisitionPlanner.*;

class CostcoPublicEvidenceFetcherTest {
    private final Clock clock=Clock.fixed(Instant.parse("2026-11-09T09:00:00Z"),ZoneOffset.UTC);
    private final URI doc=URI.create("https://costco.example/item/123?variant=1"),image=URI.create("https://cdn.example/image.png?version=2");
    private final CostcoOfficialEvidenceFetcher.Query query=new CostcoOfficialEvidenceFetcher.Query(7,"costco-jp","JP","123",null,"a".repeat(64));
    private static final class Store implements CostcoEvidenceStore {
        final Map<String,byte[]> data=new HashMap<>();final List<CostcoOfficialEvidence> receipts=new ArrayList<>();
        @Override public void put(CostcoOfficialEvidenceFetcher.Query q,CostcoOfficialEvidence e,byte[] bytes){assertEquals(e.sha256(),CostcoPublicEvidenceFetcher.hash(bytes));data.put(q.merchantId()+":"+e.sha256(),bytes.clone());receipts.add(e);}
        @Override public byte[] readVerified(long owner,String sha){return data.get(owner+":"+sha).clone();}
    }
    private Source document(){return new Source(doc,doc,Kind.DOCUMENT,Priority.COSTCO);}
    private Source picture(){return new Source(doc,image,Kind.IMAGE,Priority.COSTCO);}
    private Plan plan(List<Source> sources){return new Plan(query.inputHash(),"openai-compatible","actual-model-id-from-test",REQUIRED_NODE,sources);}
    private InetAddress publicIp() throws IOException{return InetAddress.getByAddress(new byte[]{8,8,8,8});}
    private CostcoPublicEvidenceFetcher fetcher(Store store,List<Source> sources,CostcoPublicEvidenceFetcher.Transport transport){return new CostcoPublicEvidenceFetcher(q->plan(sources),store,h->new InetAddress[]{publicIp()},transport,clock);}
    private CostcoPublicEvidenceFetcher.Response response(String type,byte[] body){return new CostcoPublicEvidenceFetcher.Response(200,Map.of("content-type",List.of(type)),body);}
    private byte[] png()throws IOException{var out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(20,10,BufferedImage.TYPE_INT_RGB),"png",out);return out.toByteArray();}
    @Test void documentThenRealDecodedImageKeepsExactBytesQueryAndParentEvidenceHash()throws Exception {
        var store=new Store();var called=new ArrayList<URI>();byte[] pixels=png();
        var receipts=fetcher(store,List.of(picture(),document()),(uri,address,max,time)->{called.add(uri);assertEquals(publicIp(),address);return response(uri.equals(doc)?"text/html; charset=utf-8":"image/png",uri.equals(doc)?("<img src=\""+image+"\">").getBytes(StandardCharsets.UTF_8):pixels);}).fetch(query);
        assertEquals(List.of(doc,image),called);assertEquals(2,receipts.size());var imageReceipt=receipts.get(1);
        assertEquals(20,imageReceipt.width());assertEquals(10,imageReceipt.height());assertEquals(receipts.get(0).sha256(),imageReceipt.sourceDocumentSha256());
        assertEquals(image,imageReceipt.fetchedUrl());assertArrayEquals(pixels,store.readVerified(7,imageReceipt.sha256()));
    }
    @Test void refusesImageWithoutFetchedDocumentAndDoesNotAskTransport(){var store=new Store();assertThrows(IllegalStateException.class,()->fetcher(store,List.of(picture()),(u,a,m,t)->{fail("Unfetched source must not request image");return null;}).fetch(query));assertTrue(store.receipts.isEmpty());}
    @Test void refusesCanonicalDocumentThatWasOnlyProposed(){var source=new Source(doc,URI.create("https://costco.example/api/data"),Kind.DOCUMENT,Priority.COSTCO);assertThrows(IllegalStateException.class,()->fetcher(new Store(),List.of(source),(u,a,m,t)->{fail();return null;}).fetch(query));}
    @Test void discoveryMustBindNodeAndActualInputHash(){
        for(var altered:List.of(new Plan("b".repeat(64),"p","m",REQUIRED_NODE,List.of(document())),new Plan(query.inputHash(),"p","m",URI.create("https://other.example/v1"),List.of(document())))){
            var f=new CostcoPublicEvidenceFetcher(q->altered,new Store(),h->{fail();return null;},(u,a,m,t)->{fail();return null;},clock);assertThrows(IllegalStateException.class,()->f.fetch(query));
        }
    }
    @Test void boundedSecondDiscoveryUsesActuallyFetchedDocumentsBeforeProposingImage()throws Exception {
        var store=new Store();var calls=new ArrayList<URI>();byte[] pixels=png();
        var planner=new CostcoEvidenceAcquisitionPlanner(){
            @Override public Plan plan(CostcoOfficialEvidenceFetcher.Query q){return new Plan(q.inputHash(),"p","m",REQUIRED_NODE,List.of(document()),false);}
            @Override public Plan plan(CostcoOfficialEvidenceFetcher.Query q,List<CostcoOfficialEvidence> found){
                assertEquals(1,found.size());assertArrayEquals("real fetched source".getBytes(StandardCharsets.UTF_8),store.readVerified(q.merchantId(),found.get(0).sha256()));
                return new Plan(q.inputHash(),"p","m",REQUIRED_NODE,List.of(picture()),true);
            }
        };
        var fetcher=new CostcoPublicEvidenceFetcher(planner,store,h->new InetAddress[]{publicIp()},(u,a,m,t)->{calls.add(u);return u.equals(doc)?response("text/html","real fetched source".getBytes(StandardCharsets.UTF_8)):response("image/png",pixels);},clock);
        var found=fetcher.fetch(query);assertEquals(List.of(doc,image),calls);assertEquals(2,found.size());assertEquals(found.get(0).sha256(),found.get(1).sourceDocumentSha256());
    }
    @Test void incompleteDiscoveryStopsAfterThreeRoundsAndDoesNotRepeatDownloads(){
        int[] plans={0},requests={0};var store=new Store();
        var planner=new CostcoEvidenceAcquisitionPlanner(){@Override public Plan plan(CostcoOfficialEvidenceFetcher.Query q){plans[0]++;var url=URI.create("https://costco.example/discovery/"+plans[0]);return new Plan(q.inputHash(),"p","m",REQUIRED_NODE,List.of(new Source(url,url,Kind.DOCUMENT,Priority.COSTCO)),false);}};
        var fetcher=new CostcoPublicEvidenceFetcher(planner,store,h->new InetAddress[]{publicIp()},(u,a,m,t)->{requests[0]++;return response("text/html",new byte[]{65});},clock);
        assertEquals("onboarding.discovery_round_limit",assertThrows(CostcoPublicEvidenceFetcher.NeedsEvidence.class,()->fetcher.fetch(query)).getMessage());assertEquals(3,plans[0]);assertEquals(3,requests[0]);assertEquals(3,store.receipts.size());
    }
    @Test void duplicateIncompleteDiscoveryStopsAsNeedsEvidenceAndCompleteEmptyRoundCanFinish(){
        int[] requests={0};var store=new Store();
        var planner=new CostcoEvidenceAcquisitionPlanner(){@Override public Plan plan(CostcoOfficialEvidenceFetcher.Query q){return new Plan(q.inputHash(),"p","m",REQUIRED_NODE,List.of(document()),false);}};
        var transport=(CostcoPublicEvidenceFetcher.Transport)(u,a,m,t)->{requests[0]++;return response("text/html",new byte[]{65});};
        var fetcher=new CostcoPublicEvidenceFetcher(planner,store,h->new InetAddress[]{publicIp()},transport,clock);
        assertEquals("onboarding.discovery_no_progress",assertThrows(CostcoPublicEvidenceFetcher.NeedsEvidence.class,()->fetcher.fetch(query)).getMessage());assertEquals(1,requests[0]);
        var complete=new CostcoEvidenceAcquisitionPlanner(){@Override public Plan plan(CostcoOfficialEvidenceFetcher.Query q){return new Plan(q.inputHash(),"p","m",REQUIRED_NODE,List.of(document()),false);}@Override public Plan plan(CostcoOfficialEvidenceFetcher.Query q,List<CostcoOfficialEvidence> found){return new Plan(q.inputHash(),"p","m",REQUIRED_NODE,List.of(),true);}};
        assertEquals(1,new CostcoPublicEvidenceFetcher(complete,store,h->new InetAddress[]{publicIp()},transport,clock).fetch(query).size());
    }
    @Test void localPrivateReservedAndCloudMetadataAddressesNeverPass()throws Exception {
        for(String literal:List.of("0.0.0.0","10.0.0.1","100.64.0.1","127.0.0.1","169.254.169.254","172.31.1.1","192.168.1.1","192.0.2.1","198.18.0.1","198.51.100.1","203.0.113.1","224.0.0.1","255.255.255.255","::1","fc00::1","fe80::1","2001:db8::1","2002:a00:1::1"))assertFalse(CostcoPublicEvidenceFetcher.isPublicAddress(InetAddress.getByName(literal)),literal);
        assertTrue(CostcoPublicEvidenceFetcher.isPublicAddress(publicIp()));assertTrue(CostcoPublicEvidenceFetcher.isPublicAddress(InetAddress.getByName("2606:4700:4700::1111")));
    }
    @Test void mixedDnsAnswerFailsBeforeConnecting()throws Exception {
        var f=new CostcoPublicEvidenceFetcher(q->plan(List.of(document())),new Store(),h->new InetAddress[]{publicIp(),InetAddress.getByAddress(new byte[]{127,0,0,1})},(u,a,m,t)->{fail();return null;},clock);
        assertThrows(IllegalStateException.class,()->f.fetch(query));
    }
    @Test void redirectsAreResolvedAndValidatedAgainBeforeAnyNewConnection(){
        var calls=new ArrayList<URI>();var f=new CostcoPublicEvidenceFetcher(q->plan(List.of(document())),new Store(),h->new InetAddress[]{h.equals("private.example")?InetAddress.getByAddress(new byte[]{10,0,0,1}):publicIp()},(u,a,m,t)->{calls.add(u);return new CostcoPublicEvidenceFetcher.Response(302,Map.of("location",List.of("https://private.example/secret")),new byte[0]);},clock);
        assertThrows(IllegalStateException.class,()->f.fetch(query));assertEquals(List.of(doc),calls);
    }
    @Test void dnsRebindingCannotCauseTransportToResolveASecondAddress()throws Exception {
        int[] resolutions={0};var f=new CostcoPublicEvidenceFetcher(q->plan(List.of(document())),new Store(),h->{resolutions[0]++;return new InetAddress[]{resolutions[0]==1?publicIp():InetAddress.getByAddress(new byte[]{127,0,0,1})};},(u,pinned,m,t)->{assertEquals(publicIp(),pinned);return response("text/html","document".getBytes(StandardCharsets.UTF_8));},clock);
        assertEquals(1,f.fetch(query).size());assertEquals(1,resolutions[0]);
    }
    @Test void rejectsHttpCredentialsFragmentsPortsAndDowngradeRedirects(){
        for(String u:List.of("http://costco.example/p","https://user:secret@costco.example/p","https://costco.example:8080/p","https://costco.example/p#fragment"))assertThrows(IllegalArgumentException.class,()->CostcoOfficialEvidence.validateHttps(URI.create(u)));
        assertThrows(IllegalArgumentException.class,()->fetcher(new Store(),List.of(document()),(u,a,m,t)->new CostcoPublicEvidenceFetcher.Response(302,Map.of("location",List.of("http://costco.example/p")),new byte[0])).fetch(query));
    }
    @Test void redirectLoopAndExcessiveHopsAreBounded(){
        assertThrows(IllegalStateException.class,()->fetcher(new Store(),List.of(document()),(u,a,m,t)->new CostcoPublicEvidenceFetcher.Response(302,Map.of("location",List.of(u.toString())),new byte[0])).fetch(query));
        int[] count={0};assertThrows(IllegalStateException.class,()->fetcher(new Store(),List.of(document()),(u,a,m,t)->{count[0]++;return new CostcoPublicEvidenceFetcher.Response(302,Map.of("location",List.of("/hop/"+count[0])),new byte[0]);}).fetch(query));assertEquals(4,count[0]);
    }
    @Test void oversizedUnsupportedEncodedAndForbiddenSourcesAreNotEvidence(){
        for(var resp:List.of(response("text/html",new byte[CostcoPublicEvidenceFetcher.MAX_DOCUMENT_BYTES+1]),response("application/octet-stream",new byte[]{1}),new CostcoPublicEvidenceFetcher.Response(200,Map.of("content-type",List.of("text/html"),"content-encoding",List.of("gzip")),new byte[]{1}),new CostcoPublicEvidenceFetcher.Response(403,Map.of(),new byte[0]))) {
            var store=new Store();assertThrows(IllegalStateException.class,()->fetcher(store,List.of(document()),(u,a,m,t)->resp).fetch(query));assertTrue(store.receipts.isEmpty());
        }
    }
    @Test void actualImageDecoderRejectsCorruptOrMismatchedImageMime()throws Exception {
        for(var resp:List.of(response("image/png",new byte[]{1,2}),response("image/jpeg",png()),response("image/webp",new byte[]{1,2}))) {
            var store=new Store();assertThrows(RuntimeException.class,()->fetcher(store,List.of(document(),picture()),(u,a,m,t)->u.equals(doc)?response("text/html",new byte[]{65}):resp).fetch(query));assertEquals(1,store.receipts.size());
        }
    }
    private CostcoPublicEvidenceFetcher.Response parse(String raw,int max)throws IOException{return CostcoPublicHttpsTransport.readResponse(new ByteArrayInputStream(raw.getBytes(StandardCharsets.US_ASCII)),max);}
    @Test void httpParserHandlesBoundedLengthAndChunkedBodies()throws Exception {
        assertArrayEquals("abc".getBytes(StandardCharsets.US_ASCII),parse("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 3\r\n\r\nabc",3).body());
        assertArrayEquals("abcd".getBytes(StandardCharsets.US_ASCII),parse("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nab\r\n2\r\ncd\r\n0\r\n\r\n",4).body());
    }
    @Test void httpParserRejectsAmbiguousTruncatedLargeAndCompressedBodies(){
        for(String raw:List.of("HTTP/1.1 200 OK\r\nContent-Length: 1\r\nContent-Length: 1\r\n\r\nx","HTTP/1.1 200 OK\r\nContent-Length: 1\r\nTransfer-Encoding: chunked\r\n\r\nx","HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nxx","HTTP/1.1 200 OK\r\nContent-Length: 9999999999\r\n\r\n","HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nffffffff\r\n","HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n\r\n"))assertThrows(IOException.class,()->parse(raw,4));
    }
}
