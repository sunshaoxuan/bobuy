package com.bobbuy.api;

import com.bobbuy.service.CategoryStructureTransferService;
import com.bobbuy.service.CategoryTreeManagementService;
import com.bobbuy.service.CategoryImportConflict;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CategoryImportHttpErrorTest {
  @Test void staleConfirmationAndMalformedFileHaveActionableHttpResponses() throws Exception {
    var transfer=mock(CategoryStructureTransferService.class);
    var controller=new CategoryTreeController(mock(CategoryTreeManagementService.class));
    org.springframework.test.util.ReflectionTestUtils.setField(controller,"transfer",transfer);
    var mvc=MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new CategoryImportExceptionHandler()).build();
    var file=new MockMultipartFile("file","synthetic.csv","text/csv",new byte[]{1});
    when(transfer.confirm(any(),eq("old"),eq("hash"),eq(true))).thenThrow(new CategoryImportConflict("Category tree changed; preview again"));
    mvc.perform(multipart("/api/category-tree/import/confirm").file(file).param("revision","old").param("fileHash","hash").param("confirmed","true"))
      .andExpect(status().isConflict()).andExpect(jsonPath("message").value("Category tree changed; preview again"));
    when(transfer.preview(any())).thenThrow(new IllegalArgumentException("Use the downloaded CSV template header"));
    mvc.perform(multipart("/api/category-tree/import/preview").file(file)).andExpect(status().isBadRequest())
      .andExpect(jsonPath("message").value("Use the downloaded CSV template header"));
  }
  @Test void foreignPreviewIdentityHasGenericNotFoundResponse() throws Exception {
    var service=mock(com.bobbuy.service.CategoryPathImportService.class);
    var principal=new com.bobbuy.security.BobbuyAuthenticatedUser(2L,"synthetic","Synthetic",java.util.Set.of());
    var auth=new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(principal,null,java.util.List.of());
    when(service.confirm(2L,false,"foreign-preview")).thenThrow(new java.util.NoSuchElementException("private details"));
    var mvc=MockMvcBuilders.standaloneSetup(new CategoryPathImportController(service))
        .setControllerAdvice(new CategoryImportExceptionHandler()).build();
    mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/category-path-import/foreign-preview/confirm").principal(auth))
        .andExpect(status().isNotFound()).andExpect(jsonPath("message").value("Import not found"));
  }
}
