package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.OrderHeader;
import com.bobbuy.model.Trip;
import com.bobbuy.repository.OrderHeaderRepository;
import com.bobbuy.repository.TripRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

/** Common writer order: sorted trip locks, then order locks, then sorted product locks.
 * Refresh after waiting: a prior authorization/read may already have attached a stale entity.
 */
@Service
public class OrderWriteCoordinator {
    private final TripRepository trips;
    private final OrderHeaderRepository orders;
    private final EntityManager entities;
    public OrderWriteCoordinator(TripRepository trips, OrderHeaderRepository orders, EntityManager entities) {
        this.trips = trips; this.orders = orders; this.entities = entities;
    }
    public Trip trip(Long id) {
        var attached=entities.find(Trip.class,id);
        // A repeated helper call must retain changes already made under this transaction's lock.
        if(attached!=null&&entities.getLockMode(attached)==LockModeType.PESSIMISTIC_WRITE)return attached;
        var trip = trips.findByIdForUpdate(id).orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.trip.not_found"));
        entities.refresh(trip, LockModeType.PESSIMISTIC_WRITE); return trip;
    }
    public void trips(Collection<Long> ids) { ids.stream().filter(Objects::nonNull).distinct().sorted().forEach(this::trip); }
    /** Caller must hold the trip lock identified by a scalar locator, before loading this order. */
    public OrderHeader order(Long id) {
        var order = orders.findByIdForUpdate(id).orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.order.not_found"));
        entities.refresh(order, LockModeType.PESSIMISTIC_WRITE); return order;
    }
    public List<OrderHeader> orders(Long tripId) {
        var result = orders.findByTripIdForUpdate(tripId);
        result.forEach(o -> entities.refresh(o, LockModeType.PESSIMISTIC_WRITE)); return result;
    }
    public OrderHeader existing(Long id) {
        Long tripId = orders.locate(id).orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.order.not_found")).getTripId();
        if (tripId!=null) {var trip=trip(tripId);com.bobbuy.security.MerchantScope.require(trip.getAgentId());}
        var order = order(id);
        if (!Objects.equals(tripId, order.getTripId())) throw new org.springframework.orm.ObjectOptimisticLockingFailureException(OrderHeader.class,id);
        return order;
    }
}
