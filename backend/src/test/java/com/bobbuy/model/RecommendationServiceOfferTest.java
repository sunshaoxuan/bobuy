package com.bobbuy.model;

import com.bobbuy.api.response.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class RecommendationServiceOfferTest {
 private final ObjectMapper json=new ObjectMapper().findAndRegisterModules();
 private ObjectNode legacy(){
  var n=json.createObjectNode();n.put("sourceUrl","https://example.invalid/service");n.put("sourceText","Synthetic source");n.put("provider","Synthetic provider");n.put("staff",2);n.put("hours",3);n.put("price",26400);n.put("originalPrice",31020);n.put("currency","JPY");n.put("taxIncluded",true);n.put("noExtraFees",false);n.put("applicationEnd","2026-11-30");n.put("serviceEnd","2026-12-11");n.put("costsReviewed",true);n.put("windowsReviewed",true);n.put("reviewed",true);
  var fee=n.putArray("fees").addObject();fee.put("key","transport");fee.put("amount",990);var descriptions=fee.putObject("descriptions");var terms=n.putObject("terms");
  for(String l:RecommendationServiceOffer.LOCALES){descriptions.put(l,l+" transport condition");var t=terms.putObject(l);t.put("title",l+" service");t.put("description",l+" description");t.put("eligibility",l+" Executive only");t.put("regions",l+" limited area");t.put("restrictions",l+" reviewed restrictions");t.put("cancellation",l+" cancellation conditions");t.putArray("benefits");}return n;
 }
 private ObjectNode packages(){
  var n=legacy();n.put("basis","TASK_PACKAGES");for(String key:new String[]{"staff","hours","price","originalPrice"})n.putNull(key);
  var options=n.putArray("packages");int index=0;for(int amount:new int[]{64900,89100,35200,30080}){var p=options.addObject();p.put("key","package-"+index++);p.put("price",amount);p.putNull("originalPrice");var terms=p.putObject("terms");for(String l:RecommendationServiceOffer.LOCALES){var t=terms.putObject(l);t.put("name",l+" package "+index);t.put("scope",l+" independent scope");}}
  var fee=(ObjectNode)n.at("/fees/0");fee.put("kind","CONDITIONAL");fee.putNull("amount");for(String l:RecommendationServiceOffer.LOCALES)((ObjectNode)fee.path("descriptions")).put(l,l+" 20% or range / per-area; jet surcharge unknown");return n;
 }
 private RecommendationServiceOffer normalized(ObjectNode n)throws Exception{return json.treeToValue(n,RecommendationServiceOffer.class).normalized();}
 @Test void legacyJsonStillReadsAndWritesWithoutNewBranchFields()throws Exception{
  var old=normalized(legacy());var value=json.valueToTree(old);assertThat(value.has("basis")).isFalse();assertThat(value.has("packages")).isFalse();assertThat(value.at("/fees/0").has("kind")).isFalse();assertThat(normalized((ObjectNode)value)).isEqualTo(old);assertThat(old.effectiveBasis()).isEqualTo(RecommendationServiceOffer.Basis.STAFF_HOURS);
 }
 @Test void independentPackagePricesRemainIndependentAndPrivateSourceIsRemoved()throws Exception{
  var offer=normalized(packages());assertThat(offer.staff()).isNull();assertThat(offer.hours()).isNull();assertThat(offer.price()).isNull();assertThat(offer.originalPrice()).isNull();assertThat(offer.packages()).extracting(p->p.price().intValueExact()).containsExactly(64900,89100,35200,30080);assertThat(offer.packages()).allMatch(p->p.originalPrice()==null);assertThat(offer.publicView().sourceText()).isNull();assertThat(offer.publicView().sourceUrl()).isNull();assertThat(offer.publicView().packages()).isEqualTo(offer.packages());assertThat(offer.sourceHash()).isEqualTo(normalized(legacy()).sourceHash());
 }
 @Test void articleHandlesNullHoursPriceAndConditionalAmountsInEveryLocale()throws Exception{
  var offer=normalized(packages());for(String locale:RecommendationServiceOffer.LOCALES){var article=offer.article(locale);assertThat(article).contains("JPY 64900","JPY 89100","JPY 35200","JPY 30080","20% or range").doesNotContain("null","JPY 81510","JPY 111210","JPY 0");if(locale.equals("en-US"))assertThat(article).doesNotContain("Staff / hours");}
 }
 @Test void packageModeRejectsUnifiedAmountsAndMissingOrDuplicateOptions(){
  for(String key:new String[]{"staff","hours","price","originalPrice"}){var n=packages();n.put(key,1);assertThatThrownBy(()->normalized(n)).isInstanceOf(ApiException.class);}
  var empty=packages();empty.putArray("packages");assertThatThrownBy(()->normalized(empty)).isInstanceOf(ApiException.class);
  var duplicate=packages();((ObjectNode)duplicate.at("/packages/1")).put("key","package-0");assertThatThrownBy(()->normalized(duplicate)).isInstanceOf(ApiException.class);
  var translation=packages();((ObjectNode)translation.at("/packages/0/terms")).remove("zh-TW");assertThatThrownBy(()->normalized(translation)).isInstanceOf(ApiException.class);
  var price=packages();((ObjectNode)price.at("/packages/0")).putNull("price");assertThatThrownBy(()->normalized(price)).isInstanceOf(ApiException.class);
 }
 @Test void conditionalAmountCannotBeZeroAndFixedFeeCannotBeUnknown(){
  var n=packages();((ObjectNode)n.at("/fees/0")).put("amount",0);assertThatThrownBy(()->normalized(n)).isInstanceOf(ApiException.class);
  var fixed=packages();((ObjectNode)fixed.at("/fees/0")).put("kind","FIXED");assertThatThrownBy(()->normalized(fixed)).isInstanceOf(ApiException.class);
  var old=legacy();((ObjectNode)old.at("/fees/0")).put("kind","CONDITIONAL");((ObjectNode)old.at("/fees/0")).putNull("amount");assertThatThrownBy(()->normalized(old)).isInstanceOf(ApiException.class);
 }
 @Test void staffHoursAndReviewRequirementsRemainStrict(){
  for(String key:new String[]{"staff","hours","price"}){var n=legacy();n.putNull(key);assertThatThrownBy(()->normalized(n)).isInstanceOf(ApiException.class);}
  var review=packages();review.put("costsReviewed",false);assertThatThrownBy(()->normalized(review)).isInstanceOf(ApiException.class);
  var date=packages();date.put("applicationEnd","2027-01-01");assertThatThrownBy(()->normalized(date)).isInstanceOf(ApiException.class);
 }
 @Test void unknownTypesAndForgedNestedFieldsAreRejected(){
  var basis=packages();basis.put("basis","OTHER");assertThatThrownBy(()->normalized(basis)).isInstanceOf(Exception.class);
  var fee=packages();((ObjectNode)fee.at("/fees/0")).put("kind","PERCENT_AUTO_TOTAL");assertThatThrownBy(()->normalized(fee)).isInstanceOf(Exception.class);
  var forged=packages();((ObjectNode)forged.at("/packages/0")).put("productId","fake");assertThatThrownBy(()->normalized(forged)).isInstanceOf(Exception.class);
 }
}
