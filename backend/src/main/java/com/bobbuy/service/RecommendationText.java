package com.bobbuy.service;
import com.bobbuy.model.RecommendationItem;
import java.util.*;
/** Only reviewed current-source translations may enter product/cart text. */
public final class RecommendationText {
 private RecommendationText(){}
 public static Map<String,String> names(RecommendationItem item){
  var names=new HashMap<String,String>();names.put("ja-JP",item.name);
  if("REVIEWED".equals(item.getTranslationStatus()))item.translations.forEach((locale,text)->{if(text.name()!=null&&!text.name().isBlank())names.put(locale,text.name().trim()+"（"+item.name+"）");});
  return names;
 }
 public static Map<String,String> descriptions(RecommendationItem item){
  var values=new HashMap<String,String>();values.put("ja-JP",Objects.toString(item.description,""));
  if("REVIEWED".equals(item.getTranslationStatus()))item.translations.forEach((locale,text)->values.put(locale,Objects.toString(text.description(),"")));
  return values;
 }
}
