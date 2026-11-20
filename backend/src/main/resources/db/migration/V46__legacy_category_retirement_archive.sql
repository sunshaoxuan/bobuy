-- Compatibility only. No category/product is retired by application startup.
CREATE TABLE bb_retired_category (
    id varchar(255) PRIMARY KEY,
    merchant_id bigint NOT NULL,
    tag_key varchar(100),
    name jsonb NOT NULL,
    original jsonb NOT NULL,
    operation_id varchar(64) NOT NULL,
    retired_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_retired_category_owner ON bb_retired_category(merchant_id);
CREATE TABLE bb_category_retirement_operation (
    id varchar(64) PRIMARY KEY,
    manifest_sha256 varchar(64) NOT NULL,
    compatible_revision varchar(40) NOT NULL,
    applied_by text NOT NULL DEFAULT current_user,
    restored_by text,
    status varchar(16) NOT NULL CHECK (status IN ('APPLIED','RESTORED')),
    before_state jsonb NOT NULL,
    after_state jsonb NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now(),
    restored_at timestamptz
);

-- These guards protect even stale clients/imports. Historical JSON is deliberately not rewritten.
CREATE FUNCTION bb_reject_retired_category_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='bb_category' THEN
  IF EXISTS(SELECT 1 FROM bb_retired_category r WHERE r.id=NEW.id OR
    (r.merchant_id=NEW.merchant_id AND r.tag_key IS NOT NULL AND r.tag_key=NEW.tag_key)) THEN
   RAISE EXCEPTION 'retirement: category has been retired';
  END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM bb_retired_category r WHERE r.id=NEW.category_id OR
    coalesce(NEW.catalog_data->'categoryIds','[]'::jsonb) ? r.id) THEN
   RAISE EXCEPTION 'retirement: current product cannot reference a retired category';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bb_category_retired_guard BEFORE INSERT OR UPDATE ON bb_category
 FOR EACH ROW EXECUTE FUNCTION bb_reject_retired_category_assignment();
CREATE TRIGGER bb_product_retired_guard BEFORE INSERT OR UPDATE ON bb_product
 FOR EACH ROW EXECUTE FUNCTION bb_reject_retired_category_assignment();
