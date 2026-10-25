package com.bobbuy.api;

import com.bobbuy.model.ChatMessage;
import com.bobbuy.model.OrderHeader;
import com.bobbuy.model.OrderLine;
import com.bobbuy.model.OrderStatus;
import com.bobbuy.model.Trip;
import com.bobbuy.model.TripStatus;
import com.bobbuy.security.RoleInjectionFilter;
import com.bobbuy.service.BobbuyStore;
import com.bobbuy.service.ChatService;
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
class ChatControllerSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private BobbuyStore store;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ChatService chatService;

    private Long ownOrderId;
    private Long otherOrderId;

    @BeforeEach
    void setUp() {
        store.seed();
        Trip ownTrip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
        Trip otherTrip = store.createTrip(new Trip(null, 1000L, "SF", LocalDate.now(), TripStatus.PUBLISHED, null));

        OrderHeader ownOrder = new OrderHeader("CHAT-CUST-OWN", 1001L, ownTrip.getId());
        ownOrder.addLine(new OrderLine("SKU-OWN", "Own Item", null, 1, 10.0));
        ownOrder.setStatus(OrderStatus.CONFIRMED);
        ownOrder = store.upsertOrder(ownOrder);
        ownOrderId = ownOrder.getId();

        OrderHeader otherOrder = new OrderHeader("CHAT-CUST-OTHER", 9002L, otherTrip.getId());
        otherOrder.addLine(new OrderLine("SKU-OTHER", "Other Item", null, 1, 10.0));
        otherOrder.setStatus(OrderStatus.CONFIRMED);
        otherOrder = store.upsertOrder(otherOrder);
        otherOrderId = otherOrder.getId();

        chatService.sendMessage(buildMessage(ownOrderId, "own-visible"));
        chatService.sendMessage(buildMessage(otherOrderId, "other-hidden"));
    }

    @Test
    void customerBearerTokenCanReadOwnOrderChat() throws Exception {
        String token = login("customer", "customer-pass");

        mockMvc.perform(get("/api/chat/orders/{orderId}", ownOrderId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].content").value("own-visible"));
    }

    @Test
    void customerBearerTokenCannotReadOtherCustomersOrderChat() throws Exception {
        String token = login("customer", "customer-pass");

        mockMvc.perform(get("/api/chat/orders/{orderId}", otherOrderId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    void customerBearerTokenCannotSendIntoOtherCustomersOrderChat() throws Exception {
        String token = login("customer", "customer-pass");

        mockMvc.perform(post("/api/chat/send")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"orderId":%s,"senderId":"DEMO-CUST","recipientId":"PURCHASER","content":"blocked","type":"TEXT"}
                    """.formatted(otherOrderId)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
    }

    @Test
    void forgedHeaderCannotAccessChatWhenHeaderAuthDisabled() throws Exception {
        mockMvc.perform(get("/api/chat/orders/{orderId}", ownOrderId)
                .header(RoleInjectionFilter.ROLE_HEADER, "CUSTOMER")
                .header(RoleInjectionFilter.USER_HEADER, "1001"))
            .andExpect(status().isUnauthorized());
    }

    private ChatMessage buildMessage(Long orderId, String content) {
        ChatMessage message = new ChatMessage();
        message.setOrderId(orderId);
        message.setSenderId("PURCHASER");
        message.setRecipientId("DEMO-CUST");
        message.setContent(content);
        message.setType("TEXT");
        return message;
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
