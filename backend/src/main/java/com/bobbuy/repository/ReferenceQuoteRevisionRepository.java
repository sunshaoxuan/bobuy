package com.bobbuy.repository;
import com.bobbuy.model.ReferenceQuoteRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ReferenceQuoteRevisionRepository extends JpaRepository<ReferenceQuoteRevision,Long>{
 java.util.Optional<ReferenceQuoteRevision> findFirstByItemIdOrderByIdDesc(Long itemId);
 List<ReferenceQuoteRevision> findByMerchantIdAndItemIdOrderById(Long merchantId,Long itemId);
}
