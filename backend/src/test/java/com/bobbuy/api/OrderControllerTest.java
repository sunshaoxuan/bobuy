package com.bobbuy.api;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.model.OrderHeader;
import com.bobbuy.model.OrderLine;
import com.bobbuy.model.OrderStatus;
import com.bobbuy.service.BobbuyStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class OrderControllerTest {
  @Autowired
  private BobbuyStore store;
  @Autowired
  private OrderController controller;

  @BeforeEach
  void setUp() {
    store.seed();
  }

  @Test
  void orderCrudFlow() {
    ApiResponse<List<OrderHeader>> list = controller.list(null, null);
    assertThat(list.getData()).isNotEmpty();

    OrderHeader payload = new OrderHeader("ORD-TEST", 1001L, 2000L);
    payload.addLine(new OrderLine("SKU-T", "Tea", null, 1, 12.0));
    OrderHeader created = controller.create(payload).getBody().getData();
    assertThat(created.getId()).isNotNull();

    ResponseEntity<ApiResponse<OrderHeader>> fetched = controller.get(created.getId(), null);
    assertThat(fetched.getBody().getData().getBusinessId()).isEqualTo("ORD-TEST");

    OrderHeader updatePayload = new OrderHeader("ORD-TEST", 1001L, 2000L);
    updatePayload.setStatus(OrderStatus.CONFIRMED);
    updatePayload.setExpectedOrderRevision(fetched.getBody().getData().getOrderRevision());
    ResponseEntity<ApiResponse<OrderHeader>> updated = controller.update(created.getId(), updatePayload);
    assertThat(updated.getBody().getData().getStatus()).isEqualTo(OrderStatus.CONFIRMED);

    OrderStatusRequest statusRequest = new OrderStatusRequest();
    statusRequest.setStatus(OrderStatus.PURCHASED);
    ResponseEntity<ApiResponse<OrderHeader>> statusUpdated = controller.updateStatus(created.getId(), statusRequest);
    assertThat(statusUpdated.getBody().getData().getStatus()).isEqualTo(OrderStatus.PURCHASED);

    ResponseEntity<ApiResponse<Void>> deleted = controller.delete(created.getId());
    assertThat(deleted.getBody()).isNotNull();
  }

  @Test
  void orderCrudRejectsMissing() {
    assertThatThrownBy(() -> controller.get(9999L, null))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> controller.update(9999L, new OrderHeader("MISS", 1001L, 2000L)))
        .isInstanceOf(ApiException.class);
    OrderStatusRequest request = new OrderStatusRequest();
    request.setStatus(OrderStatus.CONFIRMED);
    assertThatThrownBy(() -> controller.updateStatus(9999L, request))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> controller.delete(9999L))
        .isInstanceOf(ApiException.class);
  }
}
