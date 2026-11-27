package com.bobbuy.livecart;

import java.util.Set;

/** An explicitly approved runtime adapter. No production adapter is selected by default. */
public interface AudioTranscriptionProvider {
    String id();
    Set<String> supportedMimeTypes();
    String transcribe(byte[] audio, String mimeType, String locale) throws Exception;
}
