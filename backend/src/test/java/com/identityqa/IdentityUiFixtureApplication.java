package com.identityqa;
import com.bobbuy.api.BobbuyApplication;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.*;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.*;
import org.springframework.web.servlet.config.annotation.*;
import org.springframework.web.bind.annotation.*;
import javax.sql.DataSource;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;

/** Test-classpath-only real-browser fixture. Never packaged in the production application. */
public class IdentityUiFixtureApplication {
 public static void main(String[] args){new SpringApplicationBuilder(BobbuyApplication.class,Fixture.class,Picture.class).run(args);}
 @Configuration static class Fixture implements WebMvcConfigurer {
  @Override public void addViewControllers(ViewControllerRegistry registry){for(String route:List.of("/login","/admin","/admin/products","/admin/recommendations","/admin/orders"))registry.addViewController(route).setViewName("forward:/index.html");}
  @Bean ApplicationRunner syntheticIdentityData(DataSource dataSource,BobbuyStore store,ProductRepository products,RecommendationPostRepository posts,RecommendationItemRepository items){return args->{
   try(var c=dataSource.getConnection()){if(!c.getMetaData().getURL().startsWith("jdbc:h2:mem:identity_ui"))throw new IllegalStateException("Fixture requires the isolated identity_ui memory database");}
   store.seed();
   for(boolean canonical:List.of(false,true)){
    String key=canonical?"qa-canonical":"qa-legacy";var p=new Product();p.setId(key);p.setMerchantId(1000L);p.setItemNumber(canonical?"QA-002":"QA-001");p.setBrand("QA Brand");p.setBasePrice(123);p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);
    p.setName(Map.of("ja-JP",canonical?"合成コーヒーB":"合成コーヒーA","zh-CN",canonical?"合成咖啡B":"合成咖啡A","zh-TW",canonical?"合成咖啡B":"合成咖啡A","en-US",canonical?"Synthetic Coffee B":"Synthetic Coffee A"));
    p.setDescription(Map.of("ja-JP","本地合成测试资料，非真实商品。","zh-CN","本地合成测试资料，非真实商品。","zh-TW","本機合成測試資料，非真實商品。","en-US","Local synthetic QA fixture, not a real product."));
    var media=new MediaGalleryItem("/api/storefront/identity-qa-product.svg",MediaType.IMAGE,Map.of("ja-JP","SYNTHETIC TEST FIXTURE"),true,"https://example.invalid/synthetic-original.svg","example.invalid","SYNTHETIC_FIXTURE");p.setMediaGallery(List.of(media));
    if(canonical){p.setCatalogData(new ProductCatalogData(Map.of("ja-JP","80g×2袋","zh-CN","80克×2袋","zh-TW","80克×2袋","en-US","80 g x 2 packs"),"QA-MODEL-B","80 g x 2 packs",List.of(),null,null,1000L,Instant.parse("2026-01-01T00:00:00Z")));var d=p.getCatalogData();p.setCatalogData(new ProductCatalogData(d.specification(),d.model(),d.packaging(),d.categoryIds(),null,ProductCatalogService.sourceHash(p),d.reviewedBy(),d.reviewedAt()));}
    products.saveAndFlush(p);
    for(int n=0;n<2;n++){var post=new RecommendationPost();post.merchantId=1000L;post.title="SYNTHETIC QA issue "+key+"-"+n;post=posts.saveAndFlush(post);var item=new RecommendationItem();item.postId=post.id;item.productId=key;item.name="Synthetic original source";item.itemNumber=p.getItemNumber();item.specification="80 g x 2 packs";item.referencePrice=BigDecimal.valueOf(300+n);com.bobbuy.test.PriceDocumentFixtures.start(item,LocalDate.of(2026,11,6));com.bobbuy.test.PriceDocumentFixtures.end(item,LocalDate.of(2026,11,8));item.imageHash=UUID.randomUUID().toString();item.imageUrl="/api/storefront/identity-qa-product.svg";items.saveAndFlush(item);}
   }
   System.out.println("IDENTITY_QA_READY: isolated synthetic qa-legacy and qa-canonical, two source references each; no production data");
  };}
 }
 @RestController static class Picture {
  @GetMapping(value="/api/storefront/identity-qa-product.svg",produces="image/svg+xml") String picture(){return "<svg xmlns='http://www.w3.org/2000/svg' width='480' height='480' viewBox='0 0 480 480'><rect width='480' height='480' fill='#eee9e2'/><rect x='110' y='80' width='260' height='320' rx='20' fill='#a9b8a0'/><text x='240' y='210' text-anchor='middle' font-size='24'>SYNTHETIC QA</text><text x='240' y='260' text-anchor='middle' font-size='22'>80 g x 2 packs</text><text x='240' y='320' text-anchor='middle' font-size='18'>NOT A REAL PRODUCT</text></svg>";}
 }
}
