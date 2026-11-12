package com.bobbuy.repository;
import com.bobbuy.model.ProductPriceAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ProductPriceAdjustmentRepository extends JpaRepository<ProductPriceAdjustment,Long> {
 @org.springframework.data.jpa.repository.Query("select count(l)>0 from ProductPriceAdjustmentLine l where l.productId=:productId")
 boolean existsByProductId(@org.springframework.data.repository.query.Param("productId") String productId);
 @org.springframework.data.jpa.repository.Query("select distinct d from ProductPriceAdjustment d join d.lines l where l.productId=:productId order by d.createdAt desc,d.id desc")
 List<ProductPriceAdjustment> findByProductIdOrderByCreatedAtDescIdDesc(@org.springframework.data.repository.query.Param("productId") String productId);
 @org.springframework.data.jpa.repository.Query("select distinct d from ProductPriceAdjustment d left join fetch d.lines where d.merchantId=:merchantId order by d.createdAt desc,d.id desc")
 List<ProductPriceAdjustment> findByMerchantIdOrderByCreatedAtDescIdDesc(@org.springframework.data.repository.query.Param("merchantId") Long merchantId);
 java.util.Optional<ProductPriceAdjustment> findByMerchantIdAndSourceKey(Long merchantId,String sourceKey);
 @org.springframework.data.jpa.repository.Query("select distinct d from ProductPriceAdjustment d join d.lines l where l.referenceItemId=:itemId order by d.createdAt desc,d.id desc")
 List<ProductPriceAdjustment> forReferenceItem(@org.springframework.data.repository.query.Param("itemId") Long itemId);
 @org.springframework.data.jpa.repository.Query("select distinct d from ProductPriceAdjustment d join fetch d.lines l where l.referenceItemId in :ids order by d.createdAt desc,d.id desc")
 List<ProductPriceAdjustment> forReferences(@org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids);
 @org.springframework.data.jpa.repository.Query("select distinct d from ProductPriceAdjustment d join fetch d.lines l where l.productId in :ids order by d.createdAt desc,d.id desc")
 List<ProductPriceAdjustment> forProducts(@org.springframework.data.repository.query.Param("ids") java.util.Collection<String> ids);
}
