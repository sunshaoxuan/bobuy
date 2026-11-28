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

 @Test void independentLookupUsesFullAcquisitionAndOnlyTheExactProductSection(){
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
  CostcoOfficialEvidenceFetcher fetcher=query->{assertThat(query.acquisition()).isEqualTo(CostcoOfficialEvidenceFetcher.Acquisition.FULL);return List.of(page,image);};
  assertThat(new OfficialImageCandidateFinder.CostcoOfficialSiteFinder(fetcher,store,new ObjectMapper()).find(costco12kg())).isEmpty();
 }
}
