package com.bobbuy.api;

import com.bobbuy.repository.UserRepository;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.BobbuyStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Synthetic API fixtures; the PostgreSQL seed and constraints have a separate rehearsal. */
@SpringBootTest(properties="bobbuy.security.header-auth.enabled=false")
@AutoConfigureMockMvc
@Transactional
class GeographicAreaDirectoryIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired BobbuyStore store;
    @Autowired UserRepository users;
    @Autowired JwtTokenService tokens;
    private static final String PUBLIC = "/api/storefront/geographic-areas";
    private static final String MERCHANT = "/api/merchant/geographic-areas";

    @BeforeEach void fixture() {
        jdbc.update("INSERT INTO bb_geographic_area(code,parent_code,level,name,reading) VALUES " +
            "('JP',null,1,'Japan',null),('US',null,1,'United States',null)," +
            "('JP-13','JP',2,'東京都',null),('JP-13101','JP-13',3,'千代田区','ちよだく')");
    }

    @Test void readsOnlyDirectChildrenAndDistinguishesMissingParentFromLeaf() throws Exception {
        mvc.perform(get(PUBLIC)).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2))
            .andExpect(jsonPath("$.data[0].code").value("JP")).andExpect(jsonPath("$.data[1].code").value("US"));
        mvc.perform(get(PUBLIC).param("parentCode","JP")).andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(1)).andExpect(jsonPath("$.data[0].code").value("JP-13"));
        mvc.perform(get(PUBLIC).param("parentCode","JP-13")).andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].name").value("千代田区")).andExpect(jsonPath("$.data[0].parentCode").value("JP-13"));
        for (String leaf : new String[]{"US","JP-13101"}) {
            mvc.perform(get(PUBLIC).param("parentCode",leaf)).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        }
        mvc.perform(get(PUBLIC).param("parentCode","ZZ")).andExpect(status().isNotFound())
            .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"));
    }

    @Test void rejectsMalformedParents() throws Exception {
        for (String invalid : new String[]{"", " ", "jp", "JP-1", "JP-001", "JP-130001", "JP-13/../US", "' OR 1=1"}) {
            mvc.perform(get(PUBLIC).param("parentCode",invalid)).andExpect(status().isBadRequest());
        }
    }

    @Test void keepsMerchantRoleBoundaryAndHasNoWriteContract() throws Exception {
        store.seed();
        String agent = tokens.createAccessToken(users.findById(1000L).orElseThrow());
        String customer = tokens.createAccessToken(users.findById(1001L).orElseThrow());
        mvc.perform(get(MERCHANT)).andExpect(status().isUnauthorized());
        mvc.perform(get(MERCHANT).header("Authorization","Bearer "+customer)).andExpect(status().isForbidden());
        mvc.perform(get(MERCHANT).header("Authorization","Bearer "+agent)).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(2));
        mvc.perform(post(MERCHANT).header("Authorization","Bearer "+agent)).andExpect(status().isMethodNotAllowed());
        mvc.perform(delete(MERCHANT).header("Authorization","Bearer "+agent)).andExpect(status().isMethodNotAllowed());
    }
}
