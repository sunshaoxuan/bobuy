# Product-master image transport metadata fix candidate

Date: 2026-11-24. Base: `6e2194b259ab3b10d351892dd7b1d295740e6798`.

## Authorized scope

Code and isolated synthetic tests only. The product-master upload path may reconcile a browser filename/MIME with already-recognized JPEG or PNG bytes. It must submit those unchanged bytes under matching transport metadata, retain the selected file and its original-byte SHA-256 identity, and keep the original filename as the existing upload label. Unknown bytes remain blocked. Existing WebP/AVIF conversion and animation checks, server decoding/sanitization, size/dimension limits, source URL rules, merchant boundaries, one-time preparation, and all non-catalog upload consumers remain unchanged. Product identity, price, stock, category, recommendation, visibility, and permissions are outside this change.

## Change and minimum acceptance mapping

| Scoped change | Focused acceptance |
| --- | --- |
| Catalog-only JPEG/PNG metadata normalization | Synthetic signature-recognized JPEG and PNG enter through `productCatalogApi.upload`; assert multipart filename, MIME, unchanged-byte SHA-256, original label, and untouched selected `File`. |
| Closed failure behavior | Unknown bytes make no request; catalog read/hash errors return specific safe keys. |
| Existing codec behavior retained | Focused image preparation tests keep genuine WebP conversion support, AVIF/WebP animation rejection, decoder failure handling, limits, and strict converted-format metadata checks. |
| No change to other consumers or contracts | Focused TypeScript and i18n checks cover the touched frontend boundary; no full-suite, stack, production, real data, merge, or deployment action. |

The browser file-picker is not required for this metadata-only candidate if the isolated DOM `File`/`FormData` entry-point coverage exercises the same native objects. A picker exercise may be added only when an already-installed isolated browser can run without starting the application stack or accessing external data.
