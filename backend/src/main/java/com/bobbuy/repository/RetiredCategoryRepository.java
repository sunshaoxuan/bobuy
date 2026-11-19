package com.bobbuy.repository;
import com.bobbuy.model.RetiredCategory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface RetiredCategoryRepository extends JpaRepository<RetiredCategory,String> {
 List<RetiredCategory> findByMerchantId(Long merchantId);
}
