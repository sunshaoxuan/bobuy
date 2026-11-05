package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.model.converter.OrderLineListJsonConverter;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class OrderProductSnapshotTest {
 @Test void retainedSidecarDoesNotAttachToChangedSaleUnit(){var original=new OrderLine("p1","Diapers","pack",1,100);OrderProductSnapshot.capture(original,product());var snapshot=OrderLineIdentity.from(original);var changed=new OrderLine("p1","Diapers","kg",1,100);changed.setNames(original.getNames());snapshot.apply(changed);assertThat(changed.getBrand()).isNull();assertThat(changed.getSpec()).isEqualTo("kg");}
 @Test void procurementViewsRetainEveryDistinctPurchasedVariant(){
  var line=new OrderLine("p1","Diapers","pack",1,100);OrderProductSnapshot.capture(line,product());
  var snapshot=com.bobbuy.api.OrderIdentitySnapshot.from(line);line.getSpecifications().put("ja-JP","later change");assertThat(snapshot.specifications()).containsEntry("ja-JP","80 pieces x 2");
  var other=new OrderLine("p2","Diapers","pack",1,100);var second=product();second.setId("p2");second.setItemNumber("independent-ITEM");OrderProductSnapshot.capture(other,second);
  var distinct=new LinkedHashSet<com.bobbuy.api.OrderIdentitySnapshot>();distinct.add(snapshot);distinct.add(com.bobbuy.api.OrderIdentitySnapshot.from(other));
  var deficit=new com.bobbuy.api.ProcurementDeficitItemResponse("p1","Diapers",2,0,"NORMAL",false,"DRAFTER_ONLY").withSnapshots(new ArrayList<>(distinct));
  assertThat(deficit.getSnapshots()).hasSize(2);assertThat(deficit.getSnapshots().get(0).packaging()).isEqualTo("2 packs");
  var picking=new com.bobbuy.api.PickingChecklistItemResponse("p1","Diapers",1,1,false,List.of()).withSnapshot(snapshot);assertThat(picking.getSnapshot().brand()).isEqualTo("Pampers");
 }
 private Product product(){
  var p=new Product();p.setId("p1");p.setItemNumber("I-80x2");p.setBrand("Pampers");p.setName(new HashMap<>(Map.of("ja-JP","Diapers","en-US","Diapers")));
  p.setCatalogData(new ProductCatalogData(new HashMap<>(Map.of("ja-JP","80 pieces x 2","en-US","80 pieces x 2")),"Model-L","2 packs",List.of(),null,null,null,null));return p;
 }
 @Test void snapshotsAreIndependentAndKeepLegacySaleUnit(){
  var p=product();var line=new OrderLine("p1","Diapers","pack",1,100);OrderProductSnapshot.capture(line,p);
  p.setBrand("Changed");p.getName().put("ja-JP","Changed");p.getCatalogData().specification().put("ja-JP","Changed");
  assertThat(line.getBrand()).isEqualTo("Pampers");assertThat(line.getNames().get("ja-JP")).isEqualTo("Diapers");
  assertThat(line.getSpecifications().get("ja-JP")).isEqualTo("80 pieces x 2");assertThat(line.getSpec()).isEqualTo("pack");assertThat(line.getSaleUnit()).isEqualTo("pack");
  assertThat(line.getModel()).isEqualTo("Model-L");assertThat(line.getPackaging()).isEqualTo("2 packs");
 }
 @Test void additiveJsonRoundTripAndHistoricalRowsRemainReadable(){
  var converter=new OrderLineListJsonConverter();var line=new OrderLine("p1","Diapers","pack",1,100);OrderProductSnapshot.capture(line,product());
  var restored=converter.convertToEntityAttribute(converter.convertToDatabaseColumn(List.of(line))).get(0);
  assertThat(restored.getSpecifications()).containsEntry("en-US","80 pieces x 2");assertThat(restored.getBrand()).isEqualTo("Pampers");
  var old=converter.convertToEntityAttribute("[{\"skuId\":\"old\",\"itemName\":\"Old complete name\",\"spec\":\"box\",\"quantity\":1,\"unitPrice\":123}]").get(0);
  assertThat(old.getSpec()).isEqualTo("box");assertThat(old.getItemName()).isEqualTo("Old complete name");assertThat(old.getSpecifications()).isEmpty();assertThat(old.getSaleUnit()).isNull();
  assertThat(converter.convertToDatabaseColumn(List.of(old))).doesNotContain("specifications","saleUnit","packaging","brand");
 }
 @Test void differentItemOrSnapshotMustNotMerge(){
  var a=new OrderLine("p1","Diapers","pack",1,100);OrderProductSnapshot.capture(a,product());
  var b=new OrderLine("p1","Diapers","pack",1,100);OrderProductSnapshot.capture(b,product());assertThat(a.canMergeWith(b)).isTrue();
  b.setItemNumber("different-independent-ITEM");assertThat(a.canMergeWith(b)).isFalse();b.setItemNumber(a.getItemNumber());
  b.setSpecifications(Map.of("ja-JP","80 pieces x 1"));assertThat(a.canMergeWith(b)).isFalse();
 }
}
