package com.bobbuy.api;

import com.bobbuy.SecurityConfig;
import com.bobbuy.security.*;
import com.bobbuy.service.CategoryTreeManagementService;
import com.bobbuy.service.CategoryPathImportService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({CategoryTreeController.class, CategoryPathImportController.class})
@Import({SecurityConfig.class, AuthCookieService.class})
@org.springframework.test.context.ContextConfiguration(classes = {CategoryTreeController.class, CategoryPathImportController.class, SecurityConfig.class, WebConfig.class, RequestLoggingInterceptor.class})
class CategoryTreeAuthorizationTest {
    @Autowired MockMvc mvc;
    @MockBean CategoryTreeManagementService trees;
    @MockBean CategoryPathImportService imports;
    @MockBean com.bobbuy.service.CategoryImageService images;
    @MockBean com.bobbuy.service.CategoryStructureTransferService transfer;
    @MockBean InternalServiceTokenFilter internal;
    @MockBean TokenAuthenticationFilter token;
    @MockBean RoleInjectionFilter role;
    @MockBean RequestMetricsService metrics;

    @BeforeEach void setup() throws Exception {
        doAnswer(c -> {((FilterChain)c.getArgument(2)).doFilter(c.getArgument(0),c.getArgument(1));return null;})
            .when(internal).doFilter(any(ServletRequest.class),any(ServletResponse.class),any(FilterChain.class));
        doAnswer(c -> {((FilterChain)c.getArgument(2)).doFilter(c.getArgument(0),c.getArgument(1));return null;})
            .when(token).doFilter(any(ServletRequest.class),any(ServletResponse.class),any(FilterChain.class));
        doAnswer(c -> {
            var request=(jakarta.servlet.http.HttpServletRequest)c.getArgument(0);
            String authority=request.getHeader("Test-Authority");
            if(authority!=null)SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new BobbuyAuthenticatedUser(7L,"test","Test",java.util.Set.of()),null,List.of(new SimpleGrantedAuthority("ROLE_"+authority))));
            ((FilterChain)c.getArgument(2)).doFilter(request,c.getArgument(1));return null;
        }).when(role).doFilter(any(ServletRequest.class),any(ServletResponse.class),any(FilterChain.class));
    }

    @Test void actualSecurityChainRestrictsAllTreeOperationsAndTemplate() throws Exception {
        for(String authority:List.of("CUSTOMER","AGENT","PLATFORM_ADMIN")) {
            int expected=authority.equals("CUSTOMER")?403:200;
            mvc.perform(get("/api/category-tree").header("Test-Authority",authority)).andExpect(status().is(expected));
            mvc.perform(post("/api/category-tree").header("Test-Authority",authority).contentType("application/json").content("{\"parentId\":null,\"name\":{\"ja-JP\":\"食品\"}}" )).andExpect(status().is(expected));
            mvc.perform(put("/api/category-tree/node").header("Test-Authority",authority).contentType("application/json").content("{\"parentId\":null,\"sortOrder\":0}")).andExpect(status().is(expected));
            mvc.perform(delete("/api/category-tree/node").header("Test-Authority",authority)).andExpect(status().is(expected));
            mvc.perform(put("/api/category-tree/products/product").header("Test-Authority",authority).contentType("application/json").content("{\"categoryNodeId\":null}")).andExpect(status().is(expected));
            mvc.perform(get("/api/category-tree/export.csv").header("Test-Authority",authority)).andExpect(status().is(expected));
            for(String route:List.of("/api/category-tree/import/preview","/api/category-tree/import/confirm","/api/category-tree/node/image"))
                mvc.perform(multipart(route).file("file",new byte[]{1}).param("revision","test").param("fileHash","test").param("confirmed","true").header("Test-Authority",authority)).andExpect(status().is(expected));
            for(String route:List.of("/api/category-path-import/template.csv","/api/category-path-import/export.csv")) mvc.perform(get(route).header("Test-Authority",authority)).andExpect(status().is(expected));
        }
        mvc.perform(get("/api/category-tree")).andExpect(status().isUnauthorized());
    }
}
