package com.bobbuy.repository;

import com.bobbuy.model.OrderHeader;
import com.bobbuy.model.OrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OrderHeaderRepository extends JpaRepository<OrderHeader, Long> {
    interface Location { Long getId(); Long getTripId(); }
    @Query("select o.id as id, o.tripId as tripId from OrderHeader o where o.id = :id")
    Optional<Location> locate(@Param("id") Long id);
    @Query("select o.tripId from OrderHeader o where o.id = :id")
    Optional<Long> findTripIdForOrder(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from OrderHeader o where o.id = :id")
    Optional<OrderHeader> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from OrderHeader o where o.tripId = :tripId order by o.id")
    List<OrderHeader> findByTripIdForUpdate(@Param("tripId") Long tripId);
    Optional<OrderHeader> findByBusinessId(String businessId);

    List<OrderHeader> findByTripId(Long tripId);

    List<OrderHeader> findByTripIdOrderByCreatedAtAscIdAsc(Long tripId);

    List<OrderHeader> findByCustomerId(Long customerId);

    boolean existsByTripIdAndCustomerId(Long tripId, Long customerId);

    List<OrderHeader> findByStatusOrderByCreatedAtAscIdAsc(OrderStatus status);

    Optional<OrderHeader> findTopByOrderByIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from OrderHeader o where o.businessId = :businessId and o.tripId = :tripId")
    Optional<OrderHeader> findByBusinessIdAndTripIdForUpdate(@Param("businessId") String businessId, @Param("tripId") Long tripId);

    Optional<OrderHeader> findByBusinessIdAndTripId(String businessId, Long tripId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from OrderHeader o where o.businessId = :businessId")
    Optional<OrderHeader> findByBusinessIdForUpdate(@Param("businessId") String businessId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from OrderHeader o where o.status = :status order by o.createdAt asc, o.id asc")
    List<OrderHeader> findByStatusForUpdate(@Param("status") OrderStatus status);

    @Query("select coalesce(sum(o.totalAmount), 0) from OrderHeader o")
    double sumTotalAmount();

    @Query("select o.status as status, count(o) as total from OrderHeader o group by o.status")
    List<OrderStatusCountView> countByStatus();

    interface OrderStatusCountView {
        OrderStatus getStatus();

        long getTotal();
    }
}
