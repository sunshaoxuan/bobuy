package com.bobbuy.model;
import java.util.*;
/** Separate persistence sidecar; the legacy order-line JSON shape stays unchanged. */
public record OrderLineIdentity(String skuId,String itemName,Map<String,String> names,String brand,String itemNumber,String model,String packaging,Map<String,String> specifications,String saleUnit){
 public OrderLineIdentity{names=names==null?Map.of():Map.copyOf(names);specifications=specifications==null?Map.of():Map.copyOf(specifications);}
 public static boolean present(OrderLine l){return l.getBrand()!=null||l.getItemNumber()!=null||l.getModel()!=null||l.getPackaging()!=null||l.getSaleUnit()!=null||!l.getSpecifications().isEmpty();}
 public static OrderLineIdentity from(OrderLine l){return new OrderLineIdentity(l.getSkuId(),l.getItemName(),l.getNames(),l.getBrand(),l.getItemNumber(),l.getModel(),l.getPackaging(),l.getSpecifications(),l.getSaleUnit());}
 public void apply(OrderLine l){
  if(!Objects.equals(skuId,l.getSkuId())||!Objects.equals(itemName,l.getItemName())||!Objects.equals(names,l.getNames())||!Objects.equals(saleUnit,l.getSpec()))return;
  l.setBrand(brand);l.setItemNumber(itemNumber);l.setModel(model);l.setPackaging(packaging);l.setSpecifications(specifications);l.setSaleUnit(saleUnit);
 }
}
