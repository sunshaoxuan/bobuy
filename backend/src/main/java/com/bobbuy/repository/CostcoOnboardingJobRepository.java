package com.bobbuy.repository;

import com.bobbuy.model.CostcoOnboardingJob;
import java.util.Optional;

/** Persistence port for the existing DB/lease infrastructure, no new DB or in-memory production store.
 * createOrGet must atomically enforce the merchant-scoped key and reject unequal input hashes.
 * compareAndSet must atomically check merchant + revision and increment by exactly one.
 */
public interface CostcoOnboardingJobRepository {
    CostcoOnboardingJob createOrGet(CostcoOnboardingJob queued);
    Optional<CostcoOnboardingJob> findOwned(String jobId, long merchantId);
    boolean compareAndSet(CostcoOnboardingJob expected, CostcoOnboardingJob next);
    record Lease(CostcoOnboardingJob job, String token) {}
    default Optional<Lease> claimNext(java.time.Instant now) { return Optional.empty(); }
    default <T> T withLease(Lease lease, java.util.function.Supplier<T> action) { return action.get(); }
    default void release(Lease lease) {}
}
