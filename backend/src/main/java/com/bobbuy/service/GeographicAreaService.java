package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.GeographicArea;
import com.bobbuy.repository.GeographicAreaRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GeographicAreaService {
    private final GeographicAreaRepository areas;
    public GeographicAreaService(GeographicAreaRepository areas) { this.areas = areas; }

    /** Omit parentCode for countries; an existing leaf returns an empty list. */
    @Transactional(readOnly = true)
    public List<Area> children(String parentCode) {
        if (parentCode == null) return areas.findByParentCodeIsNullOrderByCodeAsc().stream().map(Area::of).toList();
        if (!parentCode.matches("[A-Z]{2}(?:-[0-9]{2}|-[0-9]{5})?")) {
            throw new ApiException(ErrorCode.INVALID_REQUEST, "error.validation.failed");
        }
        if (!areas.existsById(parentCode)) {
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.geographic_area.not_found");
        }
        return areas.findByParentCodeOrderByCodeAsc(parentCode).stream().map(Area::of).toList();
    }

    public record Area(String code, String parentCode, int level, String name, String reading) {
        static Area of(GeographicArea value) {
            return new Area(value.getCode(), value.getParentCode(), value.getLevel(), value.getName(), value.getReading());
        }
    }
}
