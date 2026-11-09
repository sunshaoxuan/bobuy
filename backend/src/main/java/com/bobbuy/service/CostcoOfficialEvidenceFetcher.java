package com.bobbuy.service;

import java.util.List;

/** Port for the existing retrieval/media chain; never use the current mock search as evidence.
 * Implementations must prefer Costco, then manufacturer; validate public DNS on every redirect,
 * bound redirects/bytes/time, and retain canonical/fetch URL and exact content hash.
 * No session cookies, captcha bypass, private addresses or credentials from model output.
 */
public interface CostcoOfficialEvidenceFetcher {
    record Query(long merchantId, String supplierId, String market, String itemNumber, String privatePhotoSha256, String inputHash) {
        public Query(long merchantId, String supplierId, String market, String itemNumber, String privatePhotoSha256) {
            this(merchantId, supplierId, market, itemNumber, privatePhotoSha256, null);
        }
    }
    List<CostcoOfficialEvidence> fetch(Query query);
}
