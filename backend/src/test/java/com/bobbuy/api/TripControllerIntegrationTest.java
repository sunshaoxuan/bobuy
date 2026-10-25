package com.bobbuy.api;

import com.bobbuy.model.OrderHeader;
import com.bobbuy.model.OrderLine;
import com.bobbuy.model.OrderStatus;
import com.bobbuy.model.Trip;
import com.bobbuy.model.TripStatus;
import com.bobbuy.security.RoleInjectionFilter;
import com.bobbuy.service.BobbuyStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class TripControllerIntegrationTest {
  private static final String AGENT_ROLE = "AGENT";
  private static final String AGENT_USER = "1000";

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private BobbuyStore store;

  @Autowired
  private ObjectMapper objectMapper;

  @BeforeEach
  void setUp() {
    store.seed();
  }

  @Test
  void bulkUpdateTripOrdersStatus() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    for (int i = 0; i < 10; i++) {
      OrderHeader header = new OrderHeader("BULK-" + i, 1001L, trip.getId());
      header.addLine(new OrderLine("SKU-" + i, "Item " + i, null, 1, 10.0));
      store.upsertOrder(header);
    }

    String payload = objectMapper.writeValueAsString(Map.of("targetStatus", "CONFIRMED"));

    mockMvc.perform(patch("/api/trips/{tripId}/orders/bulk-status", trip.getId())
            .header(RoleInjectionFilter.ROLE_HEADER, AGENT_ROLE)
            .header(RoleInjectionFilter.USER_HEADER, AGENT_USER)
            .contentType(MediaType.APPLICATION_JSON)
            .content(payload))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.length()").value(10));

    assertThat(store.listOrders(trip.getId()))
        .allMatch(order -> order.getStatus() == OrderStatus.CONFIRMED);
    assertThat(store.getTrip(trip.getId()).orElseThrow().getStatus()).isEqualTo(TripStatus.PUBLISHED);
  }

  @Test
  void createUsesSignedInMerchantAndRejectsLegacyControls() throws Exception {
    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/trips")
        .header(RoleInjectionFilter.ROLE_HEADER, AGENT_ROLE).header(RoleInjectionFilter.USER_HEADER, AGENT_USER)
        .contentType(MediaType.APPLICATION_JSON).content("{\"deliveryArea\":\" Shanghai region \",\"deliveryDate\":\"2026-11-01\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.agentId").value(1000))
        .andExpect(jsonPath("$.data.deliveryArea").value("Shanghai region"))
        .andExpect(jsonPath("$.data.status").value("PUBLISHED"))
        .andExpect(jsonPath("$.data.capacity").doesNotExist())
        .andExpect(jsonPath("$.data.origin").doesNotExist());
    for (String field : new String[]{"agentId", "status", "capacity", "origin", "destination", "departDate", "reservedCapacity"}) {
      mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/trips")
          .header(RoleInjectionFilter.ROLE_HEADER, AGENT_ROLE).header(RoleInjectionFilter.USER_HEADER, AGENT_USER)
          .contentType(MediaType.APPLICATION_JSON)
          .content("{\"deliveryArea\":\"Area\",\"deliveryDate\":\"2026-11-01\",\"" + field + "\":\"ignored\"}"))
          .andExpect(status().isBadRequest());
    }
  }

  @Test
  void anotherMerchantCannotEditTripAndCustomerCannotCreate() throws Exception {
    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/trips/2000")
        .header(RoleInjectionFilter.ROLE_HEADER, AGENT_ROLE).header(RoleInjectionFilter.USER_HEADER, "9999")
        .contentType(MediaType.APPLICATION_JSON).content("{\"deliveryArea\":\"Other\",\"deliveryDate\":\"2026-11-01\"}"))
        .andExpect(status().isForbidden());
    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/trips")
        .header(RoleInjectionFilter.ROLE_HEADER, "CUSTOMER").header(RoleInjectionFilter.USER_HEADER, "1001")
        .contentType(MediaType.APPLICATION_JSON).content("{\"deliveryArea\":\"Other\",\"deliveryDate\":\"2026-11-01\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void procurementListAggregatesItems() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    OrderHeader first = new OrderHeader("PROC-1", 1001L, trip.getId());
    first.addLine(new OrderLine("SKU-1", "Item A", null, 2, 10.0));
    store.upsertOrder(first);
    OrderHeader second = new OrderHeader("PROC-2", 1001L, trip.getId());
    second.addLine(new OrderLine("SKU-1", "Item A", null, 3, 10.0));
    store.upsertOrder(second);

    mockMvc.perform(patch("/api/trips/{tripId}/orders/bulk-status", trip.getId())
            .header(RoleInjectionFilter.ROLE_HEADER, AGENT_ROLE)
            .header(RoleInjectionFilter.USER_HEADER, AGENT_USER)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of("targetStatus", "CONFIRMED"))))
        .andExpect(status().isOk());

    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
            "/api/trips/{tripId}/procurement-list", trip.getId())
            .header(RoleInjectionFilter.ROLE_HEADER, AGENT_ROLE)
            .header(RoleInjectionFilter.USER_HEADER, AGENT_USER))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].skuId").value("SKU-1"))
        .andExpect(jsonPath("$.data[0].totalQuantity").value(5))
        .andExpect(jsonPath("$.data[0].purchasedQuantity").value(0))
        .andExpect(jsonPath("$.data[0].unitPrice").value(10.0))
        .andExpect(jsonPath("$.data[0].businessIds[0]").value("PROC-1"))
        .andExpect(jsonPath("$.data[0].businessIds[1]").value("PROC-2"));
  }
  @Test
  void manualTripStatusEndpointIsRemoved() throws Exception {
    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/trips/2000/status")
        .header(RoleInjectionFilter.ROLE_HEADER, AGENT_ROLE).header(RoleInjectionFilter.USER_HEADER, AGENT_USER)
        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content("{\"status\":\"COMPLETED\"}"))
        .andExpect(status().isNotFound());
  }

}
