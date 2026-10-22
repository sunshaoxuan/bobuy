package com.bobbuy.repository;
import com.bobbuy.model.MerchantCustomer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface MerchantCustomerRepository extends JpaRepository<MerchantCustomer, String> {
    List<MerchantCustomer> findByMerchantId(Long merchantId);
}
