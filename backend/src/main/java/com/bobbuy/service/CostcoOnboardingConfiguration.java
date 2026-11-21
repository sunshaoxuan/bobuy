package com.bobbuy.service;

import com.bobbuy.repository.CostcoOnboardingJobRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import java.time.Clock;

@Configuration
public class CostcoOnboardingConfiguration {
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
            name="bobbuy.ai.costco.vision-probe-at-startup",havingValue="true")
    public org.springframework.boot.ApplicationRunner costcoVisionProbe(LlmGateway gateway) {
        return args -> {
            var result=gateway.probePinnedVision(CostcoNumberOnboardingService.REQUIRED_NODE);
            var logger=org.slf4j.LoggerFactory.getLogger(CostcoOnboardingConfiguration.class);
            if(result.ready())logger.info("Costco photo vision probe: {}",result.code());
            else logger.warn("Costco photo vision probe: {}",result.code());
        };
    }
    @Bean public CostcoOfficialEvidenceFetcher costcoOfficialEvidenceFetcher(CostcoEvidenceAcquisitionPlanner planner,CostcoEvidenceStore store,CostcoExecutionGuard guard){return new CostcoPublicEvidenceFetcher(planner,store,Clock.systemUTC(),guard::check);}
    @Bean public CostcoNumberOnboardingService costcoNumberOnboardingService(CostcoOnboardingJobRepository jobs,
            CostcoOfficialEvidenceFetcher fetcher, CostcoNumberOnboardingService.StageReviewer reviewer,
            CostcoNumberOnboardingService.CatalogCommitter catalog,CostcoExecutionGuard guard) {
        return new CostcoNumberOnboardingService(jobs,fetcher,reviewer,catalog,Clock.systemUTC(),guard);
    }
}
