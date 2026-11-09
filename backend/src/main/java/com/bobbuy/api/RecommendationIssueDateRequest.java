package com.bobbuy.api;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import jakarta.validation.constraints.*;
import java.time.LocalDate;

/** Source-reviewed calendar date only; identity and review timestamps are server-owned. */
public record RecommendationIssueDateRequest(@NotNull LocalDate issueDate,
    @NotBlank @Size(max=2048) String sourceRef,
    @NotBlank @Pattern(regexp="[0-9a-fA-F]{64}") String sourceHash,
    @Min(0) long version,boolean reviewed) {
    @JsonAnySetter public void rejectUnknown(String key,Object value){throw new IllegalArgumentException("Unsupported issue-date field: "+key);}
}
