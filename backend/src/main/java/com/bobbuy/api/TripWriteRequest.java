package com.bobbuy.api;

import com.bobbuy.model.Trip;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public class TripWriteRequest {
  @NotBlank(message = "{validation.trip.delivery_area.required}")
  @Size(max = 255)
  private String deliveryArea;
  @NotNull(message = "{validation.trip.delivery_date.required}")
  private LocalDate deliveryDate;

  public String getDeliveryArea() { return deliveryArea; }
  public void setDeliveryArea(String value) { deliveryArea = value; }
  public LocalDate getDeliveryDate() { return deliveryDate; }
  public void setDeliveryDate(LocalDate value) { deliveryDate = value; }

  @JsonAnySetter
  public void rejectUnknown(String key, Object value) {
    throw new IllegalArgumentException("Unsupported trip field: " + key);
  }

  public Trip toTrip() {
    return new Trip(null, null, deliveryArea.trim(), deliveryDate, null, null);
  }
}
