-- New associations always start private. Preserve every association, source fact and asset.
ALTER TABLE bb_recommendation_item ADD COLUMN publication_state varchar(12) NOT NULL DEFAULT 'PENDING';
ALTER TABLE bb_recommendation_item ADD COLUMN publication_snapshot jsonb;
ALTER TABLE bb_recommendation_item ADD COLUMN published_at timestamptz;
ALTER TABLE bb_recommendation_item ADD COLUMN published_by bigint;
ALTER TABLE bb_recommendation_item ADD COLUMN publication_request_id varchar(36);
ALTER TABLE bb_recommendation_item ADD COLUMN publication_request_hash varchar(64);
ALTER TABLE bb_recommendation_item ADD COLUMN linked_product_version bigint;
ALTER TABLE bb_recommendation_item ADD COLUMN addition_payload_hash varchar(64);

-- A legacy issue has no proven historical master-version binding. Retain its stored issue
-- facts/gallery/context, mark the binding UNKNOWN, and never borrow the current master.
-- This preserves legacy publication/membership, not a fabricated new review or recipe.
-- All draft issues remain PENDING. No later master correction is applied to this copy.
UPDATE bb_recommendation_item i SET publication_state='PUBLISHED',published_at=p.published_at,published_by=p.publisher_id,
 publication_snapshot=jsonb_build_object(
  'version',1,'legacy',true,'productVersion',NULL,'productSourceHash',NULL,'reviewHash',NULL,
  'name',i.name,'itemNumber',i.item_number,'specification',i.specification,'description',i.description,
  'translations',i.translations,'translatedSource',i.translated_source,
  'referencePrice',i.reference_price,'originalPrice',i.original_price,'discountAmount',i.discount_amount,'priceUnit',i.price_unit,
  'offerStart',i.offer_start,'offerEnd',i.offer_end,'couponStart',i.coupon_start,'couponEnd',i.coupon_end,
  'offerNotes',i.offer_notes,'referenceContext',i.reference_context,'gallery',i.gallery,
  'categoryIds',i.category_ids,'supplierId',i.supplier_id,'showSupplier',i.show_supplier,
  'imageHash',i.image_hash,'imageUrl',i.image_url,'offerIdentity',i.offer_identity,'catalog',NULL)
 FROM bb_recommendation_item prior JOIN bb_recommendation_post p ON p.id=prior.post_id
 WHERE prior.id=i.id AND p.published=true;

ALTER TABLE bb_recommendation_item ADD CONSTRAINT ck_recommendation_item_publication CHECK ((
 (publication_state='PENDING' AND publication_snapshot IS NULL AND published_at IS NULL AND published_by IS NULL AND publication_request_id IS NULL AND publication_request_hash IS NULL)
 OR (publication_state='PUBLISHED' AND publication_snapshot IS NOT NULL AND publication_snapshot->>'version'='1'
     AND published_at IS NOT NULL AND published_by IS NOT NULL
     AND ((publication_snapshot->>'legacy'='true' AND publication_request_id IS NULL AND publication_request_hash IS NULL)
       OR (publication_snapshot->>'legacy'='false' AND publication_request_id IS NOT NULL AND publication_request_hash IS NOT NULL
           AND publication_snapshot->>'reviewHash' IS NOT NULL)))) IS TRUE);
ALTER TABLE bb_recommendation_item ADD CONSTRAINT uq_recommendation_item_publication_request UNIQUE (published_by,publication_request_id);
ALTER TABLE bb_recommendation_item ADD CONSTRAINT uq_recommendation_item_addition_intent UNIQUE (post_id,addition_payload_hash);
CREATE INDEX ix_recommendation_item_publication ON bb_recommendation_item(post_id,publication_state,id);
