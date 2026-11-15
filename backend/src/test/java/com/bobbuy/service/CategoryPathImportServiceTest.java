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

    @BeforeEach void setup() {
        var jdbc=new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";DB_CLOSE_DELAY=-1"));
        jdbc.execute("create table bb_category_path_import(id varchar primary key,actor_id bigint,file_name varchar,file_sha256 varchar,status varchar,product_count_before bigint,product_count_after bigint,matched_count int,new_node_count int,unmatched_count int,created_at timestamp default current_timestamp,confirmed_at timestamp)");
        jdbc.execute("create table bb_category_path_import_row(import_id varchar,row_number int,sku varchar,breadcrumb varchar,product_id varchar,outcome varchar,reason varchar)");
        service=new CategoryPathImportService(jdbc,products,nodes,paths);
        when(nodes.lockTree()).thenReturn(Optional.of(new CategoryTreeNode("system-uncategorized",null,Map.of("ja-JP","未分類"),List.of("system-uncategorized"),Integer.MAX_VALUE,"UNCATEGORIZED")));
        Product product=mock(Product.class);when(product.getId()).thenReturn("product-1");
        when(products.findAllByItemNumber("SKU-1")).thenReturn(List.of(product));
        when(products.findAllByItemNumber("ALIAS-1")).thenReturn(List.of(product));
        when(products.count()).thenReturn(1L);
        List<CategoryTreeNode> saved=new ArrayList<>();
        when(nodes.findAllByParentId(any())).thenAnswer(call->saved.stream().filter(n->Objects.equals(n.getParentId(),call.getArgument(0))).toList());
        when(nodes.save(any())).thenAnswer(call->{CategoryTreeNode n=call.getArgument(0);saved.add(n);return n;});
    }
    private CategoryPathImportService.Preview preview(String records) {
        return service.preview(7,true,new MockMultipartFile("file","input.csv","text/csv",("SKU,Costco breadcrumb\r\n"+records).getBytes(StandardCharsets.UTF_8)));
    }

    @Test void acceptsAllEnglishAndChineseHeaderCombinationsInCsvAndXlsx() throws Exception {
        for (String sku : List.of("SKU", "商品编号")) for (String path : List.of("Costco breadcrumb", "官网面包屑路径", "分类路径")) {
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

    @Test void downloadedTemplateUsesChineseHeadersAndOnePreservedSyntheticExample() {
        var response = new com.bobbuy.api.CategoryPathImportController(service).template();
        var rows=CategoryPathImportService.parse("template.csv",response.getBody());
        assertThat(rows).hasSize(2); assertThat(rows.get(0)).containsExactly("商品编号","官网面包屑路径");
        assertThat(rows.get(1)).containsExactly("FIXTURE-0001","食品・飲料＞野菜・果物");
        assertThat(response.getHeaders().getFirst("Content-Disposition")).contains("attachment");
        var p=service.preview(7,true,new MockMultipartFile("file","template.csv","text/csv",response.getBody()));
        assertThat(p.unmatched()).isEqualTo(1); assertThat(p.rows().get(0).sku()).isEqualTo("FIXTURE-0001");
    }

    @Test void rejectsEveryConflictingAssignmentByProductIdBeforePlanningOrWriting() {
        var p=preview("SKU-1,食品・飲料＞野菜・果物\nALIAS-1,家電＞キッチン家電\nSKU-1,食品・飲料＞野菜・果物\n");
        assertThat(p.matched()).isZero();assertThat(p.unmatched()).isEqualTo(3);assertThat(p.newNodes()).isZero();
        assertThat(p.rows()).allSatisfy(r->{assertThat(r.outcome()).isEqualTo("UNMATCHED");assertThat(r.reason()).contains("Conflicting");});
        assertThat(new String(service.unmatchedCsv(7,p.importId()),StandardCharsets.UTF_8)).contains("家電＞キッチン家電","食品・飲料＞野菜・果物");
        service.confirm(7,p.importId());verifyNoInteractions(paths);verify(nodes,never()).save(any());
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
        service.confirm(7,p.importId());verifyNoInteractions(paths);verify(nodes,never()).save(any());
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
