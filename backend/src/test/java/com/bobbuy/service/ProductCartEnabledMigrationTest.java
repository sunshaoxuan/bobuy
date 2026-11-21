package com.bobbuy.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProductCartEnabledMigrationTest {
    @Test
    void migrationEnablesBothLegacyRowsAndPreservesEveryExistingColumnAndLaterSwitch() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:product_cart_enabled;MODE=PostgreSQL", "sa", "");
             var sql = connection.createStatement();
             var source = getClass().getResourceAsStream("/db/migration/V49__product_cart_enabled.sql")) {
            assertThat(source).isNotNull();
            String migration = new String(source.readAllBytes(), StandardCharsets.UTF_8);
            sql.execute("""
                CREATE TABLE bb_product (
                  id varchar(64) PRIMARY KEY, base_price numeric, sale jsonb, inventory integer,
                  visibility_status text, category_id text, deleted_at timestamp, deleted_by bigint, order_method text
                )
                """);
            sql.execute("""
                INSERT INTO bb_product VALUES
                  ('active', 33.25, '{"enabled":false}', 5, 'PUBLIC', 'dry', null, null, 'DIRECT_BUY'),
                  ('removed', 24, null, 0, 'DRAFTER_ONLY', 'cold', '2026-01-01 00:00:00', 4, 'PRE_ORDER')
                """);
            List<List<String>> before = originalFields(sql);
            sql.execute(migration);
            sql.execute(migration);
            assertThat(originalFields(sql)).isEqualTo(before);
            try (var count = sql.executeQuery("SELECT COUNT(*) FROM bb_product WHERE cart_enabled = true")) {
                assertThat(count.next()).isTrue();
                assertThat(count.getInt(1)).isEqualTo(2);
            }
            sql.execute("UPDATE bb_product SET cart_enabled = false WHERE id = 'active'");
            sql.execute(migration);
            try (var row = sql.executeQuery("SELECT cart_enabled FROM bb_product WHERE id = 'active'")) {
                assertThat(row.next()).isTrue();
                assertThat(row.getBoolean(1)).isFalse();
            }
            assertThat(originalFields(sql)).isEqualTo(before);
        }
    }

    private List<List<String>> originalFields(Statement sql) throws SQLException {
        try (ResultSet rows = sql.executeQuery("""
            SELECT id, base_price, CAST(sale AS varchar), inventory, visibility_status, category_id,
                   deleted_at, deleted_by, order_method FROM bb_product ORDER BY id
            """)) {
            List<List<String>> result = new ArrayList<>();
            while (rows.next()) {
                String[] fields = new String[rows.getMetaData().getColumnCount()];
                for (int i = 0; i < fields.length; i++) {
                    fields[i] = rows.getString(i + 1);
                }
                result.add(Arrays.asList(fields));
            }
            return result;
        }
    }
}
