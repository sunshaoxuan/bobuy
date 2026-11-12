package com.bobbuy.service;
import java.math.BigDecimal;import java.util.*;import org.junit.jupiter.api.Test;import static org.assertj.core.api.Assertions.*;
class ProductBrowseOrderTest {
 record Row(String id,BigDecimal price,BigDecimal rating,Long heat){}
 @Test void sortsTheEntireInputBeforePagingAndKeepsMissingLast(){
  var input=new ArrayList<Row>();for(int i=0;i<60;i++)input.add(new Row("p"+i,BigDecimal.valueOf(i),i%2==0?null:BigDecimal.valueOf(i%5+1),(long)i));
  for(String order:List.of("price-desc","heat-desc"))assertThat(ProductBrowseOrder.sorted(input,order,Row::price,Row::rating,Row::heat).get(0).id()).isEqualTo("p59");
  for(String order:List.of("rating-asc","rating-desc")){var output=ProductBrowseOrder.sorted(input,order,Row::price,Row::rating,Row::heat);assertThat(output.get(0).rating()).isNotNull();assertThat(output.get(59).rating()).isNull();}
  assertThat(input.get(0).id()).isEqualTo("p0");assertThatThrownBy(()->ProductBrowseOrder.validate("unknown")).isInstanceOf(IllegalArgumentException.class);
 }
 @Test void keepsCurrenciesSeparateAndUsesActualDisplayedAmount(){
  var rows=List.of(new PublicBrowsePriceService.Price(new BigDecimal("100"),"JPY"),new PublicBrowsePriceService.Price(new BigDecimal("2"),"CNY"),new PublicBrowsePriceService.Price(new BigDecimal("999"),"JPY"));
  assertThat(ProductBrowseOrder.prices(rows,"price-desc",p->p)).containsExactly(rows.get(1),rows.get(2),rows.get(0));
 }
}
