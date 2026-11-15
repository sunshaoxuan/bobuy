package com.bobbuy.model;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class CategoryTreeMigrationContractTest {
    @Test
    void migrationIsAdditiveAndEnforcesOnePathPerProduct() throws Exception {
        try (var stream = getClass().getClassLoader().getResourceAsStream("db/migration/V40__category_tree_compatibility.sql")) {
            assertThat(stream).isNotNull();
            var sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8).toLowerCase();
            assertThat(sql).contains("create table bb_category_tree_node")
                    .contains("create table bb_category_legacy_mapping")
                    .contains("create table bb_product_primary_category_path")
                    .contains("product_id varchar(255) primary key")
                    .contains("'rec-cat-'")
                    .contains("'system-uncategorized'")
                    .doesNotContain("update bb_product")
                    .doesNotContain("delete from bb_category")
                    .doesNotContain("drop table");
        }
    }
}
