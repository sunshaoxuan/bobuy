package com.bobbuy.service;

import com.bobbuy.model.CostcoOnboardingJob;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Selects the reduced first-stage acquisition only from a durable, owner-bound batch item. */
@Component
public class RapidPhotoEvidenceAcquisitionClassifier
        implements CostcoNumberOnboardingService.EvidenceAcquisitionClassifier {
    private final JdbcTemplate jdbc;

    public RapidPhotoEvidenceAcquisitionClassifier(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public CostcoOfficialEvidenceFetcher.Acquisition classify(CostcoOnboardingJob job) {
        Long matches = jdbc.queryForObject("""
                select count(*) from bb_photo_publish_item
                where onboarding_job_id=? and merchant_id=?
                """, Long.class, job.id(), job.merchantId());
        return matches != null && matches == 1
                ? CostcoOfficialEvidenceFetcher.Acquisition.TEXT_ONLY
                : CostcoOfficialEvidenceFetcher.Acquisition.FULL;
    }
}
