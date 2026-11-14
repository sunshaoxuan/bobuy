package com.bobbuy.repository;

import java.sql.DriverManager;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import static org.assertj.core.api.Assertions.*;

/** Executes the actual additive migrations on an isolated PostgreSQL-mode H2 schema. */
class RecommendationSourceArtifactMigrationTest {
    @Test void oldStyleHashWriteImmediatelyAfterV36PreservesHistoricalHashes()throws Exception{
        try(var connection=DriverManager.getConnection("jdbc:h2:mem:source-"+UUID.randomUUID()+";MODE=PostgreSQL","sa","");var sql=connection.createStatement()){
            // H2 lacks PostgreSQL's spelling; preserve the production scripts unchanged.
            sql.execute("create domain timestamptz as timestamp with time zone");
            sql.execute("create table bb_recommendation_post(id bigint primary key, issue_date_source_hash varchar(64))");
            sql.execute("insert into bb_recommendation_post values(1,repeat('a',64)),(2,null)");
            ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/migration/V36__recommendation_source_artifact.sql"));
            // An old application knows hash, but omits the algorithm column entirely.
            assertThat(sql.executeUpdate("update bb_recommendation_post set issue_date_source_hash=repeat('b',64) where id=2")).isEqualTo(1);
            try(var rows=sql.executeQuery("select * from bb_recommendation_post order by id")){
                assertThat(rows.next()).isTrue();assertThat(rows.getString("issue_date_source_hash")).isEqualTo("a".repeat(64));assertThat(rows.getString("issue_date_source_algorithm")).isEqualTo("legacy-operator-supplied");
                assertThat(rows.next()).isTrue();assertThat(rows.getString("issue_date_source_hash")).isEqualTo("b".repeat(64));assertThat(rows.getString("issue_date_source_algorithm")).isNull();
            }
        }
    }
}
