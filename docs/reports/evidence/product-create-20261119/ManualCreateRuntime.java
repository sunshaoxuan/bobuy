// Synthetic PostgreSQL 18.6 fixture only. Never point this entry point at a business database.
import com.bobbuy.api.BobbuyApplication;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import org.springframework.boot.SpringApplication;
import java.util.*;
public class ManualCreateRuntime {
 public static void main(String[] args){
  var ctx=SpringApplication.run(BobbuyApplication.class,
   "--server.address=127.0.0.1","--server.port=18080",
   "--spring.datasource.url=jdbc:postgresql://127.0.0.1:15432/manual_create_synthetic",
   "--spring.datasource.username=postgres","--spring.datasource.password=","--spring.datasource.driver-class-name=org.postgresql.Driver",
   "--spring.jpa.hibernate.ddl-auto=none","--spring.flyway.enabled=true","--bobbuy.seed.enabled=true",
   "--bobbuy.security.header-auth.enabled=false","--bobbuy.ai.llm.main.url=","--bobbuy.ai.llm.edge.url=","--bobbuy.ai.llm.codex.command=",
   "--spring.cloud.nacos.discovery.enabled=false","--spring.cloud.nacos.config.enabled=false","--spring.cloud.sentinel.enabled=false");
  var nodes=ctx.getBean(CategoryTreeNodeRepository.class);
  nodes.saveAndFlush(new CategoryTreeNode("manual-ui-root",null,Map.of("ja-JP","合成用品","zh-CN","合成用品","zh-TW","合成用品","en-US","Synthetic supplies"),List.of("manual-ui-root"),0,null));
  nodes.saveAndFlush(new CategoryTreeNode("manual-ui-leaf","manual-ui-root",Map.of("ja-JP","合成手動登録","zh-CN","合成手动录入","zh-TW","合成手動輸入","en-US","Synthetic manual entry"),List.of("manual-ui-root","manual-ui-leaf"),0,null));
  // A real V46 tombstone proves manual creation needs no surviving legacy category.
  ctx.getBean(org.springframework.jdbc.core.JdbcTemplate.class).update("insert into bb_retired_category(id,merchant_id,tag_key,name,original,operation_id) values('rec-cat-manual-retired',1000,'manual-retired','{\"ja-JP\":\"旧分類\"}'::jsonb,'{}'::jsonb,'synthetic-manual-create') on conflict do nothing");
  System.out.println("SYNTHETIC_MANUAL_CREATE_READY");
 }
}
