package com.bobbuy.service;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class OfficialProductResearchTest {
 String url="https://www.costco.co.jp/Verified-Product/p/00123";
 String html(String sku){return "<script type=\"application/ld+json\">{\"@type\":\"Product\",\"sku\":\""+sku+"\",\"name\":\"Verified exact SKU\",\"image\":[\"https://www.costco.co.jp/medias/sys_master/images/front.jpg\",\"https://www.costco.co.jp/medias/sys_master/images/back.jpg\",\"https://evil.test/other.jpg\"]}</script>";}
 @Test void exactStructuredSkuAndAllSafeImagesOnly(){var result=OfficialProductResearch.parse(html("00123"),url,"00123",new ObjectMapper());assertNotNull(result);assertEquals(2,result.images().size());assertEquals("00123",result.itemNumber());}
 @Test void costcoLowercaseProductSchemaIsAccepted(){assertNotNull(OfficialProductResearch.parse(html("00123").replace("\"Product\"","\"product\""),url,"00123",new ObjectMapper()));}
 @Test void collectsOriginalAnglesOnlyFromMatchingPrimaryGallery(){
  String gallery="<div class='primary-image'><div><sip-media format='product'><img src='/medias/sys_master/images/thumb.jpg'></sip-media>";
  for(String angle:new String[]{"front","back","side"})gallery+="<sip-media format='zoom'><picture><img alt='Verified exact SKU' src='/medias/sys_master/images/"+angle+".jpg'></picture></sip-media>";
  gallery+="<sip-media format='zoom'><img alt='Other variant' src='/medias/sys_master/images/wrong.jpg'></sip-media></div></div>";
  gallery+="<div class='recommendations'><sip-media format='zoom'><img alt='Verified exact SKU' src='/medias/sys_master/images/related.jpg'></sip-media></div>";
  var result=OfficialProductResearch.parse(html("00123")+gallery,url,"00123",new ObjectMapper());
  assertEquals(java.util.List.of("https://www.costco.co.jp/medias/sys_master/images/front.jpg","https://www.costco.co.jp/medias/sys_master/images/back.jpg","https://www.costco.co.jp/medias/sys_master/images/side.jpg"),result.images());
 }
 @Test void neverGuessesSkuFromPathNameOrImage(){assertNull(OfficialProductResearch.parse(html("99999"),url,"00123",new ObjectMapper()));}
 @Test void relatedStructuredSkuCannotBeUsedAsThePageProduct(){assertNull(OfficialProductResearch.parse(html("00123"),"https://www.costco.co.jp/Other/p/99999","00123",new ObjectMapper()));}
 @Test void noProductGroupVariantsOrUntrustedHosts(){assertNull(OfficialProductResearch.parse(html("00123").replace("\"Product\"","\"ProductGroup\""),url,"00123",new ObjectMapper()));assertThrows(Exception.class,()->OfficialProductResearch.pageUri("https://www.costco.co.jp.evil.test/p/00123"));assertThrows(Exception.class,()->OfficialProductResearch.pageUri("http://www.costco.co.jp/p/00123"));assertThrows(Exception.class,()->OfficialProductResearch.imageUri("https://www.costco.co.jp/medias/sys_master/images/a.jpg?tracking=1"));}
}
