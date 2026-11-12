package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.GeographicAreaService;
import java.util.List;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GeographicAreaController {
    private final GeographicAreaService areas;
    public GeographicAreaController(GeographicAreaService areas) { this.areas = areas; }

    @GetMapping({"/api/storefront/geographic-areas", "/api/merchant/geographic-areas"})
    public ApiResponse<List<GeographicAreaService.Area>> list(@RequestParam(required = false) String parentCode) {
        return ApiResponse.success(areas.children(parentCode));
    }

    /** The shared exception handler maps unsupported verbs to 500; keep this reference API explicitly read-only. */
    @RequestMapping(value = {"/api/storefront/geographic-areas", "/api/merchant/geographic-areas"},
        method = {RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE})
    public ResponseEntity<Void> readOnly() {
        return ResponseEntity.status(405).allow(HttpMethod.GET).build();
    }
}
