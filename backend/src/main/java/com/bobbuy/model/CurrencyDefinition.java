package com.bobbuy.model;
import jakarta.persistence.*;
@Entity @Table(name="bb_currency")
public class CurrencyDefinition {
 @Id public String code;
 public String symbol;
 public int fractionDigits;
 public String name;
 public boolean saleEnabled;
}
