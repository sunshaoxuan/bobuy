package com.bobbuy.api;

import com.bobbuy.api.response.ApiMeta;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.model.AuditLog;
import com.bobbuy.service.AuditLogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/audit-logs")
public class AuditLogController {
  private final AuditLogService auditLogService;
  private final com.bobbuy.service.BobbuyStore store;

  public AuditLogController(AuditLogService auditLogService, com.bobbuy.service.BobbuyStore store) {
    this.auditLogService = auditLogService;
    this.store = store;
  }

  @GetMapping
  public ApiResponse<List<AuditLog>> list() {
    List<AuditLog> logs = auditLogService.listLogs().stream().filter(log ->
        switch (log.getEntityType()) {
          case "TRIP" -> store.getTrip(log.getEntityId()).isPresent();
          case "ORDER" -> store.getOrder(log.getEntityId()).isPresent();
          case "PRODUCT" -> store.getProduct(log.getProductId()).isPresent();
          default -> false;
        }).toList();
    return ApiResponse.success(logs, new ApiMeta(logs.size()));
  }
}
