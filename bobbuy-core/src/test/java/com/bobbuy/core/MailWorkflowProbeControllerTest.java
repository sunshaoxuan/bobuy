package com.bobbuy.core;

import com.bobbuy.security.InternalServiceTokenFilter;
import com.bobbuy.service.MailSettingsService;
import com.bobbuy.service.MailSettingsService.TestOutcome;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MailWorkflowProbeControllerTest {
    @Test void requiresExistingTokenAndActualLoopbackAndReturnsOnlyCategory() throws Exception {
        var mail = mock(MailSettingsService.class);
        when(mail.testFromWorkflow()).thenReturn(TestOutcome.SUBMIT_UNKNOWN);
        var mvc = MockMvcBuilders.standaloneSetup(new MailWorkflowProbeController(mail))
            .addFilters(new InternalServiceTokenFilter("synthetic-token")).build();
        String path = "/internal/account-mail/workflow-test";
        mvc.perform(post(path)).andExpect(status().isUnauthorized());
        mvc.perform(post(path).header("X-BOBBUY-SERVICE-TOKEN", "incorrect"))
            .andExpect(status().isUnauthorized());
        mvc.perform(post(path).header("X-BOBBUY-SERVICE-TOKEN", "synthetic-token")
            .header("X-BOBBUY-INTERNAL-SERVICE", "mail-workflow-probe")
            .header("X-Forwarded-For", "127.0.0.1")
            .with(request -> { request.setRemoteAddr("192.0.2.10"); return request; }))
            .andExpect(status().isNotFound());
        mvc.perform(post(path).header("X-BOBBUY-SERVICE-TOKEN", "synthetic-token"))
            .andExpect(status().isNotFound());
        verifyNoInteractions(mail);
        mvc.perform(post(path).header("X-BOBBUY-SERVICE-TOKEN", "synthetic-token")
            .header("X-BOBBUY-INTERNAL-SERVICE", "mail-workflow-probe")
            .with(request -> { request.setRemoteAddr("127.0.0.1"); return request; }))
            .andExpect(status().isOk()).andExpect(content().string("SUBMIT_UNKNOWN"));
        verify(mail).testFromWorkflow();
    }
}
