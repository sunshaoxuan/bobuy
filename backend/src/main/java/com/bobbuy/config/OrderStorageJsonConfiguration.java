package com.bobbuy.config;
import com.bobbuy.model.OrderLine;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.hibernate.type.format.jackson.JacksonJsonFormatMapper;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.*;

@Configuration
public class OrderStorageJsonConfiguration {
 @JsonIgnoreProperties({"brand","itemNumber","model","packaging","saleUnit","specifications"})
 private abstract static class LegacyOrderLineStorage {}
 /** Only Hibernate JSON uses this mixin. HTTP JSON retains structured snapshot fields. */
 public static ObjectMapper storageMapper(){return new ObjectMapper().findAndRegisterModules().addMixIn(OrderLine.class,LegacyOrderLineStorage.class);}
 @Bean HibernatePropertiesCustomizer orderStorageJson(){return properties->properties.put("hibernate.type.json_format_mapper",new JacksonJsonFormatMapper(storageMapper()));}
}
