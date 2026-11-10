package com.bobbuy.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import javax.imageio.ImageIO;
import static com.bobbuy.service.CostcoEvidenceAcquisitionPlanner.Kind.*;

/** Bounded public retrieval of real-engine proposed URLs. Never grants semantic admission. */
public final class CostcoPublicEvidenceFetcher implements CostcoOfficialEvidenceFetcher {
    public static final int MAX_DOCUMENT_BYTES = 1024 * 1024;
    public static final int MAX_IMAGE_BYTES = RecommendationImageValidator.MAX_BYTES;
    public record Response(int status, Map<String,List<String>> headers, byte[] body) {
        public Response { headers=Map.copyOf(headers); body=body.clone(); }
        public String header(String name) {
            var values=headers.entrySet().stream().filter(e->e.getKey().equalsIgnoreCase(name)).flatMap(e->e.getValue().stream()).toList();
            if(values.size()>1)throw new IllegalStateException("onboarding.ambiguous_header");
            return values.isEmpty()?null:values.get(0);
        }
    }
    @FunctionalInterface public interface Resolver { InetAddress[] resolve(String host) throws IOException; }
    /** Implementations must connect exactly to pinnedAddress, keep URI hostname for SNI/certificate checks,
     * never resolve again or automatically redirect, and enforce bytes/deadline before allocation. */
    @FunctionalInterface public interface Transport { Response get(URI uri, InetAddress pinnedAddress, int maxBytes, Duration timeout) throws IOException; }
    public static final class NeedsEvidence extends IllegalStateException {
        public NeedsEvidence(String code) { super(code); }
    }
    private final CostcoEvidenceAcquisitionPlanner planner;
    private final CostcoEvidenceStore store;
    private final Resolver resolver;
    private final Transport transport;
    private final Clock clock;
    private final java.util.function.Consumer<Query> scopeGuard;
    public CostcoPublicEvidenceFetcher(CostcoEvidenceAcquisitionPlanner planner, CostcoEvidenceStore store, Clock clock) {
        this(planner,store,CostcoPublicEvidenceFetcher::boundedResolve,new CostcoPublicHttpsTransport(),clock);
    }
    public CostcoPublicEvidenceFetcher(CostcoEvidenceAcquisitionPlanner planner,CostcoEvidenceStore store,Clock clock,java.util.function.Consumer<Query> scopeGuard){
        this(planner,store,CostcoPublicEvidenceFetcher::boundedResolve,new CostcoPublicHttpsTransport(),clock,scopeGuard);
    }
    public CostcoPublicEvidenceFetcher(CostcoEvidenceAcquisitionPlanner planner,CostcoEvidenceStore store,Resolver resolver,Transport transport,Clock clock) {
        this(planner,store,resolver,transport,clock,q->{});
    }
    public CostcoPublicEvidenceFetcher(CostcoEvidenceAcquisitionPlanner planner,CostcoEvidenceStore store,Resolver resolver,Transport transport,Clock clock,java.util.function.Consumer<Query> scopeGuard) {
        this.planner=Objects.requireNonNull(planner);this.store=Objects.requireNonNull(store);this.resolver=Objects.requireNonNull(resolver);this.transport=Objects.requireNonNull(transport);this.clock=Objects.requireNonNull(clock);this.scopeGuard=Objects.requireNonNull(scopeGuard);
    }
    @Override public List<CostcoOfficialEvidence> fetch(Query query) {
        if(query.merchantId()<=0||query.supplierId()==null||query.supplierId().isBlank()||query.market()==null||!query.market().matches("[A-Z]{2}")
                ||query.itemNumber()==null||!query.itemNumber().matches("[0-9]{1,12}")||query.inputHash()==null||!query.inputHash().matches("[0-9a-f]{64}"))
            throw new IllegalArgumentException("onboarding.evidence_scope");
        long deadline=System.nanoTime()+Duration.ofSeconds(60).toNanos();
        var result=new ArrayList<CostcoOfficialEvidence>();var documents=new HashMap<URI,CostcoOfficialEvidence>();var fetchedSources=new HashSet<String>();int remainingBytes=24*1024*1024;
        for(int round=0;round<3;round++) {
          scopeGuard.accept(query);checkDeadline(deadline);long planningStarted=System.nanoTime();var plan=round==0?planner.plan(query):planner.plan(query,List.copyOf(result));deadline+=System.nanoTime()-planningStarted;checkDeadline(deadline);
          if(!query.inputHash().equals(plan.inputHash())||!CostcoEvidenceAcquisitionPlanner.REQUIRED_NODE.equals(plan.endpoint()))
              throw new IllegalStateException("onboarding.unattested_discovery");
          int before=result.size();var sources=plan.sources().stream().sorted(Comparator.comparing(CostcoEvidenceAcquisitionPlanner.Source::kind)
                  .thenComparing(CostcoEvidenceAcquisitionPlanner.Source::priority)).toList();
          for(var source:sources) {
            checkDeadline(deadline);String parentHash=null;
            String sourceKey=source.kind()+"|"+source.canonicalUrl()+"|"+source.fetchUrl();if(fetchedSources.contains(sourceKey))continue;
            if(fetchedSources.size()>=12)throw new IllegalStateException("onboarding.evidence_source_budget");
            if(source.kind()==IMAGE) {
                var parent=documents.get(source.canonicalUrl());
                if(parent==null)throw new IllegalStateException("onboarding.unfetched_source_document");
                parentHash=parent.sha256();
            } else if(!source.canonicalUrl().equals(source.fetchUrl())) {
                throw new IllegalStateException("onboarding.unfetched_canonical_document");
            }
            if(remainingBytes<=0)throw new IllegalStateException("onboarding.evidence_budget");
            var retrieved=retrieve(query,source.fetchUrl(),Math.min(remainingBytes,source.kind()==IMAGE?MAX_IMAGE_BYTES:MAX_DOCUMENT_BYTES),deadline);
            String media=mediaType(retrieved.response().header("content-type"));var bytes=retrieved.response().body();
            remainingBytes-=bytes.length;
            if(bytes.length==0)throw new IllegalStateException("onboarding.empty_evidence");
            Integer width=null,height=null;
            if(source.kind()==IMAGE) {
                if(!List.of("image/png","image/jpeg").contains(media))throw new IllegalStateException("onboarding.unsupported_image_format");
                var checked=RecommendationImageValidator.validate(bytes);
                if(!checked.contentType().equals(media))throw new IllegalStateException("onboarding.image_mime_mismatch");
                try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                    var readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw new IllegalStateException("onboarding.image_decode");
                    var reader=readers.next();try{reader.setInput(stream);width=reader.getWidth(0);height=reader.getHeight(0);}finally{reader.dispose();}
                }catch(IOException e){throw new IllegalStateException("onboarding.image_decode",e);}
            } else if(!List.of("text/html","application/xhtml+xml","application/json","application/ld+json","text/plain").contains(media)) {
                throw new IllegalStateException("onboarding.document_mime");
            }
            var receipt=new CostcoOfficialEvidence(UUID.randomUUID().toString(),source.canonicalUrl(),retrieved.url(),hash(bytes),clock.instant(),media,width,height,retrieved.redirects(),parentHash);
            store.put(query,receipt,bytes.clone());result.add(receipt);
            fetchedSources.add(sourceKey);
            if(source.kind()==DOCUMENT){documents.put(source.canonicalUrl(),receipt);documents.put(retrieved.url(),receipt);}
          }
          if(plan.discoveryComplete())return List.copyOf(result);
          if(result.size()==before)throw new NeedsEvidence("onboarding.discovery_no_progress");
        }
        throw new NeedsEvidence("onboarding.discovery_round_limit");
    }
    private record Retrieved(URI url,Response response,List<URI> redirects) {}
    private Retrieved retrieve(Query query,URI initial,int maxBytes,long deadline) {
        var visited=new HashSet<URI>();var redirects=new ArrayList<URI>();URI uri=initial;
        for(int hop=0;hop<=3;hop++) {
            scopeGuard.accept(query);checkDeadline(deadline);CostcoOfficialEvidence.validateHttps(uri);
            if(uri.toASCIIString().length()>2048||!visited.add(uri))throw new IllegalStateException("onboarding.redirect_loop");
            InetAddress[] addresses;
            try{addresses=resolver.resolve(uri.getHost());}catch(IOException e){throw new IllegalStateException("onboarding.dns_failed",e);}
            checkDeadline(deadline);
            if(addresses==null||addresses.length==0||addresses.length>16)throw new IllegalStateException("onboarding.invalid_dns");
            // Reject the entire DNS answer if any alternative is private; never choose only its public entry.
            for(var address:addresses)if(!isPublicAddress(address))throw new IllegalStateException("onboarding.private_address");
            Response response;
            try{response=transport.get(uri,addresses[0],maxBytes,Duration.ofNanos(Math.min(Duration.ofSeconds(15).toNanos(),deadline-System.nanoTime())));}
            catch(IOException e){throw new IllegalStateException("onboarding.fetch_failed",e);}
            if(response.body().length>maxBytes)throw new IllegalStateException("onboarding.evidence_too_large");
            if(List.of(301,302,303,307,308).contains(response.status())) {
                if(hop==3)throw new IllegalStateException("onboarding.redirect_limit");
                String location=response.header("location");if(location==null||location.length()>2048)throw new IllegalStateException("onboarding.redirect_location");
                uri=uri.resolve(location);CostcoOfficialEvidence.validateHttps(uri);redirects.add(uri);continue;
            }
            if(response.status()!=200)throw new IllegalStateException("onboarding.source_http_"+response.status());
            if(response.header("content-encoding")!=null&&!"identity".equalsIgnoreCase(response.header("content-encoding")))
                throw new IllegalStateException("onboarding.encoded_evidence_unsupported");
            return new Retrieved(uri,response,List.copyOf(redirects));
        }
        throw new IllegalStateException("onboarding.redirect_limit");
    }
    static boolean isPublicAddress(InetAddress address) {
        if(address==null||address.isAnyLocalAddress()||address.isLoopbackAddress()||address.isLinkLocalAddress()||address.isSiteLocalAddress()||address.isMulticastAddress())return false;
        var b=address.getAddress();int a=b[0]&255,c=b[1]&255,d=b.length>2?b[2]&255:0;
        if(b.length==4)return !(a==0||a==10||a==127||a>=224||(a==100&&c>=64&&c<=127)||(a==169&&c==254)
                ||(a==172&&c>=16&&c<=31)||(a==192&&(c==0||c==168))||(a==198&&(c==18||c==19||(c==51&&d==100)))||(a==203&&c==0&&d==113));
        if(b.length!=16||(a&0xe0)!=0x20)return false; // Only global-unicast IPv6; mapped/NAT64/local scopes denied.
        return !(a==0x20&&c==0x02) && !(a==0x20&&c==0x01&&((b[2]==0&&b[3]==0)||((b[2]&255)==0x0d&&(b[3]&255)==0xb8)));
    }
    private static final java.util.concurrent.ThreadPoolExecutor DNS = new java.util.concurrent.ThreadPoolExecutor(
            0,2,10,java.util.concurrent.TimeUnit.SECONDS,new java.util.concurrent.SynchronousQueue<>(),task->{var t=new Thread(task,"costco-evidence-dns");t.setDaemon(true);return t;},new java.util.concurrent.ThreadPoolExecutor.AbortPolicy());
    private static InetAddress[] boundedResolve(String host) throws IOException {
        java.util.concurrent.Future<InetAddress[]> task;
        try{task=DNS.submit(()->InetAddress.getAllByName(host));}catch(java.util.concurrent.RejectedExecutionException e){throw new IOException("DNS capacity exhausted",e);}
        try{return task.get(3,java.util.concurrent.TimeUnit.SECONDS);}
        catch(InterruptedException e){Thread.currentThread().interrupt();task.cancel(true);throw new IOException("DNS interrupted",e);}
        catch(java.util.concurrent.TimeoutException|java.util.concurrent.ExecutionException e){task.cancel(true);throw new IOException("DNS unavailable",e);}
    }
    private static void checkDeadline(long deadline){if(System.nanoTime()>=deadline)throw new IllegalStateException("onboarding.fetch_deadline");}
    private static String mediaType(String value){if(value==null)throw new IllegalStateException("onboarding.missing_content_type");return value.split(";",2)[0].strip().toLowerCase(Locale.ROOT);}
    static String hash(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);}}
}
