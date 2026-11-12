package com.bobbuy.service;
import com.bobbuy.model.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class PriceAdjustmentResolverTest {
 final Instant start=Instant.parse("2026-11-12T15:00:00Z"),end=start.plusSeconds(3600);
 ProductPriceAdjustment d(long id,ProductPriceAdjustment.Type type,String amount){var d=new ProductPriceAdjustment();d.id=id;d.merchantId=1L;d.type=type;d.status=ProductPriceAdjustment.Status.APPROVED;d.channel="STOREFRONT";d.currency="JPY";d.startsAt=start;d.endsAt=type==ProductPriceAdjustment.Type.PERMANENT?null:end;d.approvedAt=start.minusSeconds(1);var l=new ProductPriceAdjustmentLine();l.document=d;l.productId="p";l.unit="1 pack";l.amount=new BigDecimal(amount);l.beforeAmount=new BigDecimal("100");d.lines.add(l);return d;}
 PriceAdjustmentResolver.Price price(List<ProductPriceAdjustment> rows,Instant now){return PriceAdjustmentResolver.resolve(rows,"p",1L,"STOREFRONT","JPY","1 pack",new BigDecimal("100"),now);}
 @Test void halfOpenPromotionBoundariesAndReversion(){var d=d(1,ProductPriceAdjustment.Type.PROMOTION,"80");assertThat(price(List.of(d),start.minusNanos(1)).amount()).isEqualByComparingTo("100");assertThat(price(List.of(d),start).promotion()).isTrue();assertThat(price(List.of(d),end.minusNanos(1)).amount()).isEqualByComparingTo("80");assertThat(price(List.of(d),end).amount()).isEqualByComparingTo("100");assertThat(price(List.of(d),end).promotion()).isFalse();}
 @Test void temporaryDecreaseAndPermanentDecreaseNeverHavePromotionFlag(){for(var type:List.of(ProductPriceAdjustment.Type.TEMPORARY,ProductPriceAdjustment.Type.PERMANENT)){var p=price(List.of(d(1,type,"80")),start);assertThat(p.amount()).isEqualByComparingTo("80");assertThat(p.promotion()).isFalse();}}
 @Test void latestPermanentPersistsAndTemporaryRevertsToNewRegular(){var p=d(1,ProductPriceAdjustment.Type.PERMANENT,"90");var t=d(2,ProductPriceAdjustment.Type.TEMPORARY,"110");t.startsAt=start.plusSeconds(1);assertThat(price(List.of(p,t),start).regular()).isEqualByComparingTo("90");assertThat(price(List.of(p,t),start.plusSeconds(2)).amount()).isEqualByComparingTo("110");assertThat(price(List.of(p,t),end).amount()).isEqualByComparingTo("90");}
 @Test void futurePermanentCannotChangeTodaysBaselineAndLowerPermanentStopsFalsePromotion(){var promo=d(1,ProductPriceAdjustment.Type.PROMOTION,"80");var p=d(2,ProductPriceAdjustment.Type.PERMANENT,"70");p.startsAt=start.plusSeconds(100);assertThat(price(List.of(p,promo),start).promotion()).isTrue();var after=price(List.of(p,promo),start.plusSeconds(101));assertThat(after.amount()).isEqualByComparingTo("70");assertThat(after.promotion()).isFalse();}
 @Test void draftCancelledFutureApprovalForeignTenantCurrencyChannelAndUnitAreExcluded(){for(int n=0;n<7;n++){var d=d(1,ProductPriceAdjustment.Type.PROMOTION,"80");switch(n){case 0->d.status=ProductPriceAdjustment.Status.DRAFT;case 1->d.status=ProductPriceAdjustment.Status.CANCELLED;case 2->d.approvedAt=end;case 3->d.merchantId=2L;case 4->d.currency="USD";case 5->d.channel="COSTCO_ONLINE";case 6->d.lines.get(0).unit="100g";}assertThat(price(List.of(d),start).amount()).isEqualByComparingTo("100");}}
 @Test void overlappingFiniteDocumentsFailInsteadOfPickingAnArbitraryPrice(){assertThatThrownBy(()->price(List.of(d(1,ProductPriceAdjustment.Type.PROMOTION,"80"),d(2,ProductPriceAdjustment.Type.TEMPORARY,"90")),start)).isInstanceOf(IllegalStateException.class);}
 @Test void nextChangeIncludesFuturePermanentAndNeverCreatesDiscountFromAPlainAmount(){var d=d(1,ProductPriceAdjustment.Type.PERMANENT,"80");assertThat(price(List.of(d),start.minusSeconds(1)).nextChange()).isEqualTo(start);assertThat(price(List.of(),start).promotion()).isFalse();}
}
