package com.bobbuy.model;

import com.bobbuy.config.OrderStorageJsonConfiguration;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.Serializable;
import java.util.List;
import org.hibernate.SharedSessionContract;
import org.hibernate.type.SqlTypes;
import org.hibernate.type.descriptor.WrapperOptions;
import org.hibernate.type.descriptor.java.AbstractJavaType;
import org.hibernate.type.descriptor.java.MutabilityPlan;
import org.hibernate.type.descriptor.jdbc.JdbcType;
import org.hibernate.type.descriptor.jdbc.JdbcTypeIndicators;

/** The legacy JSON column and structured identity sidecar have separate dirty state.
 * HTTP equality still includes all snapshot fields; SQL equality uses the unchanged
 * storage mapper. Metadata setters update the owner's sidecar independently. */
public final class OrderLineStorageJavaType extends AbstractJavaType<List<OrderLine>> {
    private static final TypeReference<List<OrderLine>> LINES=new TypeReference<>(){};
    private static final ObjectMapper STORAGE=OrderStorageJsonConfiguration.storageMapper();
    private static final ObjectMapper SNAPSHOT=new ObjectMapper().findAndRegisterModules();
    private static final MutabilityPlan<List<OrderLine>> PLAN=new MutabilityPlan<>() {
        public boolean isMutable(){return true;}
        public List<OrderLine> deepCopy(List<OrderLine> value){return value==null?null:read(SNAPSHOT,write(SNAPSHOT,value));}
        public Serializable disassemble(List<OrderLine> value,SharedSessionContract session){return value==null?null:write(SNAPSHOT,value);}
        public List<OrderLine> assemble(Serializable value,SharedSessionContract session){return value==null?null:read(SNAPSHOT,(String)value);}
    };
    public OrderLineStorageJavaType(){super(LINES.getType(),PLAN);}
    @Override public boolean areEqual(List<OrderLine> first,List<OrderLine> second){
        return first==second||(first!=null&&second!=null&&STORAGE.valueToTree(first).equals(STORAGE.valueToTree(second)));
    }
    @Override public int extractHashCode(List<OrderLine> value){return value==null?0:STORAGE.valueToTree(value).hashCode();}
    @Override public JdbcType getRecommendedJdbcType(JdbcTypeIndicators context){return context.getJdbcType(SqlTypes.JSON);}
    @Override public String toString(List<OrderLine> value){return value==null?null:write(STORAGE,value);}
    @Override public List<OrderLine> fromString(CharSequence value){return value==null?null:read(STORAGE,value.toString());}
    @Override @SuppressWarnings("unchecked") public <X> X unwrap(List<OrderLine> value,Class<X> type,WrapperOptions options){
        if(value==null)return null;if(type.isInstance(value))return (X)value;if(type==String.class)return (X)toString(value);throw unknownUnwrap(type);
    }
    @Override @SuppressWarnings("unchecked") public <X> List<OrderLine> wrap(X value,WrapperOptions options){
        if(value==null)return null;if(value instanceof String text)return fromString(text);if(value instanceof List<?>)return (List<OrderLine>)value;throw unknownWrap(value.getClass());
    }
    private static String write(ObjectMapper mapper,List<OrderLine> value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalArgumentException("Invalid order-line snapshot",e);}}
    private static List<OrderLine> read(ObjectMapper mapper,String value){try{return mapper.readValue(value,LINES);}catch(Exception e){throw new IllegalArgumentException("Invalid order-line storage",e);}}
}
