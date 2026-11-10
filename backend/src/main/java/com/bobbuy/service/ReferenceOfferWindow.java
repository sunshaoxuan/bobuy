package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.model.ReferenceOfferContext;
import java.time.*;

/** Mail day ranges are inclusive JST. Missing boundaries never imply active/expired. */
public record ReferenceOfferWindow(LocalDate start,LocalDate end,String startBasis,String endBasis) {
 public boolean complete(){return start!=null&&end!=null;}
 public String state(Instant now){if(!complete())return "UNKNOWN";var day=now.atZone(ZoneId.of("Asia/Tokyo")).toLocalDate();return day.isBefore(start)?"FUTURE":day.isAfter(end)?"EXPIRED":"ACTIVE";}
 public static ReferenceOfferWindow resolve(LocalDate start,LocalDate end,ReferenceOfferContext context){
  String a=start==null?"UNKNOWN":"ITEM",b=end==null?"UNKNOWN":"ITEM";
  if(context!=null){
   if(context.channel()!=null&&!context.channel().isBlank()&&!java.util.Set.of("COSTCO_WAREHOUSE","COSTCO_ONLINE").contains(context.channel()))throw invalid();
   if(context.activityStart()!=null&&context.activityEnd()!=null&&context.activityStart().isAfter(context.activityEnd()))throw invalid();
   if(context.activityApplies()&&((start==null&&context.activityStart()!=null)||(end==null&&context.activityEnd()!=null))){
    if(context.windowEvidence()==null||context.windowEvidence().isBlank()||context.sourceUrl()==null||context.sourceUrl().isBlank())throw invalid();
    try{var uri=java.net.URI.create(context.sourceUrl());if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null)throw invalid();}catch(IllegalArgumentException error){throw invalid();}
    if(start==null&&context.activityStart()!=null){start=context.activityStart();a="ACTIVITY";}
    if(end==null&&context.activityEnd()!=null){end=context.activityEnd();b="ACTIVITY";}
   }
  }
  if(start!=null&&end!=null&&start.isAfter(end))throw invalid();
  return new ReferenceOfferWindow(start,end,a,b);
 }
 private static ApiException invalid(){return new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.offer");}
}
