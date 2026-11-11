package com.bobbuy.service;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Counts belong to the product viewed at click time. Relinking an offer never moves them. */
@Service
public class ProductPopularityService {
 private final JdbcTemplate db; private final ProductRatingService ratings;
 public ProductPopularityService(JdbcTemplate db,ProductRatingService ratings){this.db=db;this.ratings=ratings;}
 public record Value(String productId,String clicks){}
 @Transactional(readOnly=true) public Value get(String id){ratings.summary(id);var found=db.queryForList("select clicks from bb_product_click where product_id=?",Long.class,id);return new Value(id,Long.toString(found.isEmpty()?0L:found.get(0)));}
 @Transactional public Value click(String id){
  ratings.summary(id);
  Long count=db.queryForObject("insert into bb_product_click(product_id,clicks) values (?,1) on conflict(product_id) do update set clicks=bb_product_click.clicks+1 returning clicks",Long.class,id);
  return new Value(id,Long.toString(count));
 }
 @Transactional(readOnly=true) public Map<String,Long> counts(){
  var result=new HashMap<String,Long>();
  db.query("select product_id,clicks from bb_product_click",(org.springframework.jdbc.core.RowCallbackHandler)row->result.put(row.getString(1),row.getLong(2)));
  return result;
 }
}
