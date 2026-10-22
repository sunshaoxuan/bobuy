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
    Trip trip = store.createTrip(new Trip(null, 1000L, "HK", "NY", LocalDate.now(), 20, 0, TripStatus.DRAFT, null));
    for (int i = 0; i < 10; i++) {
      OrderHeader header = new OrderHeader("BULK-" + i, 1001L, trip.getId());
      header.addLine(new OrderLine("SKU-" + i, "Item " + i, null, 1, 10.0));
      store.upsertOrder(header);
    }

    int reservedBefore = store.getTrip(trip.getId()).orElseThrow().getReservedCapacity();
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
    int reservedAfter = store.getTrip(trip.getId()).orElseThrow().getReservedCapacity();
    assertThat(reservedAfter).isEqualTo(reservedBefore + 10);
  }

  @Test
  void procurementListAggregatesItems() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "HK", "NY", LocalDate.now(), 20, 0, TripStatus.DRAFT, null));
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
}
