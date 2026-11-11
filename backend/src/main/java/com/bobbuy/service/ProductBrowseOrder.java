package com.bobbuy.service;
import java.math.BigDecimal;
import java.util.*;
import java.util.function.Function;
public final class ProductBrowseOrder {
 private ProductBrowseOrder(){}
 public static void validate(String order){if(!Set.of("default","price-asc","price-desc","rating-asc","rating-desc","heat-asc","heat-desc").contains(order))throw new IllegalArgumentException("Invalid product sort");}
 public static <T> List<T> sorted(List<T> rows,String order,Function<T,BigDecimal> price,Function<T,BigDecimal> rating,Function<T,Long> heat){
  validate(order);if(order.equals("default"))return rows;
  Function<T,BigDecimal> value=order.startsWith("price")?price:order.startsWith("rating")?rating:row->{Long n=heat.apply(row);return n==null?null:BigDecimal.valueOf(n);};
  Comparator<BigDecimal> numbers=order.endsWith("desc")?Comparator.reverseOrder():Comparator.naturalOrder();
  return rows.stream().sorted(Comparator.comparing(value,Comparator.nullsLast(numbers))).toList();
 }
 public static <T> List<T> prices(List<T> rows,String order,Function<T,PublicBrowsePriceService.Price> price){
  Comparator<BigDecimal> numbers=order.endsWith("desc")?Comparator.reverseOrder():Comparator.naturalOrder();
  Comparator<PublicBrowsePriceService.Price> values=Comparator.comparing(PublicBrowsePriceService.Price::currency).thenComparing(PublicBrowsePriceService.Price::amount,numbers);
  return rows.stream().sorted(Comparator.comparing(price,Comparator.nullsLast(values))).toList();
 }
}
