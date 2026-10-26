-- Earlier PLAN-64 installations scoped the official-code uniqueness to an
-- owner. A source variant still needs its own Product ID under the same owner.
-- Preserve migration history and rows; the V11 nonunique lookup index remains.
DROP INDEX IF EXISTS uq_product_merchant_code;
