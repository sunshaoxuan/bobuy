package com.bobbuy.service;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.io.support.ResourcePropertySource;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.*;

@EnabledIfEnvironmentVariable(named="BOBBUY_OFFICIAL_RESEARCH_PROBE",matches="true")
class ExistingOfficialResearchManualTest {
 @Test void exactOfficialSearchWithExistingEncryptedSearchCredential() throws Exception {
  ((ch.qos.logback.classic.LoggerContext)org.slf4j.LoggerFactory.getILoggerFactory()).reset();
  var receipt=new LinkedHashMap<String,Object>();receipt.put("scope","Real HTTPS search/official lookup only; no content writes, no alternative route after access refusal");
  try(var context=new AnnotationConfigApplicationContext()){
   context.getEnvironment().getPropertySources().addLast(new ResourcePropertySource("classpath:application-ai-hermes.properties"));
   var placeholders=new org.springframework.context.support.PropertySourcesPlaceholderConfigurer();placeholders.setEnvironment(context.getEnvironment());context.addBeanFactoryPostProcessor(placeholders);
   context.register(AiSearchService.class);context.refresh();
   var search=context.getBean(AiSearchService.class);receipt.put("existingSearchCredentialConfigured",search.officialSearchConfigured());
   receipt.put("initializationStatus",search.initializationStatus());
   if("saved-page".equals(System.getenv("BOBBUY_OFFICIAL_RESEARCH_MODE"))){var product=OfficialProductResearch.parse(java.nio.file.Files.readString(Path.of(System.getenv("BOBBUY_OFFICIAL_RESEARCH_SAVED_PAGE"))),"https://www.costco.co.jp/Kirkland-Signature/Kirkland-Signature-Womens-Media-Jacket/p/7771788","7771788",new ObjectMapper());org.junit.jupiter.api.Assertions.assertNotNull(product);org.junit.jupiter.api.Assertions.assertEquals(5,product.images().size());receipt.put("product",product);receipt.put("result","SAVED_PUBLIC_PAGE_PARSE_PASS_NO_NETWORK");new ObjectMapper().writeValue(Path.of(System.getenv("BOBBUY_OFFICIAL_RESEARCH_RECEIPT")).toFile(),receipt);return;}
   if("diagnosis".equals(System.getenv("BOBBUY_OFFICIAL_RESEARCH_MODE"))){receipt.put("result","CONFIGURATION_DIAGNOSIS_ONLY_NO_NETWORK");new ObjectMapper().writeValue(Path.of(System.getenv("BOBBUY_OFFICIAL_RESEARCH_RECEIPT")).toFile(),receipt);return;}
   boolean known="known-url".equals(System.getenv("BOBBUY_OFFICIAL_RESEARCH_MODE"));receipt.put("knownOfficialUrlOnly",known);
   if(search.officialSearchConfigured()||known)try{var reader=new OfficialProductResearch(search,new ObjectMapper()){
    @Override protected String get(java.net.URI uri,int limit){String html=super.get(uri,limit);if(known)try{java.nio.file.Files.writeString(Path.of(System.getenv("BOBBUY_OFFICIAL_RESEARCH_RECEIPT")).resolveSibling("known-official-page.html"),html);}catch(Exception ignored){}return html;}};
    var rows=reader.find("7771788",known?"https://www.costco.co.jp/Kirkland-Signature/Kirkland-Signature-Womens-Media-Jacket/p/7771788":null);receipt.put("products",rows);receipt.put("verifiedProducts",rows.size());receipt.put("result",rows.isEmpty()?"NO_VERIFIED_MATCH":"PASS");}
   catch(OfficialProductResearch.AccessFailure error){receipt.put("result","ACCESS_REFUSED_STOPPED");receipt.put("httpStatus",error.status());receipt.put("target",error.target());}
   catch(Exception error){receipt.put("result","FAILED");receipt.put("errorType",error.getClass().getSimpleName());}
   else receipt.put("result","EXISTING_SEARCH_CREDENTIAL_UNAVAILABLE");
  }
  new ObjectMapper().writeValue(Path.of(System.getenv("BOBBUY_OFFICIAL_RESEARCH_RECEIPT")).toFile(),receipt);
 }
}
