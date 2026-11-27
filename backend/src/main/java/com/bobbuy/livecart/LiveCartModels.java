package com.bobbuy.livecart;
import java.math.BigDecimal;import java.time.Instant;import java.util.List;
public final class LiveCartModels {
 private LiveCartModels(){}
 public record Total(int lineCount,int itemCount,BigDecimal amount,int unpricedLineCount,int unpricedItemCount,String currency){}
 public record Line(long id,String productId,int quantity,BigDecimal unitPrice,String currency,String priceSource,boolean ready,boolean visibleToCustomer,Long settlementId,long version,boolean changedAfterReady){}
 public record Settlement(long id,Instant settledAt,Instant reopenedAt,Total total,List<Line> lines){}
 public record Cart(long id,long customerId,long merchantId,long version,String customerName,String phone,String email,boolean emailVerified,List<Line> openLines,List<Settlement> settlements,Total openTotal,Total settledTotal,Instant lastActivityAt){}
 public record CartList(List<Cart> changes,long version){}
 public record Preview(Total selected,Total remaining){}
 public record AddLine(String productId,Integer quantity,BigDecimal unitPrice,Boolean hiddenFromCustomer){}
 public record ChangeLine(Integer quantity,BigDecimal unitPrice,Boolean hiddenFromCustomer,long expectedVersion){}
 public record SelectLines(List<Long> lineIds,long expectedVersion){}
 public record Reopen(String note){}
}
