// Task-owned synthetic runtime. Compile with backend target/test-classes and its dependency classpath.
// Hardcoded in-memory datasource and loopback binding: never point this at a business database.
import com.bobbuy.api.BobbuyApplication;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.test.RecommendationPublicationFixtures;
import org.springframework.boot.SpringApplication;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
public class PriceCorrectionRuntime {
 public static void main(String[] args) throws Exception {
  var ctx=SpringApplication.run(BobbuyApplication.class,"--server.address=127.0.0.1","--server.port=18080","--spring.datasource.url=jdbc:h2:mem:price-ui;MODE=PostgreSQL;DB_CLOSE_DELAY=-1","--spring.jpa.hibernate.ddl-auto=create-drop","--spring.flyway.enabled=false","--bobbuy.seed.enabled=true","--bobbuy.security.header-auth.enabled=false");
  var jdbc=ctx.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
  var sql=java.nio.file.Files.readString(java.nio.file.Path.of("backend/src/main/resources/db/migration/V30__costco_onboarding_jobs.sql")).replace("timestamptz","timestamp with time zone");
  for(var statement:sql.split(";"))if(!statement.isBlank())jdbc.execute(statement);
  var products=ctx.getBean(ProductRepository.class);var now=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
  var p=new Product();p.setId("price-ui-1495250");p.setMerchantId(1000L);p.setName(Map.of("zh-CN","合成椰子水 1L×9","zh-TW","合成椰子水 1L×9","en-US","Synthetic coconut water 1L × 9","ja-JP","合成ココナッツウォーター 1L×9"));p.setItemNumber("SYNTHETIC-1495250");p.setDescription(Map.of("en-US","Synthetic fixture for price corrections only","zh-CN","仅供本批价格纠错验收的合成商品"));p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);p.setOrderMethod(OrderMethod.PRE_ORDER);p.setCategoryId("cat-1000");p.setSale(new ProductSale(new BigDecimal("2998"),"JPY","盒",null,null,2,1000L,now,true));p.setMediaGallery(List.of(new MediaGalleryItem("/assets/products/milk.png",MediaType.IMAGE,Map.of("en-US","Synthetic placeholder"))));products.saveAndFlush(p);
  var nodes=ctx.getBean(CategoryTreeNodeRepository.class);nodes.save(new CategoryTreeNode("price-ui-drinks",null,Map.of("ja-JP","飲料","zh-CN","饮料","en-US","Drinks","zh-TW","飲料"),List.of("price-ui-drinks"),0,null));nodes.save(new CategoryTreeNode("price-ui-juice","price-ui-drinks",Map.of("ja-JP","ジュース","zh-CN","果汁","en-US","Juice","zh-TW","果汁"),List.of("price-ui-drinks","price-ui-juice"),0,null));ctx.getBean(ProductPrimaryCategoryPathRepository.class).save(new ProductPrimaryCategoryPath(p.getId(),"price-ui-juice"));
  var documents=ctx.getBean(ProductPriceAdjustmentRepository.class);
  for(int n=1;n<=2;n++){var d=new ProductPriceAdjustment();d.merchantId=1000L;d.currency="JPY";d.type=ProductPriceAdjustment.Type.PERMANENT;d.startsAt=now.minusSeconds(86400*(3-n));d.status=ProductPriceAdjustment.Status.APPROVED;d.documentNumber="PC-SYNTHETIC-"+(n==1?"FIRST":"SECOND");d.sourceNote="Synthetic regular confirmation "+n;d.createdBy=1000L;d.updatedBy=1000L;d.approvedBy=1000L;d.createdAt=d.startsAt;d.updatedAt=d.startsAt;d.approvedAt=d.startsAt;var l=new ProductPriceAdjustmentLine();l.document=d;l.productId=p.getId();l.amount=new BigDecimal("2998");l.beforeAmount=n==1?null:l.amount;l.unit="盒";d.lines.add(l);if(n==2&&Arrays.asList(args).contains("--after-cancel")){d.status=ProductPriceAdjustment.Status.CANCELLED;d.cancelledAt=now;d.cancelledBy=1000L;d.cancellationReason="Synthetic duplicate regular confirmation withdrawn (resumed fixture)";}documents.saveAndFlush(d);}
  var post=new RecommendationPost();post.merchantId=1000L;post.title="Synthetic price correction reference";RecommendationPublicationFixtures.legacyPost(post);ctx.getBean(RecommendationPostRepository.class).saveAndFlush(post);
  var item=new RecommendationItem();item.postId=post.id;item.productId=p.getId();item.name="合成ココナッツウォーター 1L×9";item.itemNumber=p.getItemNumber();item.imageHash="a".repeat(64);item.imageUrl="/assets/products/milk.png";item.gallery=new ArrayList<>(List.of(new RecommendationItem.Picture("synthetic",item.imageUrl,item.imageHash,null,null,null,null)));item.translations.put("zh-CN",new RecommendationItem.Text("合成椰子水 1L×9","1L×9","合成验收商品",null));item.translations.put("en-US",new RecommendationItem.Text("Synthetic coconut water 1L × 9","1L × 9","Synthetic fixture",null));item.translatedSource=item.getTranslationSource();RecommendationPublicationFixtures.legacyItem(item,post);ctx.getBean(RecommendationItemRepository.class).saveAndFlush(item);
  System.out.println("PRICING_CLASS_SOURCE="+com.bobbuy.service.ProductPricingService.class.getProtectionDomain().getCodeSource().getLocation());
  System.out.println("SYNTHETIC_PRICE_RUNTIME_READY");
 }
}
