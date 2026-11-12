package com.bobbuy.repository;

import com.bobbuy.model.GeographicArea;
import java.util.List;
import org.springframework.data.repository.Repository;

public interface GeographicAreaRepository extends Repository<GeographicArea, String> {
    boolean existsById(String code);
    List<GeographicArea> findByParentCodeIsNullOrderByCodeAsc();
    List<GeographicArea> findByParentCodeOrderByCodeAsc(String parentCode);
}
