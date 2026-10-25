package com.bobbuy.api;

import com.bobbuy.model.OrderHeader;
import com.bobbuy.model.OrderLine;
import com.bobbuy.model.OrderStatus;
import com.bobbuy.model.Trip;
import com.bobbuy.model.TripStatus;
import com.bobbuy.security.RoleInjectionFilter;
import com.bobbuy.service.BobbuyStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityAuthorizationIntegrationTest {

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private BobbuyStore store;

  private Long tripId;
  private Long ownOrderId;
  private Long otherOrderId;

  @BeforeEach
  void setUp() {
    store.seed();
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    tripId = trip.getId();

    OrderHeader ownOrder = new OrderHeader("LEDGER-CUST-OWN", 9001L, tripId);
    ownOrder.addLine(new OrderLine("SKU-OWN", "Own Item", null, 2, 10.0));
    ownOrder.setStatus(OrderStatus.CONFIRMED);
    ownOrderId = store.upsertOrder(ownOrder).getId();

    OrderHeader otherOrder = new OrderHeader("LEDGER-CUST-OTHER", 9002L, tripId);
    otherOrder.addLine(new OrderLine("SKU-OTHER", "Other Item", null, 1, 20.0));
    otherOrder.setStatus(OrderStatus.CONFIRMED);
    otherOrderId = store.upsertOrder(otherOrder).getId();
  }

  @Test
  void customerCanReadScopedLedgerOnly() throws Exception {
    mockMvc.perform(asCustomer(get("/api/procurement/{tripId}/ledger", tripId), "9001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(1))
        .andExpect(jsonPath("$.data[0].customerId").value(9001))
        .andExpect(jsonPath("$.data[0].businessId").value("LEDGER-CUST-OWN"));
  }

  @Test
  void customerCanConfirmOwnLedger() throws Exception {
    mockMvc.perform(asCustomer(post("/api/procurement/{tripId}/ledger/{businessId}/confirm", tripId, "LEDGER-CUST-OWN")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"action":"RECEIPT"}
                """), "9001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.receiptConfirmedBy").value("9001"));
  }

  @Test
  void customerCanReadOnlyOwnOrders() throws Exception {
    // Customer 9001 should only see their own order, not 9002's order
    mockMvc.perform(asCustomer(get("/api/orders").param("tripId", tripId.toString()), "9001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(1))
        .andExpect(jsonPath("$.data[0].customerId").value(9001))
        .andExpect(jsonPath("$.data[0].businessId").value("LEDGER-CUST-OWN"));
  }

  @Test
  void customerCanReadOwnOrderDetail() throws Exception {
    mockMvc.perform(asCustomer(get("/api/orders/{id}", ownOrderId), "9001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value(ownOrderId))
        .andExpect(jsonPath("$.data.customerId").value(9001));
  }

  @Test
  void customerCannotReadOtherCustomerOrderDetail() throws Exception {
    mockMvc.perform(asCustomer(get("/api/orders/{id}", otherOrderId), "9001"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
  }

  @Test
  void agentCanReadAnyOrderDetail() throws Exception {
    mockMvc.perform(asAgent(get("/api/orders/{id}", otherOrderId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value(otherOrderId))
        .andExpect(jsonPath("$.data.customerId").value(9002));
  }

  @Test
  void customerWithNoMatchingOrdersGetsEmptyList() throws Exception {
    // Customer 9999 has no orders in this trip
    mockMvc.perform(asCustomer(get("/api/orders").param("tripId", tripId.toString()), "9999"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(0));
  }

  @Test
  void customerWithUnrecognizedIdentityGetsEmptyList() throws Exception {
    // No X-BOBBUY-USER header → principal is "role-injected-customer" which is not a recognized format
    mockMvc.perform(get("/api/orders")
            .param("tripId", tripId.toString())
            .header(RoleInjectionFilter.ROLE_HEADER, "CUSTOMER"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(0));
  }

  @Test
  void agentCanReadAllOrdersWithoutFilter() throws Exception {
    // Agent should see both customer orders
    mockMvc.perform(asAgent(get("/api/orders").param("tripId", tripId.toString())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(2));
  }

  @Test
  void customerIsForbiddenFromBackofficeApisButCanReadOrders() throws Exception {
    mockMvc.perform(asCustomer(get("/api/procurement/{tripId}/hud", tripId), "9001"))
        .andExpect(status().isForbidden());

    mockMvc.perform(asCustomer(get("/api/financial/audit/{tripId}", tripId), "9001"))
        .andExpect(status().isForbidden());

    mockMvc.perform(asCustomer(get("/api/users"), "9001"))
        .andExpect(status().isForbidden());

    mockMvc.perform(asCustomer(get("/api/orders"), "9001"))
        .andExpect(status().isOk());

    mockMvc.perform(asCustomer(patch("/api/orders/{id}/status", 3000L)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"status":"CONFIRMED"}
                """), "9001"))
        .andExpect(status().isForbidden());
  }

  @Test
  void agentCanAccessKeyBackofficeApis() throws Exception {
    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/hud", tripId)))
        .andExpect(status().isOk());

    mockMvc.perform(asAgent(get("/api/financial/audit/{tripId}/check-integrity", tripId)))
        .andExpect(status().isOk());

    mockMvc.perform(asAgent(get("/api/users")))
        .andExpect(status().isOk());

    mockMvc.perform(asAgent(get("/api/orders")))
        .andExpect(status().isOk());

    mockMvc.perform(asAgent(patch("/api/orders/{id}/status", 3000L)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"status":"CONFIRMED"}
                """)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("CONFIRMED"));
  }

  private MockHttpServletRequestBuilder asCustomer(MockHttpServletRequestBuilder request, String user) {
    return request
        .header(RoleInjectionFilter.ROLE_HEADER, "CUSTOMER")
        .header(RoleInjectionFilter.USER_HEADER, user);
  }

  private MockHttpServletRequestBuilder asAgent(MockHttpServletRequestBuilder request) {
    return request
        .header(RoleInjectionFilter.ROLE_HEADER, "AGENT")
        .header(RoleInjectionFilter.USER_HEADER, "1000");
  }
}
