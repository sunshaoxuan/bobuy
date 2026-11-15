package com.bobbuy.model;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

class CategoryTreeMigrationContractTest {
    @Test void orderAndFlagMigrationPreservesExistingRanksAndIsRepeatable() throws Exception {
        var jdbc=new org.springframework.jdbc.core.JdbcTemplate(new org.springframework.jdbc.datasource.DriverManagerDataSource("jdbc:h2:mem:"+java.util.UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1"));
        jdbc.execute("create table bb_category_tree_node(id varchar primary key,sort_order int)");
        jdbc.execute("create table bb_category_path_import_row(id varchar)");
        jdbc.execute("create table bb_product(id varchar primary key,price int,stock int,published boolean)");
        jdbc.update("insert into bb_category_tree_node values ('old',7)");
        jdbc.update("insert into bb_product values ('p',123,5,true)");
        try(var stream=getClass().getClassLoader().getResourceAsStream("db/migration/V42__category_order_and_import_flags.sql")) {
            assertThat(stream).isNotNull();
            String sql=new String(stream.readAllBytes(),StandardCharsets.UTF_8);
            jdbc.execute(sql);
            jdbc.update("insert into bb_category_tree_node(id,sort_order) values ('new',0)");
            jdbc.update("update bb_product set category_import_flag='推定'");
            jdbc.execute(sql);
        }
        assertThat(jdbc.queryForObject("select explicit_order from bb_category_tree_node where id='old'",Boolean.class)).isTrue();
        assertThat(jdbc.queryForObject("select sort_order from bb_category_tree_node where id='old'",Integer.class)).isEqualTo(7);
        assertThat(jdbc.queryForObject("select explicit_order from bb_category_tree_node where id='new'",Boolean.class)).isFalse();
        assertThat(jdbc.queryForMap("select price,stock,published,category_import_flag from bb_product"))
                .containsEntry("PRICE",123).containsEntry("STOCK",5).containsEntry("PUBLISHED",true).containsEntry("CATEGORY_IMPORT_FLAG","推定");
    }
    @Test
    void migrationIsAdditiveAndEnforcesOnePathPerProduct() throws Exception {
        try (var stream = getClass().getClassLoader().getResourceAsStream("db/migration/V40__category_tree_compatibility.sql")) {
            assertThat(stream).isNotNull();
            var sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8)
                    .replaceAll("(?s)/\\*.*?\\*/", "")
                    .replaceAll("(?m)--[^\\r\\n]*", "")
                    .replaceAll("\\s+", " ")
                    .toLowerCase(Locale.ROOT);
            assertThat(sql).contains("create table bb_category_tree_node")
                    .contains("create table bb_category_legacy_mapping")
                    .contains("create table bb_product_primary_category_path")
                    .contains("product_id varchar(255) primary key")
                    .contains("legacy_category_id varchar(255) primary key")
                    .contains("foreign key (legacy_category_id) references bb_category (id)")
                    .contains("'system-uncategorized'")
                    .doesNotContain("update bb_product")
                    .doesNotContain("delete from bb_category")
                    .doesNotContain("drop table");

            var statements = Arrays.stream(sql.split(";"))
                    .map(String::trim)
                    .filter(statement -> !statement.isEmpty())
                    .toList();
            // Only new schema objects and the single fallback seed are permitted.
            // This excludes rewrites of legacy categories/products and inferred mappings.
            assertThat(statements).allSatisfy(statement -> assertThat(statement).matches(
                    "(?s)(create table bb_(category_tree_node|category_legacy_mapping|product_primary_category_path) \\(.*"
                            + "|create index \\w+ on bb_(category_tree_node|category_legacy_mapping|product_primary_category_path) \\(.*"
                            + "|insert into bb_category_tree_node .*)"));
            assertThat(statements.stream().filter(statement -> statement.startsWith("insert into")))
                    .containsExactly("insert into bb_category_tree_node (id, parent_id, name, full_path, sort_order, system_key) "
                            + "values ( 'system-uncategorized', null, "
                            + "'{\"zh-cn\":\"未归类\",\"zh-tw\":\"未分類\",\"en-us\":\"uncategorized\",\"ja-jp\":\"未分類\"}'::jsonb, "
                            + "'[\"system-uncategorized\"]'::jsonb, 2147483647, 'uncategorized' )");
        }
    }
}
