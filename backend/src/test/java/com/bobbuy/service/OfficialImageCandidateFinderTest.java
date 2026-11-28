package com.bobbuy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
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
}
