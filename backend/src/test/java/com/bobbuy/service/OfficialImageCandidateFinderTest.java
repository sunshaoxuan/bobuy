package com.bobbuy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;

class OfficialImageCandidateFinderTest {
 static final class StubResearch extends OfficialProductResearch {
  private final List<Product> products;
  StubResearch(List<Product> products){super(null,new ObjectMapper());this.products=products;}
  @Override public List<Product> find(String item,String url){return products;}
 }
 private static OfficialImageCandidateFinder.Request costco12kg(){return new OfficialImageCandidateFinder.Request(7,"costco","JP","564513","Brand","1.2 kg","1 pack");}

 @Test void rejectsSameBrandWrong330gOr700gVariant(){
  var research=new StubResearch(List.of(
    new OfficialProductResearch.Product("564513","Brand food 330g","Brand package 330 g","https://www.costco.co.jp/p/564513",List.of("https://www.costco.co.jp/medias/sys_master/images/a.jpg")),
    new OfficialProductResearch.Product("564513","Brand food 700g","Brand package 700 g","https://www.costco.co.jp/p/564513",List.of("https://www.costco.co.jp/medias/sys_master/images/b.jpg"))));
  assertThat(new OfficialImageCandidateFinder.CostcoOfficialSiteFinder(research).find(costco12kg())).isEmpty();
 }

 @Test void returnsRealSourcePageAndImageOnlyForExactSkuSpecification(){
  var page="https://www.costco.co.jp/p/564513";var image="https://www.costco.co.jp/medias/sys_master/images/exact.jpg";
  var research=new StubResearch(List.of(new OfficialProductResearch.Product("564513","Brand food 1.2kg","Official 1.2 kg package",page,List.of(image))));
  var result=new OfficialImageCandidateFinder.CostcoOfficialSiteFinder(research).find(costco12kg());
  assertThat(result).hasValueSatisfying(candidate->{assertThat(candidate.sourcePage()).isEqualTo(page);assertThat(candidate.imageUrl()).isEqualTo(image);assertThat(candidate.matchBasis()).contains("564513","1.2 kg");});
 }

 @Test void weightCannotMatchSameNumberExpressedAsVolume(){
  assertThat(OfficialImageCandidateFinder.CostcoOfficialSiteFinder.sameVariant("1.2 kg 2 pack","Brand drink 1.2 L x 2")).isFalse();
 }

 @Test void packageMultiplierMustMatchForMultiPack(){
  assertThat(OfficialImageCandidateFinder.CostcoOfficialSiteFinder.sameVariant("330 g x 6","Brand food 330 g x 4")).isFalse();
  assertThat(OfficialImageCandidateFinder.CostcoOfficialSiteFinder.sameVariant("330 g x 6","Brand food six pack 330 g x 6")).isTrue();
 }

 @Test void independentLookupUsesExactOfficialImageAcquisitionAndOnlyTheExactProductSection(){
  String html="""
    <script type="application/ld+json">{"@type":"Product","sku":"564513","name":"Brand food 330 g"}</script>
    <table><tr><td class="attrib">Size</td><td class="attrib-val">330 g</td></tr></table>
    <aside>Other product 564513 Brand food 1.2 kg 1 pack</aside>
    """;
  byte[] bytes=html.getBytes(StandardCharsets.UTF_8);String hash=CostcoPinnedStageReviewer.digest(bytes);
  var pageUri=URI.create("https://www.costco.co.jp/p/564513");
  var page=new CostcoOfficialEvidence("page",pageUri,pageUri,hash,Instant.parse("2026-11-28T00:00:00Z"),"text/html",null,null,List.of());
  var image=new CostcoOfficialEvidence("image",pageUri,URI.create("https://www.costco.co.jp/exact.jpg"),"b".repeat(64),Instant.parse("2026-11-28T00:00:00Z"),"image/jpeg",1000,1000,List.of(),hash);
  CostcoEvidenceStore store=new CostcoEvidenceStore(){public void put(CostcoOfficialEvidenceFetcher.Query q,CostcoOfficialEvidence e,byte[] b){}public byte[] readVerified(long owner,String sha){return bytes;}};
  CostcoOfficialEvidenceFetcher fetcher=query->{assertThat(query.acquisition()).isEqualTo(CostcoOfficialEvidenceFetcher.Acquisition.EXACT_OFFICIAL_IMAGE);assertThat(query.privatePhotoSha256()).isNull();return List.of(page,image);};
  assertThat(new OfficialImageCandidateFinder.CostcoOfficialSiteFinder(fetcher,store,new ObjectMapper()).find(costco12kg())).isEmpty();
 }

 @Test void acceptsExactCostcoOgImageOnlyWithVerifiedParentHash(){
  String html="""
    <meta property="og:image" content="http://www.costco.co.jp/medias/53432.jpg">
    <script type="application/ld+json">{"@type":"Product","sku":"53432","name":"Seafood 1 kg 1 pack"}</script>
    """;
  byte[] bytes=html.getBytes(StandardCharsets.UTF_8);String hash=CostcoPinnedStageReviewer.digest(bytes);
  var pageUri=URI.create("https://www.costco.co.jp/c/Seafood/p/53432");
  var page=new CostcoOfficialEvidence("page",pageUri,pageUri,hash,Instant.parse("2026-11-28T00:00:00Z"),"text/html",null,null,List.of());
  var image=new CostcoOfficialEvidence("image",pageUri,URI.create("https://www.costco.co.jp/medias/53432.jpg"),"b".repeat(64),Instant.parse("2026-11-28T00:00:00Z"),"image/jpeg",1000,1000,List.of(),hash);
  CostcoEvidenceStore store=new CostcoEvidenceStore(){public void put(CostcoOfficialEvidenceFetcher.Query q,CostcoOfficialEvidence e,byte[] b){}public byte[] readVerified(long owner,String sha){return bytes;}};
  var request=new OfficialImageCandidateFinder.Request(7,"costco","JP","53432",null,"1 kg","1 pack");
  assertThat(new OfficialImageCandidateFinder.CostcoOfficialSiteFinder(q->List.of(page,image),store,new ObjectMapper()).find(request))
    .hasValueSatisfying(found->{assertThat(found.sourcePage()).isEqualTo(pageUri.toString());assertThat(found.imageUrl()).isEqualTo(image.fetchedUrl().toString());});
 }

 @Test void acceptsManufacturerOnlyWhenExactCostcoProductNamesItsOfficialDomain(){
  String costco="""
    <script type="application/ld+json">{"@type":"Product","sku":"564513","name":"Kewpie food 1.2 kg 1 pack","brand":{"@type":"Brand","name":"Kewpie","url":"https://www.kewpie.co.jp/"}}</script>
    """;
  String manufacturer="""
    <script type="application/ld+json">{"@type":"Product","sku":"564513","name":"Kewpie food 1.2 kg 1 pack","image":"https://cdn.kewpie.co.jp/564513.jpg"}</script>
    """;
  var request=new OfficialImageCandidateFinder.Request(7,"costco","JP","564513","Kewpie","1.2 kg","1 pack");
  var fixture=manufacturerFixture(costco,manufacturer,"https://www.kewpie.co.jp/products/564513");
  assertThat(new OfficialImageCandidateFinder.CostcoOfficialSiteFinder(fixture.fetcher(),fixture.store(),new ObjectMapper()).find(request))
    .hasValueSatisfying(candidate->{assertThat(candidate.sourcePage()).isEqualTo("https://www.kewpie.co.jp/products/564513");assertThat(candidate.imageUrl()).isEqualTo("https://cdn.kewpie.co.jp/564513.jpg");});
 }

 @Test void rejectsJpLookalikeThatOnlyDeclaresItselfOfficial(){
  String costco="""
    <script type="application/ld+json">{"@type":"Product","sku":"564513","name":"Kewpie food 1.2 kg 1 pack","brand":{"@type":"Brand","name":"Kewpie"},"image":"https://kewpie-official.jp/example.jpg"}</script>
    """;
  String lookalike="""
    <script type="application/ld+json">{"@type":"Product","sku":"564513","name":"Kewpie official food 1.2 kg 1 pack","brand":"Kewpie","url":"https://kewpie-official.jp/jp/564513"}</script>
    """;
  var fixture=manufacturerFixture(costco,lookalike,"https://kewpie-official.jp/jp/564513");
  var request=new OfficialImageCandidateFinder.Request(7,"costco","JP","564513","Kewpie","1.2 kg","1 pack");
  assertThat(new OfficialImageCandidateFinder.CostcoOfficialSiteFinder(fixture.fetcher(),fixture.store(),new ObjectMapper()).find(request)).isEmpty();
  assertThat(fixture.fetches()).containsExactly(1);
 }

 private record ManufacturerFixture(CostcoOfficialEvidenceFetcher fetcher,CostcoEvidenceStore store,List<Integer> fetches){}
 private static ManufacturerFixture manufacturerFixture(String costcoHtml,String manufacturerHtml,String manufacturerUrl){
  var bodies=new HashMap<String,byte[]>();
  byte[] costcoBytes=costcoHtml.getBytes(StandardCharsets.UTF_8),manufacturerBytes=manufacturerHtml.getBytes(StandardCharsets.UTF_8);
  String costcoHash=CostcoPinnedStageReviewer.digest(costcoBytes),manufacturerHash=CostcoPinnedStageReviewer.digest(manufacturerBytes);
  bodies.put(costcoHash,costcoBytes);bodies.put(manufacturerHash,manufacturerBytes);
  var costcoUri=URI.create("https://www.costco.co.jp/p/564513");var makerUri=URI.create(manufacturerUrl);
  var costcoPage=new CostcoOfficialEvidence("costco",costcoUri,costcoUri,costcoHash,Instant.parse("2026-11-28T00:00:00Z"),"text/html",null,null,List.of());
  var makerPage=new CostcoOfficialEvidence("maker",makerUri,makerUri,manufacturerHash,Instant.parse("2026-11-28T00:00:00Z"),"text/html",null,null,List.of());
  var image=new CostcoOfficialEvidence("image",makerUri,URI.create("https://cdn.kewpie.co.jp/564513.jpg"),"c".repeat(64),Instant.parse("2026-11-28T00:00:00Z"),"image/jpeg",1200,1200,List.of(),manufacturerHash);
  CostcoEvidenceStore store=new CostcoEvidenceStore(){public void put(CostcoOfficialEvidenceFetcher.Query q,CostcoOfficialEvidence e,byte[] b){}public byte[] readVerified(long owner,String sha){return bodies.get(sha);}};
  var fetches=new ArrayList<Integer>();CostcoOfficialEvidenceFetcher fetcher=query->{fetches.add(1);return List.of(costcoPage,makerPage,image);};
  return new ManufacturerFixture(fetcher,store,fetches);
 }
}
