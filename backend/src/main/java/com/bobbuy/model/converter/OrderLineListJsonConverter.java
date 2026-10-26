package com.bobbuy.model.converter;

import com.bobbuy.model.OrderLine;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.ArrayList;
import java.util.List;

@Converter
public class OrderLineListJsonConverter implements AttributeConverter<List<OrderLine>, String> {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().findAndRegisterModules();
    private static final TypeReference<List<OrderLine>> TYPE_REFERENCE = new TypeReference<>() {
    };

    @Override
    public String convertToDatabaseColumn(List<OrderLine> attribute) {
        try {
            return OBJECT_MAPPER.writeValueAsString(attribute == null ? new ArrayList<>() : attribute);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Failed to serialize order lines", e);
        }
    }

    @Override
    public List<OrderLine> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return OBJECT_MAPPER.readValue(normalizeJsonValue(dbData), TYPE_REFERENCE);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Failed to deserialize order lines", e);
        }
    }

    private String normalizeJsonValue(String dbData) throws JsonProcessingException {
        String normalized = dbData.trim();
        if (normalized.startsWith("\"") && normalized.endsWith("\"")) {
            return OBJECT_MAPPER.readValue(normalized, String.class);
        }
        return normalized;
    }
}
