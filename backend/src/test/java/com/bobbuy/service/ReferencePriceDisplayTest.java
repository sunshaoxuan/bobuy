package com.bobbuy.service;
import com.bobbuy.model.RecommendationItem;
import java.math.BigDecimal;
import java.time.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class ReferencePriceDisplayTest {
 private RecommendationItem facts(){var f=new RecommendationItem();f.referencePrice=new BigDecimal("1198");f.originalPrice=new BigDecimal("1498");f.discountAmount=new BigDecimal("300");f.offerStart=LocalDate.parse("2026-11-02");f.offerEnd=LocalDate.parse("2026-11-08");return f;}
 @Test void inclusiveJapanEndAndSourceUnchanged(){var f=facts();var before=ReferencePriceDisplay.of(f,Instant.parse("2026-11-08T14:59:59.999Z"));assertThat(before.amount()).isEqualByComparingTo("1198");assertThat(before.discountAmount()).isEqualByComparingTo("300");var after=ReferencePriceDisplay.of(f,Instant.parse("2026-11-08T15:00:00Z"));assertThat(after.amount()).isEqualByComparingTo("1498");assertThat(after.originalPrice()).isNull();assertThat(after.discountAmount()).isNull();assertThat(f.referencePrice).isEqualByComparingTo("1198");}
 @Test void futurePartialAndUnknownOriginal(){var f=facts();assertThat(ReferencePriceDisplay.of(f,Instant.parse("2026-11-01T01:00:00Z")).amount()).isEqualByComparingTo("1498");f.offerStart=null;assertThat(ReferencePriceDisplay.of(f,Instant.parse("2026-11-09T01:00:00Z")).amount()).isEqualByComparingTo("1498");f.originalPrice=null;assertThat(ReferencePriceDisplay.of(f,Instant.parse("2026-11-09T01:00:00Z")).amount()).isNull();f.discountAmount=null;assertThat(ReferencePriceDisplay.of(f,Instant.parse("2026-11-09T01:00:00Z")).amount()).isEqualByComparingTo("1198");f.referencePrice=BigDecimal.ZERO;assertThat(ReferencePriceDisplay.of(f,Instant.parse("2026-11-09T01:00:00Z")).amount()).isEqualByComparingTo("0");}
}
