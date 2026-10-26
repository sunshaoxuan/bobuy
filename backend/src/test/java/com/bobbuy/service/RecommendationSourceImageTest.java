package com.bobbuy.service;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class RecommendationSourceImageTest {
    @Test void rejectsNonOfficialHostsPortsCredentialsAndRedirectTargetsBeforeNetwork() {
        var source = new RecommendationSourceImage();
        for (String url : new String[]{"http://cds2.costcojapan.jp/cds/mail-images/test.png", "https://127.0.0.1/test.png",
                "https://cds2.costcojapan.jp.evil.test/cds/mail-images/x.png", "https://cds2.costcojapan.jp:443/cds/mail-images/x.png",
                "https://user@cds2.costcojapan.jp/cds/mail-images/x.png", "https://cds2.costcojapan.jp/other.png"})
            assertThatThrownBy(() -> source.fetch(url)).isInstanceOf(com.bobbuy.api.response.ApiException.class);
    }
}
