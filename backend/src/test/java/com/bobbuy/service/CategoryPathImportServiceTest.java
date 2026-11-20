package com.bobbuy.service;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.web.MockMultipartFile;
import com.bobbuy.model.Product;
import com.bobbuy.model.CategoryTreeNode;
import com.bobbuy.repository.*;
import java.util.*;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class CategoryPathImportServiceTest {
    private final ProductRepository products=mock(ProductRepository.class);
    private final CategoryTreeNodeRepository nodes=mock(CategoryTreeNodeRepository.class);
    private final ProductPrimaryCategoryPathRepository paths=mock(ProductPrimaryCategoryPathRepository.class);
    private CategoryPathImportService service;
    private JdbcTemplate jdbc;

    @BeforeEach void setup() {
        jdbc=new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1"));
        jdbc.execute("create table bb_category_path_import(id varchar primary key,actor_id bigint,file_name varchar,file_sha256 varchar,status varchar,product_count_before bigint,product_count_after bigint,matched_count int,new_node_count int,unmatched_count int,created_at timestamp default current_timestamp,confirmed_at timestamp,preview_state clob)");
        jdbc.execute("create table bb_category_path_import_row(import_id varchar,row_number int,sku varchar,breadcrumb varchar,product_id varchar,outcome varchar,reason varchar,flag clob,source_tier clob)");
        jdbc.execute("create table bb_product(id varchar primary key,category_import_flag clob,category_path_source clob,price decimal,stock int,published boolean)");
        jdbc.update("insert into bb_product values ('product-1',null,null,123,5,true)");
        service=new CategoryPathImportService(jdbc,products,nodes,paths,new CategoryReviewedNames());
        when(nodes.lockTree()).thenReturn(Optional.of(new CategoryTreeNode("system-uncategorized",null,Map.of("ja-JP","未分類"),List.of("system-uncategorized"),Integer.MAX_VALUE,"UNCATEGORIZED")));
        Product product=mock(Product.class);when(product.getId()).thenReturn("product-1");
        when(product.getMerchantId()).thenReturn(7L);when(product.getItemNumber()).thenReturn("SKU-1");when(product.getRecordVersion()).thenReturn(0L);
        when(products.findById("product-1")).thenReturn(Optional.of(product));when(products.lockById("product-1")).thenReturn(Optional.of(product));
        when(products.findAllByMerchantIdAndItemNumber(eq(7L),anyString())).thenAnswer(c->products.findAllByItemNumber(c.getArgument(1)));
        when(products.findAllByMerchantId(7L)).thenReturn(List.of(product));
        when(products.findAllByItemNumber("SKU-1")).thenReturn(List.of(product));
        when(products.findAllByItemNumber("ALIAS-1")).thenReturn(List.of(product));
        when(products.count()).thenReturn(1L);
        List<CategoryTreeNode> saved=new ArrayList<>();
        when(nodes.findAll()).thenAnswer(c->new ArrayList<>(saved));
        when(nodes.findAllByParentId(any())).thenAnswer(call->saved.stream().filter(n->Objects.equals(n.getParentId(),call.getArgument(0))).toList());
        when(nodes.save(any())).thenAnswer(call->{CategoryTreeNode n=call.getArgument(0);saved.add(n);return n;});
    }
    private CategoryPathImportService.Preview preview(String records) {
        return service.preview(7,true,new MockMultipartFile("file","input.csv","text/csv",("SKU,Costco breadcrumb\r\n"+records).getBytes(StandardCharsets.UTF_8)));
    }

    private CategoryPathImportService.Preview flagged(String header,String records) {
        return service.preview(7,true,new MockMultipartFile("file","flags.csv","text/csv",("SKU,Costco breadcrumb,"+header+"\n"+records).getBytes(StandardCharsets.UTF_8)));
    }

    private CategoryPathImportService.Preview ops(String rows, String deferred) {
        return service.preview(7,true,new MockMultipartFile("file","ops.csv","text/csv",
            ("SKU,costco分类路径,路径来源,Note\n"+rows).getBytes(StandardCharsets.UTF_8)),deferred);
    }

    @Test void opsSourcesAndBothSeparatorsArePreservedInAuditAndProductWithoutCorrection() {
        for(String source:CategoryPathImportService.SOURCE_TIERS) for(String separator:List.of(">","＞")) {
            String raw=" 原文親 "+separator+" 原文子 ";
            var preview=ops("SKU-1,"+raw+","+source+",original note\n",null);
            assertThat(preview.matched()).isEqualTo(1);
            assertThat(preview.rows().get(0).breadcrumb()).isEqualTo(raw);
            assertThat(preview.rows().get(0).sourceTier()).isEqualTo(source);
            var confirmed=service.confirm(7,preview.importId());
            assertThat(confirmed.rows().get(0).sourceTier()).isEqualTo(source);
            assertThat(jdbc.queryForObject("select category_path_source from bb_product",String.class)).isEqualTo(source);
            assertThat(jdbc.queryForObject("select category_import_flag from bb_product",String.class)).isEqualTo("original note");
            assertThat(nodes.findAllByParentId(null)).anySatisfy(n->assertThat(n.getName().get("ja-JP")).isEqualTo(" 原文親 "));
        }
        service.confirm(7,preview("SKU-1,別親＞別子\n").importId());
        assertThat(jdbc.queryForObject("select category_path_source from bb_product",String.class)).isNull();
    }

    @Test void formerPendingSkusHaveNoSpecialTreatmentAndOversizedSourcesCannotWrite() {
        var product=products.findAllByItemNumber("SKU-1");
        for(String sku:List.of("SAMPLE-A","SAMPLE-B")) when(products.findAllByItemNumber(sku)).thenReturn(product);
        var valid=ops("SAMPLE-A,例親>例子,官网面包屑（原文）,"+"\nSAMPLE-B,例親＞例子,官网面包屑（原文）,\n",null);
        assertThat(valid.matched()).isEqualTo(2);
        var invalid=ops("SKU-1,例親>例子,"+"x".repeat(201)+",\n",null);
        assertThat(invalid.unmatched()).isEqualTo(1); service.confirm(7,invalid.importId()); verify(paths,never()).save(any());
    }

    @Test void defaultDeferListIsEmptyAndNeverSpecialCasesAnItem() {
        var p=preview("SKU-1,Example>Child\n");
        assertThat(p.getDeferred()).isZero();assertThat(p.matched()).isEqualTo(1);
    }
    @Test void mixedInvalidBatchCannotPartiallyCreateNodesOrAssignProducts() {
        var p=preview("SKU-1,Example>Child\nUNKNOWN,Other>Child\n");
        assertThatThrownBy(()->service.confirm(7,p.importId())).hasMessageContaining("Resolve all invalid");
        verify(paths,never()).save(any());verify(nodes,never()).save(any());
    }

    @Test void customDeferListReplacesDefaultsAndBlocksAliasesEvenIfExcludedSkuIsAbsent() {
        var p=ops("ALIAS-1,新親>新子,官网面包屑（原文）,\n"," SKU-1, SKU-1\n UNKNOWN ");
        assertThat(p.getDeferred()).isEqualTo(1);service.confirm(7,p.importId());verify(paths,never()).save(any());
        var mixed=ops("SKU-1,新親>新子,官网面包屑（原文）,\nUNKNOWN,新親>新子,推定（官网无页面）,\n","UNKNOWN");
        assertThat(mixed.matched()).isEqualTo(1);assertThat(mixed.getDeferred()).isEqualTo(1);
        service.confirm(7,mixed.importId());verify(paths).save(argThat(path->path.getProductId().equals("product-1")));
    }

    @Test void conflictingSourceTiersAndMalformedFourColumnCsvCannotWrite() {
        var p=ops("SKU-1,親>子,官网面包屑（原文）,\nALIAS-1,親＞子,推定（官网无页面）,\n",null);
        assertThat(p.unmatched()).isEqualTo(2);assertThat(p.newNodes()).isZero();
        var malformed=ops("SKU-1,親>子,官网面包屑（原文）,note,EXTRA\nSKU-1,親>子,官网面包屑（原文）,\"unclosed",null);
        assertThat(malformed.unmatched()).isEqualTo(2);
        assertThat(malformed.rows().get(0).breadcrumb()).contains("EXTRA");
        service.confirm(7,p.importId());service.confirm(7,malformed.importId());verify(paths,never()).save(any());
    }

    @Test void malformedPendingRowStillBlocksAValidAliasForTheSameProduct() {
        var p=flagged("Note","SKU-1,食品＞水,待核,EXTRA\nALIAS-1,食品＞水,推定\n");
        assertThat(p.matched()).isZero();
        assertThat(p.unmatched()).isEqualTo(2);
        assertThat(p.rows().get(0).flag()).isEqualTo("待核");
        assertThat(p.rows().get(1).reason()).contains("Conflicting");
        service.confirm(7,p.importId());
        verify(paths,never()).save(any());
        verify(nodes,never()).save(any());
    }

    @Test void systemRootDoesNotMakeNewImportedRootsExplicitlyOrdered() {
        var system=new CategoryTreeNode("system-uncategorized",null,Map.of("ja-JP","未分類"),List.of("system-uncategorized"),Integer.MAX_VALUE,"UNCATEGORIZED");
        system.setExplicitOrder(true);
        when(nodes.findAllByParentId(null)).thenReturn(List.of(system));
        var p=preview("SKU-1,食品＞水\n");
        service.confirm(7,p.importId());
        var captured=org.mockito.ArgumentCaptor.forClass(CategoryTreeNode.class);
        verify(nodes,times(2)).save(captured.capture());
        assertThat(captured.getAllValues().get(0).isExplicitOrder()).isFalse();
    }

    @Test void importsOnlyProvidedNamesWithoutApplyingBundledBusinessTranslations() {
        var mapping=mock(CategoryReviewedNames.class);
        List<List<String>> requestedPaths=new ArrayList<>();
        when(mapping.names(anyList())).thenAnswer(call->{
            List<String> path=call.getArgument(0);
            requestedPaths.add(List.copyOf(path));
            return Map.of("ja-JP",path.get(path.size()-1),"zh-CN","审核示例","zh-TW","審核範例","en-US","Reviewed example");
        });
        service=new CategoryPathImportService(jdbc,products,nodes,paths,mapping);
        var p=ops("SKU-1,例親>例子,官网面包屑（原文）,\n",null);
        verify(nodes,never()).save(any());
        service.confirm(7,p.importId());
        assertThat(requestedPaths).isEmpty();
        var root=nodes.findAllByParentId(null).get(0);
        assertThat(root.getName()).containsExactlyEntriesOf(Map.of("ja-JP","例親"));
        assertThat(nodes.findAllByParentId(root.getId()).get(0).getName()).containsEntry("ja-JP","例子");
    }

    @Test void opsXlsxSupportsSourceAndNoteInEitherOptionalColumnOrder() throws Exception {
        for(boolean sourceFirst:List.of(true,false)) {
            try(var book=new XSSFWorkbook();var out=new ByteArrayOutputStream()) {
                var sheet=book.createSheet();var h=sheet.createRow(0);
                String[] headers={"商品编号","costco分类路径",sourceFirst?"路径来源":"备注",sourceFirst?"Note":"路径来源"};
                String[] values={"SKU-1","例親>例中＞例子",sourceFirst?"官网面包屑（原文）":"note",sourceFirst?"note":"官网面包屑（原文）"};
                var row=sheet.createRow(1);
                for(int c=0;c<4;c++){h.createCell(c).setCellValue(headers[c]);row.createCell(c).setCellValue(values[c]);}
                book.write(out);
                var p=service.preview(7,true,new MockMultipartFile("file","ops.xlsx","application/octet-stream",out.toByteArray()));
                assertThat(p.matched()).isEqualTo(1);assertThat(p.rows().get(0).sourceTier()).isEqualTo("官网面包屑（原文）");
                assertThat(p.rows().get(0).flag()).isEqualTo("note");
            }
        }
    }

    @Test void persistsRawInferredClosestAndCustomFlagsOnlyOnConfirmAndReimportsIdempotently() {
        for(String header:List.of("备注","标记","Note","Flag","NOTE","flag"))
            for(String flag:List.of("推定","最接近路径","closest path"," 仓库无官网页面，自选路径 ","待核x")) {
                String quoted="\""+flag+"\"";
                String previous=jdbc.queryForObject("select category_import_flag from bb_product",String.class);
                var p=flagged(header,"SKU-1,食品＞水,"+quoted+"\n");
                assertThat(p.matched()).isEqualTo(1); assertThat(p.rows().get(0).flag()).isEqualTo(flag);
                assertThat(jdbc.queryForObject("select category_import_flag from bb_product",String.class)).isEqualTo(previous);
                var confirmed=service.confirm(7,p.importId());
                assertThat(confirmed.productCountAfter()).isEqualTo(1);
                assertThat(jdbc.queryForObject("select category_import_flag from bb_product",String.class)).isEqualTo(flag);
                assertThat(service.audit(7).stream().filter(a->a.importId().equals(p.importId())).findFirst().orElseThrow().rows().get(0).flag()).isEqualTo(flag);
                clearInvocations(paths,nodes);
                service.confirm(7,p.importId()); verify(paths,never()).save(any()); verify(nodes,never()).save(any());
                var rerun=flagged(header,"SKU-1,食品＞水,"+quoted+"\n");
                assertThat(rerun.newNodes()).isZero(); service.confirm(7,rerun.importId());
                assertThat(jdbc.queryForObject("select category_import_flag from bb_product",String.class)).isEqualTo(flag);
            }
        service.confirm(7,preview("SKU-1,食品＞水\n").importId());
        service.confirm(7,flagged("Note","SKU-1,食品＞水,\n").importId());
        assertThat(jdbc.queryForObject("select category_import_flag from bb_product",String.class)).isEqualTo("待核x");
        assertThat(jdbc.queryForMap("select price,stock,published from bb_product"))
                .containsEntry("PRICE",new java.math.BigDecimal("123")).containsEntry("STOCK",5).containsEntry("PUBLISHED",true);
        assertThat(jdbc.queryForObject("select count(*) from bb_product",Integer.class)).isEqualTo(1);
        verify(products,never()).save(any()); verify(products,never()).delete(any());
    }

    @Test void pendingRowsAreReturnedAndNeverOverwriteExistingPathOrFlagEvenThroughAliases() {
        jdbc.update("update bb_product set category_import_flag='existing'");
        for(String path:List.of("食品＞水","")) {
            var p=flagged("标记","SKU-1,"+path+", 待核 \nALIAS-1,食品＞水,推定\n");
            assertThat(p.matched()).isZero(); assertThat(p.unmatched()).isEqualTo(2); assertThat(p.newNodes()).isZero();
            assertThat(p.rows().get(0).flag()).isEqualTo(" 待核 ");
            assertThat(p.rows().get(0).reason()).contains("Identity unverified");
            assertThat(new String(service.unmatchedCsv(7,p.importId()),StandardCharsets.UTF_8)).contains("Flag,Reason"," 待核 ","SKU-1","ALIAS-1");
            service.confirm(7,p.importId());
        }
        verify(paths,never()).save(any()); verify(nodes,never()).save(any());
        assertThat(jdbc.queryForObject("select category_import_flag from bb_product",String.class)).isEqualTo("existing");
    }

    @Test void conflictingFlagsAreAllReturnedWhileIdenticalDuplicatesRemainIdempotent() {
        var conflict=flagged("Flag","SKU-1,食品＞水,推定\nALIAS-1,食品＞水,closest path\n");
        assertThat(conflict.unmatched()).isEqualTo(2); assertThat(conflict.newNodes()).isZero();
        service.confirm(7,conflict.importId()); verify(paths,never()).save(any());
        var duplicate=flagged("Flag","SKU-1,食品＞水,推定\nALIAS-1,食品＞水,推定\n");
        assertThat(duplicate.matched()).isEqualTo(2); service.confirm(7,duplicate.importId());
        assertThat(jdbc.queryForObject("select category_import_flag from bb_product",String.class)).isEqualTo("推定");
    }

    @Test void optionalFlagAliasesAndThreeCasesWorkInXlsxIncludingBlankCells() throws Exception {
        for(String header:List.of("备注","标记","Note","Flag")) for(String flag:List.of("推定","closest path","待核","")) {
            try(var book=new XSSFWorkbook();var out=new ByteArrayOutputStream()) {
                var sheet=book.createSheet(); var h=sheet.createRow(0);
                h.createCell(0).setCellValue("商品编号");h.createCell(1).setCellValue("分类路径");h.createCell(2).setCellValue(header);
                var r=sheet.createRow(1);r.createCell(0).setCellValue("SKU-1");r.createCell(1).setCellValue("食品＞水");
                if(!flag.isEmpty()) r.createCell(2).setCellValue(flag);
                book.write(out);
                var p=service.preview(7,true,new MockMultipartFile("file","flags.xlsx","application/octet-stream",out.toByteArray()));
                assertThat(p.rows().get(0).flag()).isEqualTo(flag);
                assertThat(p.matched()).isEqualTo(flag.equals("待核")?0:1);
                service.confirm(7,p.importId());
            }
        }
    }

    @Test void rejectsUnknownHeadersAndRetainsFourthColumnsAndMalformedQuotedFlags() {
        assertThatThrownBy(()->flagged("unexpected","SKU-1,食品＞水,推定\n")).isInstanceOf(IllegalArgumentException.class);
        var p=flagged("Note","SKU-1,食品＞水,推定,not lost\nSKU-1,食品＞水,\"unterminated\n");
        assertThat(p.unmatched()).isEqualTo(2);
        assertThat(new String(service.unmatchedCsv(7,p.importId()),StandardCharsets.UTF_8)).contains("not lost","unterminated","推定");
        service.confirm(7,p.importId()); verify(paths,never()).save(any());
    }

    @Test void acceptsAllEnglishAndChineseHeaderCombinationsInCsvAndXlsx() throws Exception {
        for (String sku : List.of("SKU", "商品编号")) for (String path : List.of("Costco breadcrumb", "官网面包屑路径", "分类路径", "costco分类路径")) {
            var csv = service.preview(7,true,new MockMultipartFile("file","input.csv","text/csv",("\uFEFF"+sku+","+path+"\nSKU-1,食品＞水\n").getBytes(StandardCharsets.UTF_8)));
            assertThat(csv.matched()).isEqualTo(1);
            try (var book = new XSSFWorkbook(); var bytes = new ByteArrayOutputStream()) {
                var sheet=book.createSheet(); var header=sheet.createRow(0); header.createCell(0).setCellValue(sku); header.createCell(1).setCellValue(path);
                var row=sheet.createRow(1); row.createCell(0).setCellValue("SKU-1"); row.createCell(1).setCellValue("食品＞水"); book.write(bytes);
                assertThat(service.preview(7,true,new MockMultipartFile("file","input.xlsx","application/octet-stream",bytes.toByteArray())).matched()).isEqualTo(1);
            }
        }
    }

    @Test void rejectsHeadersOffFirstRowAndReportsExtraColumnsWithoutDroppingThem() {
        assertThatThrownBy(() -> service.preview(7,true,new MockMultipartFile("file","input.csv","text/csv","\n商品编号,分类路径\nSKU-1,食品＞水".getBytes(StandardCharsets.UTF_8)))).isInstanceOf(IllegalArgumentException.class);
        var p=preview("SKU-1,食品＞水,extra\n");
        assertThat(p.unmatched()).isEqualTo(1); assertThat(p.rows().get(0).breadcrumb()).contains("extra");
    }

    @Test void downloadedTemplateUsesStableIdentitiesWithoutBusinessExamples() {
        String template=new String(service.exportMappings(7,false,true),StandardCharsets.UTF_8);
        assertThat(template).isEqualTo("productId,itemNumber,version,categoryNodeId,categoryPath,sortOrder,operation\r\n");
    }

    @Test void mappingExportRoundTripsAndRepeatedConfirmationDoesNotWriteAgain() {
        var node=new CategoryTreeNode("leaf",null,Map.of("ja-JP","Example, \"quoted\""),List.of("leaf"),4,null);
        when(nodes.findAll()).thenReturn(List.of(node));when(nodes.findById("leaf")).thenReturn(Optional.of(node));
        when(paths.findById("product-1")).thenReturn(Optional.of(new com.bobbuy.model.ProductPrimaryCategoryPath("product-1","leaf")));
        byte[] exported=new String(service.exportMappings(7,false,false),StandardCharsets.UTF_8).replace("productId,", "\"productId\",").getBytes(StandardCharsets.UTF_8);
        var p=service.preview(7,false,new MockMultipartFile("file","mapping.csv","text/csv",exported));
        assertThat(p.matched()).isEqualTo(1);verify(paths,never()).save(any());
        service.confirm(7,false,p.importId());service.confirm(7,false,p.importId());verify(paths,times(1)).save(any());
        verify(products,never()).save(any());
    }

    @Test void changedProductVersionOrScopeRejectsWholeBatchBeforeWriting() {
        var p=preview("SKU-1,Example>Child\n");
        var product=products.findById("product-1").orElseThrow();
        when(product.getRecordVersion()).thenReturn(1L);
        assertThatThrownBy(()->service.confirm(7,true,p.importId())).hasMessageContaining("product row 2");
        when(product.getRecordVersion()).thenReturn(0L);when(product.getMerchantId()).thenReturn(8L);
        assertThatThrownBy(()->service.confirm(7,false,p.importId())).hasMessageContaining("access changed");
        verify(paths,never()).save(any());verify(nodes,never()).save(any());
    }

    @Test void changedTreeOrderOrAmbiguousIdentityRejectsBeforeAnyWrites() {
        var node=new CategoryTreeNode("root",null,Map.of("ja-JP","Root"),List.of("root"),0,null);
        when(nodes.findAll()).thenReturn(List.of(node));var p=preview("SKU-1,Example>Child\n");
        node.setSortOrder(3);
        assertThatThrownBy(()->service.confirm(7,true,p.importId())).hasMessageContaining("category structure/order");
        node.setSortOrder(0);when(products.findAllByItemNumber("SKU-1")).thenReturn(List.of());
        assertThatThrownBy(()->service.confirm(7,true,p.importId())).hasMessageContaining("identity row 2");
        verify(paths,never()).save(any());verify(nodes,never()).save(any());
    }

    @Test void rejectsEveryConflictingAssignmentByProductIdBeforePlanningOrWriting() {
        var p=preview("SKU-1,食品・飲料＞野菜・果物\nALIAS-1,家電＞キッチン家電\nSKU-1,食品・飲料＞野菜・果物\n");
        assertThat(p.matched()).isZero();assertThat(p.unmatched()).isEqualTo(3);assertThat(p.newNodes()).isZero();
        assertThat(p.rows()).allSatisfy(r->{assertThat(r.outcome()).isEqualTo("UNMATCHED");assertThat(r.reason()).contains("Conflicting");});
        assertThat(new String(service.unmatchedCsv(7,p.importId()),StandardCharsets.UTF_8)).contains("家電＞キッチン家電","食品・飲料＞野菜・果物");
        service.confirm(7,p.importId());verify(paths,never()).save(any());verify(nodes,never()).save(any());
    }

    @Test void acceptsEquivalentDuplicatesAndTrimsOnlySegmentEdgesWhenWritingJapaneseNames() {
        var p=preview("SKU-1,食品・飲料＞野菜・果物\nSKU-1,食品・飲料 ＞ 野菜・果物\n");
        assertThat(p.matched()).isEqualTo(2);assertThat(p.unmatched()).isZero();assertThat(p.newNodes()).isEqualTo(2);
        assertThat(p.rows().get(1).breadcrumb()).isEqualTo("食品・飲料 ＞ 野菜・果物");
        service.confirm(7,p.importId());
        var captured=org.mockito.ArgumentCaptor.forClass(CategoryTreeNode.class);
        verify(nodes,times(2)).save(captured.capture());
        assertThat(captured.getAllValues()).extracting(n->n.getName().get("ja-JP")).containsExactly("食品・飲料","野菜・果物");
        verify(paths,times(2)).save(any());
    }

    @Test void retainsMultilineAndMalformedOriginalInputAsUnmatchedWithoutTruncatedWrites() {
        String multiline="SKU-1,\"食品・飲料＞\r\n野菜・果物\"\r\n";
        String malformed="SKU-1,\"家電＞キッチン家電\nremaining input";
        var p=preview(multiline+malformed);
        assertThat(p.rows()).hasSize(2);assertThat(p.matched()).isZero();assertThat(p.newNodes()).isZero();
        assertThat(p.rows().get(0).breadcrumb()).isEqualTo("食品・飲料＞\r\n野菜・果物");
        assertThat(p.rows().get(1).breadcrumb()).isEqualTo(malformed);
        String exported=new String(service.unmatchedCsv(7,p.importId()),StandardCharsets.UTF_8);
        assertThat(exported).contains("食品・飲料＞\r\n野菜・果物","remaining input","Malformed CSV");
        service.confirm(7,p.importId());verify(paths,never()).save(any());verify(nodes,never()).save(any());
    }

    @Test void parsesEscapedQuotesCommasAndLogicalRecordsWithoutChangingNames() {
        var rows=CategoryPathImportService.parse("input.csv","SKU,Costco breadcrumb\r\nSKU-1,\"食品,飲料＞\"\"限定\"\"\n商品\"\r\nSKU-2,家電\r\n".getBytes(StandardCharsets.UTF_8));
        assertThat(rows).hasSize(3);
        assertThat(rows.get(1)).containsExactly("SKU-1","食品,飲料＞\"限定\"\n商品");
        assertThat(rows.get(2)).containsExactly("SKU-2","家電");
    }

    @Test void rejectsStrayQuotesAndCharactersAfterClosingQuoteAndKeepsFollowingRecords() {
        var p=preview("SKU-1,食\"品＞野菜\nSKU-1,\"家電\"suffix\nSKU-1,食品＞野菜\n");
        assertThat(p.unmatched()).isEqualTo(2);assertThat(p.matched()).isEqualTo(1);
        assertThat(p.rows().get(0).breadcrumb()).isEqualTo("SKU-1,食\"品＞野菜");
        assertThat(p.rows().get(1).breadcrumb()).isEqualTo("SKU-1,\"家電\"suffix");
    }
    @Test void readsUtf8CsvWithoutChangingJapaneseBreadcrumbNames() {
        var rows=CategoryPathImportService.parse("fixture.csv",("\uFEFFSKU,Costco breadcrumb\nFIXTURE-1,食品・飲料＞野菜・果物\n").getBytes(StandardCharsets.UTF_8));
        assertThat(rows).hasSize(2);
        assertThat(rows.get(0)).containsExactly("SKU","Costco breadcrumb");
        assertThat(rows.get(1)).containsExactly("FIXTURE-1","食品・飲料＞野菜・果物");
    }

    @Test void readsOnlyTheTwoContractColumnsFromFirstXlsxSheet() throws Exception {
        byte[] bytes;
        try(var book=new XSSFWorkbook();var out=new ByteArrayOutputStream()) {
            var sheet=book.createSheet("fixture");
            var header=sheet.createRow(0);header.createCell(0).setCellValue("SKU");header.createCell(1).setCellValue("Costco breadcrumb");
            var row=sheet.createRow(1);row.createCell(0).setCellValue("FIXTURE-2");row.createCell(1).setCellValue("家電＞キッチン家電");
            book.write(out);bytes=out.toByteArray();
        }
        assertThat(CategoryPathImportService.parse("fixture.xlsx",bytes).get(1)).containsExactly("FIXTURE-2","家電＞キッチン家電");
    }

    @Test void rejectsUncontractedFileTypesInsteadOfGuessing() {
        assertThatThrownBy(()->CategoryPathImportService.parse("fixture.txt",new byte[0]))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("CSV or XLSX");
    }
}
