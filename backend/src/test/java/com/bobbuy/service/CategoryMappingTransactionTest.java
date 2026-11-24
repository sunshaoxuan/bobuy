package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest(classes=com.bobbuy.api.BobbuyApplication.class)
class CategoryMappingTransactionTest {
 @Autowired CategoryPathImportService service;
 @Autowired ProductRepository products;
 @Autowired CategoryTreeNodeRepository nodes;
 @Autowired JdbcTemplate jdbc;
 @SpyBean ProductPrimaryCategoryPathRepository paths;
 String prefix,root,previewId;
 @BeforeEach void setup() throws Exception {
  try(var connection=jdbc.getDataSource().getConnection()){assertThat(connection.getMetaData().getURL()).startsWith("jdbc:h2:mem:");}
  String schema=new String(getClass().getResourceAsStream("/db/migration/V41__category_path_import.sql").readAllBytes(),StandardCharsets.UTF_8);
  for(String sql:schema.replace("timestamptz","timestamp with time zone").replace("CREATE TABLE ","CREATE TABLE IF NOT EXISTS ").replace("CREATE INDEX ","CREATE INDEX IF NOT EXISTS ").split(";"))if(!sql.isBlank())jdbc.execute(sql);
  jdbc.execute("alter table bb_category_path_import add column if not exists preview_state text");
  jdbc.execute("alter table bb_category_path_import_row add column if not exists flag text");
  jdbc.execute("alter table bb_category_path_import_row add column if not exists source_tier text");
  prefix="isolated-map-"+UUID.randomUUID();root=prefix+"-root";
  if(!nodes.existsById("system-uncategorized"))nodes.saveAndFlush(new CategoryTreeNode("system-uncategorized",null,Map.of("ja-JP","Uncategorized"),List.of("system-uncategorized"),Integer.MAX_VALUE,"UNCATEGORIZED"));
  nodes.saveAndFlush(new CategoryTreeNode(root,null,Map.of("ja-JP",prefix),List.of(root),0,null));
  for(String suffix:List.of("a","b")){var p=new Product();p.setId(prefix+suffix);p.setMerchantId(1000L);p.setName(Map.of("ja-JP","Synthetic "+suffix));p.setItemNumber(prefix+suffix);p.setBasePrice(0);p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);products.saveAndFlush(p);}
 }
 @AfterEach void cleanup(){reset(paths);if(prefix==null)return;for(String suffix:List.of("a","b")){paths.deleteById(prefix+suffix);products.deleteById(prefix+suffix);}if(previewId!=null){jdbc.update("delete from bb_category_path_import_row where import_id=?",previewId);jdbc.update("delete from bb_category_path_import where id=?",previewId);}nodes.deleteById(root);}
 @Test void databaseFailureRollsBackEntireBatchAndRetryRemainsSafe(){
  String csv="productId,itemNumber,version,categoryNodeId,categoryPath,sortOrder,operation\r\n";
  for(String suffix:List.of("a","b")){String id=prefix+suffix;csv+=id+","+id+","+products.findById(id).orElseThrow().getRecordVersion()+","+root+",Synthetic,0,ASSIGN\r\n";}
  var p=service.preview(1000,false,new MockMultipartFile("file","synthetic.csv","text/csv",csv.getBytes(StandardCharsets.UTF_8)));previewId=p.importId();
  assertThat(p.matched()).isEqualTo(2);assertThat(paths.findById(prefix+"a")).isEmpty();
  doThrow(new IllegalStateException("synthetic second-row failure")).when(paths).saveAndFlush(argThat(path->path!=null&&(prefix+"b").equals(path.getProductId())));
  assertThatThrownBy(()->service.confirm(1000,false,previewId)).hasMessageContaining("second-row failure");
  assertThat(paths.findById(prefix+"a")).isEmpty();assertThat(paths.findById(prefix+"b")).isEmpty();assertThat(service.get(1000,previewId).status()).isEqualTo("PREVIEWED");
  reset(paths);service.confirm(1000,false,previewId);service.confirm(1000,false,previewId);
  assertThat(paths.findById(prefix+"a").orElseThrow().getCategoryNodeId()).isEqualTo(root);assertThat(paths.findById(prefix+"b").orElseThrow().getCategoryNodeId()).isEqualTo(root);
 }
}
