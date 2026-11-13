package com.bobbuy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

/** Small, fail-closed validator for the JSON Schema subset used by AI extraction contracts. */
public final class JsonSchemaOutputValidator {
    private final ObjectMapper mapper;
    private final JsonNode schema;
    public JsonSchemaOutputValidator(ObjectMapper mapper, Map<String, Object> schema) {
        this.mapper=mapper; this.schema=mapper.valueToTree(schema);
    }
    public boolean validates(String document) {
        try { return validate(mapper.readTree(document), schema); } catch (Exception ignored) { return false; }
    }
    private boolean validate(JsonNode value, JsonNode rule) {
        String type=rule.path("type").asText();
        if ("array".equals(type)) {
            if(!value.isArray())return false; for(var item:value)if(!validate(item,rule.path("items")))return false; return true;
        }
        if ("object".equals(type)) {
            if(!value.isObject())return false;
            for(var required:rule.path("required"))if(!value.has(required.asText()))return false;
            var fields=rule.path("properties").fields(); while(fields.hasNext()){var field=fields.next();if(value.has(field.getKey())&&!validate(value.get(field.getKey()),field.getValue()))return false;} return true;
        }
        return switch(type){case "string"->value.isTextual();case "number"->value.isNumber();case "integer"->value.isIntegralNumber();case "boolean"->value.isBoolean();default->false;};
    }
}
