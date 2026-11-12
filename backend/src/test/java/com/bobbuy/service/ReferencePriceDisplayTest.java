package com.bobbuy.service;
import com.bobbuy.model.RecommendationItem;
import java.math.BigDecimal;
import java.time.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class ReferencePriceDisplayTest {
 private RecommendationItem facts(){var f=new RecommendationItem();f.referencePrice=new BigDecimal("999");f.originalPrice=new BigDecimal("9999");f.discountAmount=new BigDecimal("9000");f.priceChange=new RecommendationItem.PriceChange(1L,"PC-1","PROMOTION","ACTIVE",Instant.parse("2026-11-01T15:00:00Z"),Instant.parse("2026-11-08T15:00:00Z"),new BigDecimal("1198"),new BigDecimal("1498"),new BigDecimal("1198"),true);return f;}
 @Test void exclusiveJapanEndAndDocumentAuthority(){var f=facts();var before=ReferencePriceDisplay.of(f,Instant.parse("2026-11-08T14:59:59.999Z"));assertThat(before.amount()).isEqualByComparingTo("1198");assertThat(before.discountAmount()).isEqualByComparingTo("300");var after=ReferencePriceDisplay.of(f,Instant.parse("2026-11-08T15:00:00Z"));assertThat(after.amount()).isEqualByComparingTo("1498");assertThat(after.originalPrice()).isNull();assertThat(after.discountAmount()).isNull();assertThat(f.referencePrice).isEqualByComparingTo("999");}
 @Test void futureUsesDocumentRegularAndSourceAloneCannotSetPrice(){var f=facts();assertThat(ReferencePriceDisplay.of(f,Instant.parse("2026-11-01T01:00:00Z")).amount()).isEqualByComparingTo("1498");f.priceChange=null;var unknown=ReferencePriceDisplay.of(f,Instant.parse("2026-11-09T01:00:00Z"));assertThat(unknown.amount()).isNull();assertThat(unknown.state()).isEqualTo("UNKNOWN");}
}
