package com.bobbuy.service;

import com.bobbuy.repository.CostcoOnboardingJobRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.time.Clock;

@Configuration
public class CostcoOnboardingConfiguration {
    @Bean public CostcoOfficialEvidenceFetcher costcoOfficialEvidenceFetcher(CostcoEvidenceAcquisitionPlanner planner,CostcoEvidenceStore store,CostcoExecutionGuard guard){return new CostcoPublicEvidenceFetcher(planner,store,Clock.systemUTC(),guard::check);}
    @Bean public CostcoNumberOnboardingService costcoNumberOnboardingService(CostcoOnboardingJobRepository jobs,
            CostcoOfficialEvidenceFetcher fetcher, CostcoNumberOnboardingService.StageReviewer reviewer,
            CostcoNumberOnboardingService.CatalogCommitter catalog,CostcoExecutionGuard guard) {
        return new CostcoNumberOnboardingService(jobs,fetcher,reviewer,catalog,Clock.systemUTC(),guard);
    }
}
