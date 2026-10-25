package com.bobbuy.api;

import com.bobbuy.model.Trip;
import com.bobbuy.service.BobbuyStore;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class TripControllerTest {
  @Autowired private BobbuyStore store;
  @Autowired private TripController controller;

  @BeforeEach void setUp() { store.seed(); }

  @Test void editRegionalDeliveryAndReadItBack() {
    TripWriteRequest request = new TripWriteRequest();
    request.setDeliveryArea("SF region");
    request.setDeliveryDate(LocalDate.now().plusDays(2));
    Trip updated = controller.update(2000L, request).getBody().getData();
    assertThat(updated.getDeliveryArea()).isEqualTo("SF region");
    assertThat(controller.get(2000L).getBody().getData().getDeliveryDate()).isEqualTo(request.getDeliveryDate());
    assertThat(controller.list().getData()).hasSize(1);
    TripOrderBulkStatusRequest bulk = new TripOrderBulkStatusRequest();
    bulk.setTargetStatus(com.bobbuy.model.OrderStatus.CONFIRMED);
    assertThat(controller.bulkUpdateOrderStatus(2000L, bulk).getBody().getData()).hasSize(1);
  }
}
