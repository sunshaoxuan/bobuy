# Product supplier-number audit — 2026-10-27

Read-only production audit through the existing authenticated, visible Bobuy Operator management UI on OHR0067. No products, recommendations, prices, stock, publication states or accounts were written. Sales remain closed; the previous request for selling-price/purchase confirmation is withdrawn, not pending.

## Counts and source

The stock-master table renders all **142** saved products at once (`pagination={false}`), with 142 distinct rendered row keys; there are no omitted stock-table pages. **139** rows have a numeric supplier code or explicitly grouped numeric codes; **3** are blank. All 142 have recommendation-profile IDs and all 142 display unconfirmed actual selling prices. Seven existing rows carry explicit multi-code groups; these must not be treated as missing codes or collapsed to one guessed variant.

The normal recommendation-link table was traversed through all 11 warehouse pages (**122** rows) and all 3 online pages (**30** rows). All 152 show linked product profiles. The online issue has no missing source codes. The three blanks are warehouse issue 1 only:

| Recommendation item | Product ID | UI display name | Official source conclusion |
|---|---|---|---|
| 48 | `bobuy-rec-v1-dde7fd1c-db27-34b7-8332-e45c9c7fc211` | PIAA 日本国产车专用无骨雨刷 | General promotion covering 18 sizes, 300–700mm; no ITEM is printed. A sample package model cannot identify one Costco supplier ITEM for the entire group. |
| 61 | `bobuy-rec-v1-35e5de44-afd8-3aa1-8c7f-4e3b41d6a543` | Rexton 助听器购机赠配件优惠 | Buy a hearing aid, receive one compatible accessory; not a single specified product/model or ITEM. |
| 62 | `bobuy-rec-v1-ccc74b3a-d96e-37f2-b6dd-1a68ea1f12ac` | 耳内式助听器 | Category-wide custom hearing-aid promotion, illustrated with several devices; no exact model/ITEM is printed. |

Each of the three actual master drawers was opened read-only: product number is also blank, supplier is Costco, and the profile is canonical/used by its linked recommendation. This is real missing identity, **not a list-field mismatch**. The normal current-merchant order page displays no orders; this observation does not justify bypassing general historical-reference protection.

The original official [2026-10-25 mail page](https://cds2.costcojapan.jp/cds/mail-images/upz/261025_kdwc/sun25d/pc_index.html) and the actual image pixels were inspected in the browser: [PIAA](https://cds2.costcojapan.jp/cds/mail-images/upz/261025_kdwc/img25/sk002.jpg), [Rexton promotion](https://cds2.costcojapan.jp/cds/mail-images/upz/261025_kdwc/img25/sk003.jpg), [custom hearing aids](https://cds2.costcojapan.jp/cds/mail-images/upz/261025_kdwc/img25/sk004.jpg). The web text reader could not open this page; the browser did open it successfully. Filenames were used only to locate the observed image blocks, never as supplier numbers. No sufficiently specific identity exists to fill these three ITEMs responsibly.

The result is consistent with the prior 142-master/152-recommendation save and production-preservation receipts; no additional test profiles were found in the current 142-row production list. The three rows came from real broad promotions included in the 122-item source, then the normal recommendation-to-profile workflow. `RecommendationCatalogService.ensure` currently allows missing itemNumber, derives its private profile identity from source issue + image hash + name when needed, and copies the missing itemNumber as null. This explains the records without implying a backdoor import or random test seed.

## Deletion boundary — not executed

The existing delete control calls `api.deleteProduct`; `BobbuyStore.deleteProduct` removes merchant-SKU mappings and calls `productRepository.deleteById`. There is no soft-delete flag, recycle bin or normal restore workflow. Price-adjustment history is protected, but that is not a restore mechanism. Recommendation product references retain a database foreign key; directly deleting these still-linked profiles is expected to be rejected, not a safe cleanup process. This was established by source inspection, **not by trying a production deletion**.

Therefore the user's recoverable-deletion authorization cannot be exercised through the current button. Status: **permanent cleanup pending explicit per-action confirmation, not attempted, not denied**. Backups are not presented as product recovery. A permanent cleanup plan must explicitly cover the three recommendation occurrences and three profiles, preserve source evidence and any immutable order snapshots, and leave no dead references. If all three single warehouse occurrences are removed, expected counts are warehouse 119 / online 30 / total 149 recommendations and 139 products; the warehouse article's count text would also need correction. No unrelated product, grouped ITEM or NESPRESSO conflict record is included in that proposed scope. Alternatively a separately authorized normal archive/restore feature could avoid permanent deletion.

No application fix or deployment was needed to establish this result. Production remains 20261026.9 / application `a113d7547abd85d64277bfa7da57ef67907c1895`.
