package com.bobbuy.service;

import org.springframework.stereotype.Service;
import java.util.*;
import java.util.regex.*;

/** Starts a new, public official-site lookup after publication; it never reuses intake images. */
public interface OfficialImageCandidateFinder {
 record Request(long merchantId,String supplierId,String market,String itemNumber,String brand,String specification,String packaging) {}
 record Candidate(String sourcePage,String imageUrl,String matchBasis) {}
 Optional<Candidate> find(Request request);

 @Service
 final class CostcoOfficialSiteFinder implements OfficialImageCandidateFinder {
  private final OfficialProductResearch research;
  public CostcoOfficialSiteFinder(OfficialProductResearch research){this.research=research;}
  @Override public Optional<Candidate> find(Request request){
   for(var product:research.find(request.itemNumber(),null)){
    String official=String.join(" ",product.name(),product.description());
    if(!sameVariant(request.specification()+" "+request.packaging(),official))continue;
    if(product.images().isEmpty())continue;
    return Optional.of(new Candidate(product.productUrl(),product.images().get(0),
      "official SKU "+request.itemNumber()+"; market "+request.market()+"; specification "+request.specification()+"; package "+request.packaging()));
   }
   return Optional.empty();
  }
  static boolean sameVariant(String expected,String actual){
   var wanted=measures(expected);if(wanted.isEmpty())return false;
   var found=measures(actual);return found.containsAll(wanted);
  }
  private static Set<Long> measures(String value){
   var result=new HashSet<Long>();if(value==null)return result;
   var matcher=Pattern.compile("(?i)(\\d+(?:[.,]\\d+)?)\\s*(kg|g|ml|l)\\b").matcher(value);
   while(matcher.find()){
    double amount=Double.parseDouble(matcher.group(1).replace(',','.'));
    String unit=matcher.group(2).toLowerCase(Locale.ROOT);
    result.add(Math.round(amount*(unit.equals("kg")||unit.equals("l")?1000:1)));
   }
   return result;
  }
 }
}
