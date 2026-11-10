package com.bobbuy.api;
import com.bobbuy.model.OrderLine;
import java.util.*;
/** Read-only purchase-time identity; never replace it with a current master lookup. */
public record OrderIdentitySnapshot(String itemName,Map<String,String> names,String itemNumber,String brand,String model,String packaging,Map<String,String> specifications,String saleUnit,String spec){
 public OrderIdentitySnapshot {names=copy(names);specifications=copy(specifications);}
 private static Map<String,String> copy(Map<String,String> value){return value==null?Map.of():Collections.unmodifiableMap(new HashMap<>(value));}
 public static OrderIdentitySnapshot from(OrderLine line){return new OrderIdentitySnapshot(line.getItemName(),line.getNames(),line.getItemNumber(),line.getBrand(),line.getModel(),line.getPackaging(),line.getSpecifications(),line.getSaleUnit(),line.getSpec());}
}
