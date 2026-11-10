package com.bobbuy.test;

import com.bobbuy.model.*;
import com.bobbuy.repository.RecommendationItemRepository;
import com.bobbuy.service.RecommendationFacts;
import com.bobbuy.service.RecommendationPublication;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.*;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Synthetic history/read fixtures only; new publication goes through authenticated MVC below. */
public final class RecommendationPublicationFixtures {
    private RecommendationPublicationFixtures() {}
    private static final ObjectMapper JSON=new ObjectMapper().findAndRegisterModules();
    public static void legacyPost(RecommendationPost post) {
        post.published=true;post.publishedAt=Instant.parse("2026-01-01T00:00:00Z");
        post.publisherId=post.merchantId;post.publisherName="Synthetic historical publisher";
    }
    /** Simulates V31's migrated old source row: no current-master/version claim is invented. */
    public static void legacyItem(RecommendationItem item,RecommendationPost post) {
        ObjectNode snapshot=JSON.valueToTree(RecommendationPublication.candidate(item,null));
        snapshot.put("legacy",true);snapshot.putNull("reviewHash");
        try{item.publicationSnapshot=JSON.treeToValue(snapshot,RecommendationPublicationSnapshot.class);}
        catch(Exception e){throw new AssertionError("Cannot build migrated history fixture",e);}
        item.publicationState="PUBLISHED";item.publishedAt=post.publishedAt;item.publishedBy=post.publisherId;
        item.publicationRequestId=null;item.publicationRequestHash=null;
    }
    /** A read-only unit fixture for an already reviewed master snapshot, never a publish/auth test. */
    public static void reviewedReadItem(RecommendationItem item,Product product,RecommendationPost post) {
        item.publicationSnapshot=RecommendationPublication.candidate(item,product);
        item.publicationState="PUBLISHED";item.publishedAt=post.publishedAt;item.publishedBy=post.publisherId;
    }
    private static JsonNode data(ObjectMapper json,ResultActions response)throws Exception {
        return json.readTree(response.andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).path("data");
    }
    private static ResultActions put(MockMvc mvc,ObjectMapper json,String path,Object value,String token)throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(path).header("Authorization","Bearer "+token).contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(value)));
    }
    private static String path(JsonNode detail){return "/api/merchant/recommendations/"+detail.at("/post/id").asLong();}
    /** Explicit synthetic reviewer inputs, exact source prices/windows retained; no direct publication writes. */
    public static ResultActions publishPending(MockMvc mvc,ObjectMapper json,RecommendationItemRepository items,JsonNode detail,String token)throws Exception {
        JsonNode current=detail;ResultActions result=null;var ids=new ArrayList<Long>();
        for(var row:detail.path("items"))if(!"PUBLISHED".equals(row.path("publicationState").asText()))ids.add(row.path("id").asLong());
        for(long id:ids){
            var original=items.findById(id).orElseThrow();String code=original.itemNumber;
            var context=original.referenceContext==null?new ReferenceOfferContext("SYNTHETIC","COSTCO_ONLINE","synthetic-pack","synthetic-publication-test","https://www.costco.co.jp/synthetic-source",null,null,false,null,true):original.referenceContext;
            String unit=original.priceUnit==null&&(original.referencePrice!=null||original.originalPrice!=null||original.discountAmount!=null)?"per synthetic pack":original.priceUnit;
            var facts=new RecommendationFacts(original.name,code,original.referencePrice,original.originalPrice,original.discountAmount,unit,original.offerStart,original.offerEnd,original.couponStart,original.couponEnd,original.offerNotes,context,null,null,null,original.specification);
            current=data(json,put(mvc,json,path(current)+"/items/"+id,Map.of("version",current.at("/post/version").asLong(),"facts",facts),token));
            var profile=data(json,mvc.perform(get("/api/merchant/product-catalog/"+original.productId).header("Authorization","Bearer "+token)));
            var input=(ObjectNode)profile.path("value").deepCopy();
            var names=(ObjectNode)input.path("name");String ja=names.path("ja-JP").asText(original.name);
            for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US"))if(names.path(locale).asText().isBlank()||(!locale.equals("ja-JP")&&names.path(locale).asText().endsWith("（"+ja+"）")))names.put(locale,locale.equals("ja-JP")?ja:"Synthetic reviewed "+code+" "+locale);
            var specs=(ObjectNode)input.path("specification");for(String locale:List.of("ja-JP","zh-CN","zh-TW","en-US"))if(specs.path(locale).asText().isBlank())specs.put(locale,Objects.toString(original.specification,"Synthetic pack specification"));
            if(input.path("categoryIds").isEmpty())input.set("categoryIds",json.valueToTree(original.categoryIds));
            if(input.path("supplierId").isNull()&&original.supplierId!=null)input.put("supplierId",original.supplierId);
            boolean verified=!input.path("gallery").isEmpty();for(var picture:input.path("gallery"))verified&=picture.path("url").asText().startsWith("/api/storefront/recommendation-images/")&&picture.path("sha256").asText().matches("[0-9a-f]{64}");
            if(!verified){
                // Distinct verified synthetic product image; never repurpose the original promotional evidence.
                var pixels=new java.awt.image.BufferedImage(3,3,java.awt.image.BufferedImage.TYPE_INT_RGB);pixels.setRGB(0,0,0x135799);
                var bytes=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(pixels,"png",bytes);byte[] image=bytes.toByteArray();
                var uploaded=data(json,mvc.perform(multipart("/api/merchant/product-catalog/"+original.productId+"/images").file(new MockMultipartFile("file","verified-synthetic-product.png","image/png",image)).header("Authorization","Bearer "+token).param("sourceUrl","https://www.costco.co.jp/synthetic-product").param("label","Synthetic product image").param("verified","true")));
                input.putArray("gallery").add(uploaded);
            }
            input.put("translationsReviewed",true);data(json,put(mvc,json,"/api/merchant/product-catalog",Map.of("rows",List.of(input),"reviewed",true),token));
            current=data(json,mvc.perform(get(path(current)).header("Authorization","Bearer "+token)));
            JsonNode review=null;for(var row:current.path("items"))if(row.path("id").asLong()==id)review=row;
            if(review==null||!review.path("publicationReviewHash").asText().matches("[0-9a-f]{64}"))throw new AssertionError("Missing actual reviewed publication input");
            result=mvc.perform(post(path(current)+"/items/"+id+"/publish").header("Authorization","Bearer "+token).contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("requestId",UUID.randomUUID(),"version",current.at("/post/version").asLong(),"productVersion",review.path("publicationProductVersion").asLong(),"sourceHash",review.path("publicationReviewHash").asText(),"reviewed",true))));
            current=data(json,result);
        }
        if(result!=null)return result;
        return mvc.perform(post(path(current)+"/publish").header("Authorization","Bearer "+token).contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(Map.of("version",current.at("/post/version").asLong()))));
    }
}
