package com.bobbuy.service;

import com.bobbuy.model.OrderHeader;
import com.bobbuy.model.OrderStatus;
import com.bobbuy.model.TripStatus;
import com.bobbuy.repository.OrderHeaderRepository;
import com.bobbuy.repository.TripRepository;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TripWorkflowService {
  private final TripRepository trips;
  private final OrderHeaderRepository orders;
  private final AuditLogService audit;

  public TripWorkflowService(TripRepository trips, OrderHeaderRepository orders, AuditLogService audit) {
    this.trips = trips;
    this.orders = orders;
    this.audit = audit;
  }

  @Transactional
  public void refresh(Long tripId) {
    if (tripId == null) return;
    var trip = trips.findByIdForUpdate(tripId).orElseThrow(() -> new com.bobbuy.api.response.ApiException(
        com.bobbuy.api.response.ErrorCode.RESOURCE_NOT_FOUND, "error.trip.not_found"));
    if (trip.isSettlementFrozen()) return;
    orders.flush();
    var active = orders.findByTripId(tripId).stream()
        .filter(o -> o.getStatus() != OrderStatus.CANCELLED).toList();
    TripStatus next = !active.isEmpty() && active.stream().allMatch(this::delivered)
        ? TripStatus.COMPLETED
        : active.stream().anyMatch(this::started) ? TripStatus.IN_PROGRESS : TripStatus.PUBLISHED;
    if (trip.getStatus() == next) return;
    String previous = trip.getStatus().name();
    trip.setStatus(next);
    trip.setStatusUpdatedAt(LocalDateTime.now());
    trips.save(trip);
    audit.logStatusChange("TRIP", tripId, previous, next.name(), 0L);
  }

  private boolean delivered(OrderHeader order) {
    return order.getStatus() == OrderStatus.DELIVERED || order.getStatus() == OrderStatus.SETTLED;
  }

  private boolean started(OrderHeader order) {
    return delivered(order) || order.getStatus() == OrderStatus.PURCHASED
        || order.getLines().stream().anyMatch(l -> l.getPurchasedQuantity() > 0);
  }
}
