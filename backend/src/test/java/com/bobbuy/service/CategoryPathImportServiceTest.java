package com.bobbuy.service;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CategoryPathImportServiceTest {
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
