package com.bobbuy.repository;

import com.bobbuy.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, String> {
    // Internal scalar IDs only: normal ORM queries always exclude deleted products.
    @org.springframework.data.jpa.repository.Query(value="select id from bb_product where deleted_at is not null",nativeQuery=true)
    java.util.Set<String> deletedIds();
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from Product p where p.id=:id")
    Optional<Product> lockById(@org.springframework.data.repository.query.Param("id") String id);
    boolean existsByIdAndMerchantId(String id, Long merchantId);
    java.util.List<Product> findAllByMerchantIdAndItemNumber(Long merchantId, String itemNumber);
    java.util.List<Product> findAllByItemNumber(String itemNumber);
    // Ambiguous source variants require human selection; never pick an arbitrary row.
    default Optional<Product> findByMerchantIdAndItemNumber(Long merchantId, String itemNumber) {
        var matches=findAllByMerchantIdAndItemNumber(merchantId,itemNumber);
        return matches.size()==1?Optional.of(matches.get(0)):Optional.empty();
    }
    default Optional<Product> findByItemNumber(String itemNumber) {
        var matches=findAllByItemNumber(itemNumber);
        return matches.size()==1?Optional.of(matches.get(0)):Optional.empty();
    }
}
