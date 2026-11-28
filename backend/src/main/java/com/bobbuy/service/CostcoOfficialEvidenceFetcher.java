package com.bobbuy.service;

import java.util.List;

/** Port for the existing retrieval/media chain; never use the current mock search as evidence.
 * Implementations must prefer Costco, then manufacturer; validate public DNS on every redirect,
 * bound redirects/bytes/time, and retain canonical/fetch URL and exact content hash.
 * No session cookies, captcha bypass, private addresses or credentials from model output.
 */
public interface CostcoOfficialEvidenceFetcher {
    enum Acquisition { FULL, TEXT_ONLY, EXACT_OFFICIAL_IMAGE }

    record Query(long merchantId, String supplierId, String market, String itemNumber, String privatePhotoSha256,
            String inputHash, Acquisition acquisition) {
        public Query {
            acquisition = acquisition == null ? Acquisition.FULL : acquisition;
        }
        public Query(long merchantId, String supplierId, String market, String itemNumber, String privatePhotoSha256, String inputHash) {
            this(merchantId, supplierId, market, itemNumber, privatePhotoSha256, inputHash, Acquisition.FULL);
        }
        public Query(long merchantId, String supplierId, String market, String itemNumber, String privatePhotoSha256) {
            this(merchantId, supplierId, market, itemNumber, privatePhotoSha256, null, Acquisition.FULL);
        }
    }
    List<CostcoOfficialEvidence> fetch(Query query);
}
