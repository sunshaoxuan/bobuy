CREATE TABLE bb_category_path_import (
    id varchar(36) PRIMARY KEY,
    actor_id bigint NOT NULL,
    file_name varchar(255) NOT NULL,
    file_sha256 varchar(64) NOT NULL,
    status varchar(24) NOT NULL,
    product_count_before bigint NOT NULL,
    product_count_after bigint,
    matched_count integer NOT NULL,
    new_node_count integer NOT NULL,
    unmatched_count integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    confirmed_at timestamptz
);

CREATE TABLE bb_category_path_import_row (
    import_id varchar(36) NOT NULL REFERENCES bb_category_path_import(id) ON DELETE CASCADE,
    row_number integer NOT NULL,
    sku varchar(255) NOT NULL,
    breadcrumb varchar(2000) NOT NULL,
    product_id varchar(255),
    outcome varchar(24) NOT NULL,
    reason varchar(255),
    PRIMARY KEY (import_id, row_number)
);

CREATE INDEX idx_category_path_import_actor_created ON bb_category_path_import(actor_id, created_at DESC);

