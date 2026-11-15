package com.bobbuy.service;

import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.assertj.core.api.Assertions.*;

class CategoryReviewedNamesTest {
    @Test void productSourceIsReadableButCannotBeForgedByProductUpdateJson() throws Exception {
        var mapper=new ObjectMapper();
        var product=mapper.readValue("{\"categoryPathSource\":\"官网面包屑（原文）\"}",com.bobbuy.model.Product.class);
        assertThat(product.getCategoryPathSource()).isNull();
        product.setCategoryPathSource("推定（官网无页面）");
        assertThat(mapper.valueToTree(product).get("categoryPathSource").asText()).isEqualTo("推定（官网无页面）");
    }
    private CategoryReviewedNames load(Map<String,Object> file) throws Exception {
        return new CategoryReviewedNames(new ByteArrayInputStream(new ObjectMapper().writeValueAsBytes(file)));
    }
    private Map<String,Object> entry() {
        return new HashMap<>(Map.of("japanesePath",List.of("例親","例子"),"status","reviewed",
            "names",Map.of("zh-CN","示例子","zh-TW","範例子","en-US","Example child"),
            "reviewedBy","synthetic-reviewer","reviewedAt","2026-11-15"));
    }
    private Map<String,Object> file(List<Map<String,Object>> entries) {
        return new HashMap<>(Map.of("schemaVersion",1,"status","pending_ops_review",
            "sourceFile","category-tree-migration-2026-11-15.csv","sourceSha256","a".repeat(64),
            "pendingReview",List.of("Synthetic fixture"),"entries",entries));
    }
    @Test void shippedMappingIsExplicitlyPendingAndContainsNoFabricatedNames() throws Exception {
        try(var input=getClass().getResourceAsStream("/category-names/ops-reviewed-names.json")) {
            var json=new ObjectMapper().readTree(input);
            assertThat(json.get("status").asText()).isEqualTo("pending_ops_review");
            assertThat(json.get("entries").isEmpty()).isTrue();
            assertThat(json.get("sourceSha256").isNull()).isTrue();
            assertThat(json.get("pendingReview").isEmpty()).isFalse();
        }
        assertThat(new CategoryReviewedNames().names(List.of("例親","例子"))).containsExactlyEntriesOf(Map.of("ja-JP","例子"));
    }
    @Test void reviewedNamesUseEntirePathAndPreserveJapaneseWhilePendingNamesNeverEscape() throws Exception {
        var pending=entry();pending.put("japanesePath",List.of("別親","例子"));pending.put("status","pending_ops_review");
        var mapping=load(file(List.of(entry(),pending)));
        assertThat(mapping.names(List.of("例親","例子"))).containsEntry("zh-CN","示例子").containsEntry("zh-TW","範例子").containsEntry("en-US","Example child").containsEntry("ja-JP","例子");
        assertThat(mapping.names(List.of("別親","例子"))).containsExactlyEntriesOf(Map.of("ja-JP","例子"));
        assertThat(mapping.names(List.of("例子"))).containsExactlyEntriesOf(Map.of("ja-JP","例子"));
    }
    @Test void incompleteReviewDuplicatePathsAndJapaneseOverridesFailClosed() throws Exception {
        for(String missing:List.of("reviewedBy","reviewedAt","names")) {
            var entry=entry();entry.remove(missing);
            assertThatThrownBy(()->load(file(List.of(entry)))).isInstanceOf(IllegalArgumentException.class);
        }
        var missingLocale=entry();missingLocale.put("names",Map.of("zh-CN","例"));
        assertThatThrownBy(()->load(file(List.of(missingLocale)))).isInstanceOf(IllegalArgumentException.class);
        var override=entry();override.put("names",Map.of("zh-CN","例","zh-TW","例","en-US","Example","ja-JP","changed"));
        assertThatThrownBy(()->load(file(List.of(override)))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->load(file(List.of(entry(),entry())))).isInstanceOf(IllegalArgumentException.class);
        var noHash=file(List.of(entry()));noHash.remove("sourceSha256");
        assertThatThrownBy(()->load(noHash)).isInstanceOf(IllegalArgumentException.class);
        var wrongDate=entry();wrongDate.put("reviewedAt","tomorrow");
        assertThatThrownBy(()->load(file(List.of(wrongDate)))).isInstanceOf(java.time.format.DateTimeParseException.class);
    }
    @Test void sourceMigrationCanRunTwiceWithoutChangingBusinessDataOrStoredSource() throws Exception {
        var jdbc=new org.springframework.jdbc.core.JdbcTemplate(new org.springframework.jdbc.datasource.DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1"));
        jdbc.execute("create table bb_product(id varchar primary key,category_id varchar,price int,published boolean)");
        jdbc.execute("create table bb_category_path_import_row(id varchar primary key)");
        jdbc.execute("insert into bb_product values ('p','legacy',123,true)");
        try(var input=getClass().getResourceAsStream("/db/migration/V43__category_path_source.sql")) {
            var sql=new String(input.readAllBytes(),StandardCharsets.UTF_8);jdbc.execute(sql);
            jdbc.update("update bb_product set category_path_source='官网面包屑（原文）'");
            jdbc.execute(sql);
        }
        assertThat(jdbc.queryForMap("select * from bb_product")).containsEntry("CATEGORY_ID","legacy").containsEntry("PRICE",123).containsEntry("PUBLISHED",true).containsEntry("CATEGORY_PATH_SOURCE","官网面包屑（原文）");
    }
}
