package com.bobbuy.repository;
import com.bobbuy.model.CurrencyDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CurrencyRepository extends JpaRepository<CurrencyDefinition,String> {}
