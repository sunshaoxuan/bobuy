package com.bobbuy.service;

import com.bobbuy.model.CostcoOnboardingJob;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RapidPhotoEvidenceAcquisitionClassifierTest {
    @Test
    void classificationRequiresDurableJobAndMerchantOwnershipMatch() {
        var jdbc = mock(JdbcTemplate.class);
        var job = new CostcoOnboardingJob("job-id", "key", 7, "supplier", "JP", "a".repeat(64),
                "123", null, 0, CostcoOnboardingJob.State.QUEUED, List.of(), List.of(), null, null,
                null, Instant.parse("2026-11-28T00:00:00Z"));
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq("job-id"), eq(7L)))
                .thenReturn(1L, 0L);
        var classifier = new RapidPhotoEvidenceAcquisitionClassifier(jdbc);

        assertEquals(CostcoOfficialEvidenceFetcher.Acquisition.TEXT_ONLY, classifier.classify(job));
        assertEquals(CostcoOfficialEvidenceFetcher.Acquisition.FULL, classifier.classify(job));
        verify(jdbc, org.mockito.Mockito.times(2))
                .queryForObject(anyString(), eq(Long.class), eq("job-id"), eq(7L));
    }
}
