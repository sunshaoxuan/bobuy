-- Additive multi-category storage. The existing table remains authoritative for the
-- primary/default path so older application versions continue to work.
CREATE TABLE bb_product_additional_category_path (
    product_id varchar(255) NOT NULL,
    category_node_id varchar(255) NOT NULL,
    PRIMARY KEY (product_id, category_node_id),
    CONSTRAINT fk_product_additional_category_product FOREIGN KEY (product_id)
        REFERENCES bb_product (id) ON DELETE CASCADE,
    CONSTRAINT fk_product_additional_category_node FOREIGN KEY (category_node_id)
        REFERENCES bb_category_tree_node (id)
);

CREATE INDEX idx_product_additional_category_node
    ON bb_product_additional_category_path (category_node_id);

ALTER TABLE bb_product_primary_category_path
    ADD COLUMN category_revision bigint NOT NULL DEFAULT 0;
