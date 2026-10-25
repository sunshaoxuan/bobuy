package com.bobbuy.api;

import com.bobbuy.model.OrderHeader;
import com.bobbuy.model.OrderLine;
import com.bobbuy.model.OrderStatus;
import com.bobbuy.model.Trip;
import com.bobbuy.model.TripStatus;
import com.bobbuy.security.RoleInjectionFilter;
import com.bobbuy.service.BobbuyStore;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "bobbuy.security.header-auth.enabled=false")
@AutoConfigureMockMvc
class SecurityAuthorizationProductionModeIntegrationTest {

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private BobbuyStore store;

  @Autowired
  private ObjectMapper objectMapper;

  private Long tripId;

  @BeforeEach
  void setUp() {
    store.seed();
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    tripId = trip.getId();

    OrderHeader ownOrder = new OrderHeader("PROD-CUST-OWN", 1001L, tripId);
    ownOrder.addLine(new OrderLine("SKU-OWN", "Own Item", null, 2, 10.0));
    ownOrder.setStatus(OrderStatus.CONFIRMED);
    store.upsertOrder(ownOrder);

    OrderHeader otherOrder = new OrderHeader("PROD-CUST-OTHER", 9002L, tripId);
    otherOrder.addLine(new OrderLine("SKU-OTHER", "Other Item", null, 1, 20.0));
    otherOrder.setStatus(OrderStatus.CONFIRMED);
    store.upsertOrder(otherOrder);
  }

  @Test
  void unauthenticatedProtectedApiReturns401() throws Exception {
    mockMvc.perform(get("/api/orders"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void forgedHeaderCannotElevateWithoutBearerToken() throws Exception {
    mockMvc.perform(get("/api/users")
            .header(RoleInjectionFilter.ROLE_HEADER, "AGENT")
            .header(RoleInjectionFilter.USER_HEADER, "1000"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void customerBearerTokenStillCannotAccessAgentOnlyApiEvenWithForgedHeader() throws Exception {
    String token = login("customer", "customer-pass");

    mockMvc.perform(get("/api/users")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
            .header(RoleInjectionFilter.ROLE_HEADER, "AGENT")
            .header(RoleInjectionFilter.USER_HEADER, "1000"))
        .andExpect(status().isForbidden());
  }

  @Test
  void customerBearerTokenCanOnlyReadOwnOrders() throws Exception {
    String token = login("customer", "customer-pass");

    mockMvc.perform(get("/api/orders")
            .param("tripId", tripId.toString())
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(1))
        .andExpect(jsonPath("$.data[0].customerId").value(1001))
        .andExpect(jsonPath("$.data[0].businessId").value("PROD-CUST-OWN"));
  }

  @Test
  void agentBearerTokenCanAccessAgentOnlyApi() throws Exception {
    String token = login("agent", "agent-pass");

    mockMvc.perform(get("/api/users")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
        .andExpect(status().isOk());
  }

  private String login(String username, String password) throws Exception {
    String response = mockMvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"username":"%s","password":"%s"}
                """.formatted(username, password)))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
    JsonNode payload = objectMapper.readTree(response);
    return payload.path("data").path("accessToken").asText();
  }
}
