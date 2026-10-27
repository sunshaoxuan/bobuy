# Currency directory placement correction — local candidate

## Finding and change

The original data was already shared: V13 created `bb_currency`, keyed by currency code, and product pricing/checkout used the same repository. There was no separate recommendation-owned currency table. The classification defect was the embedded currency directory inside `RecommendationSales`, its frontend `recommendationApi` ownership, and currency GET handlers residing in `RecommendationController`. No existing Basic data navigation group or currency page existed.

The candidate places the read-only directory at **Basic data → Currencies**, `/admin/basic-data/currencies`, with a matching breadcrumb. `/admin/basic-data` and `/admin/currencies` redirect there. Recommendations contain a reference link, not an embedded copy. Product pricing and the new page use `masterDataApi`; `CurrencyController` owns both existing GET paths. API URLs, shared service/repository, IDs, persisted records and security matchers are unchanged. Four UI locales are included. Currency status wording describes currency availability, not an assertion that any product is on sale.

No schema migration, data rewrite, exchange conversion, stock/price edit, new currency enablement, credential or permission change is required. Existing public currency reads remain public; merchant reads still require AGENT. This change does not add currency editing or enable sales.

## Validation

- Frontend: ProductPricingPanel 3 tests + Recommendations 6 tests passed.
- Frontend: Currencies navigation/compatibility/read-only and anonymous/customer denial tests, 3 passed.
- Backend: RecommendationCommerceTest 2 passed; CurrencyDirectoryIntegrationTest 1 passed. The latter verifies identical public/merchant records (CNY, JPY, TWD, USD), existing enabled flags, anonymous 401 and customer 403.
- Initial backend test used default test-role injection, so the supposedly anonymous request was a CUSTOMER and returned 403. The test was corrected to disable header-auth injection as production does, then passed. Production security configuration was not modified.
- Initial frontend assertion ran while the Reload button still had its loading icon; synchronization was corrected and all three tests passed.
- Final build/i18n/TypeScript/Vite passed: 1156 resource keys. Existing large vendor chunk warning remains.
- Existing shared local browser environment `http://127.0.0.1:18080`: visible navigation, direct entry, refresh, back/forward, both compatibility redirects, selected menu and breadcrumb verified. All four languages were viewed; currency codes/symbols/fraction digits remain unchanged across languages. Existing local synthetic post13 now links to Basic data, no embedded symbol table, and browser Back retains `?post=13`.
- Browser UI used the existing local backend contract; the extracted backend controller was verified by the integration test. No production page/data operation was performed for this batch.

## Release boundary

Local candidate only; no push, CI dispatch, image build, production activation or maintenance was performed. Production remains the previous 20261027.3 deployment. A future release needs frontend and core-service application updates under the existing formal release process; it needs **no database migration or data maintenance**. Production activation/window is a separate decision. No previous maintenance approval was reused.

The existing local web container was reused without creating containers or touching test data. Previous static files were retained at the parent workspace `.task-tmp/currency-web-before`; the final candidate is currently installed only into that shared local web container for review. The post3 upload permission remains pending and was not retried. Existing posts1/2 and all15 deleted products were untouched.
