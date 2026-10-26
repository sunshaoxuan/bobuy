package com.bobbuy.service;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import java.io.IOException;

/** Never silently coerce numeric Costco item numbers and lose their source representation. */
public class RecommendationString extends JsonDeserializer<String> {
    @Override public String deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (parser.hasToken(JsonToken.VALUE_STRING)) return parser.getText();
        return (String) context.handleUnexpectedToken(String.class, parser);
    }
}
