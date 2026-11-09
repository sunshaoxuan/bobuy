package com.bobbuy.service;

/** Durable merchant-scoped evidence bytes. Implement using existing DB/media ownership, not a process cache.
 * put must verify SHA/owner/length and preserve original bytes and retrieval receipt immutably.
 * readVerified must authorize merchant and recheck stored bytes against the requested hash.
 */
public interface CostcoEvidenceStore {
    void put(CostcoOfficialEvidenceFetcher.Query query, CostcoOfficialEvidence receipt, byte[] originalBytes);
    byte[] readVerified(long merchantId, String sha256);
}
