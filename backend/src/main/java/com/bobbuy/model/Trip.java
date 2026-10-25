package com.bobbuy.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "bb_trip")
public class Trip {
  @Id
  private Long id;

  private Long agentId;

  @NotBlank(message = "{validation.trip.delivery_area.required}")
  @Size(max = 255)
  private String deliveryArea;

  @NotNull(message = "{validation.trip.delivery_date.required}")
  @JsonFormat(pattern = "yyyy-MM-dd")
  private LocalDate deliveryDate;


  @Enumerated(EnumType.STRING)
  private TripStatus status;

  private LocalDateTime statusUpdatedAt;

  @Transient
  private double currentWeight;

  @Transient
  private double currentVolume;

  public Trip() {
  }

  public Trip(Long id, Long agentId, String deliveryArea, LocalDate deliveryDate,
              TripStatus status, LocalDateTime statusUpdatedAt) {
    this.id = id;
    this.agentId = agentId;
    this.deliveryArea = deliveryArea;
    this.deliveryDate = deliveryDate;
    this.status = status;
    this.statusUpdatedAt = statusUpdatedAt;
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public Long getAgentId() {
    return agentId;
  }

  public void setAgentId(Long agentId) {
    this.agentId = agentId;
  }

  public String getDeliveryArea() { return deliveryArea; }

  public void setDeliveryArea(String deliveryArea) { this.deliveryArea = deliveryArea; }

  public LocalDate getDeliveryDate() { return deliveryDate; }

  public void setDeliveryDate(LocalDate deliveryDate) { this.deliveryDate = deliveryDate; }

  public TripStatus getStatus() {
    return status;
  }

  public void setStatus(TripStatus status) {
    this.status = status;
  }

  public LocalDateTime getStatusUpdatedAt() {
    return statusUpdatedAt;
  }

  public void setStatusUpdatedAt(LocalDateTime statusUpdatedAt) {
    this.statusUpdatedAt = statusUpdatedAt;
  }

  public double getCurrentWeight() {
    return currentWeight;
  }

  public void setCurrentWeight(double currentWeight) {
    this.currentWeight = Math.max(currentWeight, 0D);
  }

  public double getCurrentVolume() {
    return currentVolume;
  }

  public void setCurrentVolume(double currentVolume) {
    this.currentVolume = Math.max(currentVolume, 0D);
  }

  public void recalculateCurrentLoad(int purchasedQuantity, double weightPerUnit, double volumePerUnit) {
    setCurrentWeight(purchasedQuantity * Math.max(weightPerUnit, 0D));
    setCurrentVolume(purchasedQuantity * Math.max(volumePerUnit, 0D));
  }

  public boolean isSettlementFrozen() {
    return status == TripStatus.COMPLETED || status == TripStatus.SETTLED;
  }

  public String getSettlementFreezeStage() {
    if (status == TripStatus.SETTLED) {
      return "SETTLED_FROZEN";
    }
    if (status == TripStatus.COMPLETED) {
      return "DELIVERY_PENDING_SETTLEMENT";
    }
    return "ACTIVE";
  }

  public String getSettlementFreezeReason() {
    if (status == TripStatus.SETTLED) {
      return "Trip already settled and frozen.";
    }
    if (status == TripStatus.COMPLETED) {
      return "Delivery completed; operational changes are frozen pending settlement.";
    }
    return "";
  }
}
