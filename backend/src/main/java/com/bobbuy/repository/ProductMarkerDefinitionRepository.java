package com.bobbuy.repository;
import com.bobbuy.model.ProductMarkerDefinition;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ProductMarkerDefinitionRepository extends JpaRepository<ProductMarkerDefinition,String> {
 List<ProductMarkerDefinition> findByMerchantIdOrderBySortOrderAscIdAsc(Long merchantId);
 Optional<ProductMarkerDefinition> findByMerchantIdAndCode(Long merchantId,String code);
}
