-- Additive category-tree foundation. Existing flat categories (including rec-cat- IDs) and product rows stay untouched.
CREATE TABLE bb_category_tree_node (
    id varchar(255) PRIMARY KEY,
    parent_id varchar(255),
    name jsonb NOT NULL DEFAULT '{}'::jsonb,
    full_path jsonb NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    system_key varchar(64),
    CONSTRAINT fk_category_tree_parent FOREIGN KEY (parent_id) REFERENCES bb_category_tree_node (id),
    CONSTRAINT ck_category_tree_name_object CHECK (jsonb_typeof(name) = 'object'),
    CONSTRAINT ck_category_tree_full_path_array CHECK (jsonb_typeof(full_path) = 'array'),
    CONSTRAINT ck_category_tree_sort_order CHECK (sort_order >= 0),
    CONSTRAINT uq_category_tree_system_key UNIQUE (system_key)
);

CREATE INDEX idx_category_tree_parent_sort
    ON bb_category_tree_node (parent_id, sort_order, id);

CREATE TABLE bb_category_legacy_mapping (
    legacy_category_id varchar(255) PRIMARY KEY,
    category_node_id varchar(255) NOT NULL,
    CONSTRAINT fk_category_mapping_legacy FOREIGN KEY (legacy_category_id) REFERENCES bb_category (id),
    CONSTRAINT fk_category_mapping_node FOREIGN KEY (category_node_id) REFERENCES bb_category_tree_node (id)
);

CREATE INDEX idx_category_mapping_node ON bb_category_legacy_mapping (category_node_id);

CREATE TABLE bb_product_primary_category_path (
    product_id varchar(255) PRIMARY KEY,
    category_node_id varchar(255) NOT NULL,
    CONSTRAINT fk_product_category_path_product FOREIGN KEY (product_id) REFERENCES bb_product (id) ON DELETE CASCADE,
    CONSTRAINT fk_product_category_path_node FOREIGN KEY (category_node_id) REFERENCES bb_category_tree_node (id)
);

CREATE INDEX idx_product_category_path_node ON bb_product_primary_category_path (category_node_id);

-- The only initial tree node is a system fallback, not a fabricated Costco category.
INSERT INTO bb_category_tree_node (id, parent_id, name, full_path, sort_order, system_key)
VALUES (
    'system-uncategorized',
    NULL,
    '{"zh-CN":"未归类","zh-TW":"未分類","en-US":"Uncategorized","ja-JP":"未分類"}'::jsonb,
    '["system-uncategorized"]'::jsonb,
    2147483647,
    'UNCATEGORIZED'
);
