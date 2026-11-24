package com.bobbuy.service;

import com.bobbuy.api.response.*;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import java.io.*;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Set;

public final class RecommendationImageValidator {
    public static final int MAX_BYTES = 8 * 1024 * 1024;
    private RecommendationImageValidator() {}
    public record Image(String hash, String contentType, byte[] content) {}

    public static Image validate(MultipartFile file) {
        try { return validateCatalog(file); }
        catch (ApiException ex) { throw invalid("error.recommendation.image"); }
    }

    public static Image validateCatalog(MultipartFile file) {
        if (file == null || file.isEmpty()) throw invalid("gallery.file_empty");
        if (file.getSize() > MAX_BYTES) throw invalid("gallery.file_too_large");
        try { return decode(file.getBytes()); }
        catch (IOException ex) { throw invalid("gallery.file_decode"); }
    }

    public static Image validate(byte[] original) {
        try { return decode(original); }
        catch (ApiException ex) { throw invalid("error.recommendation.image"); }
    }

    private static Image decode(byte[] original) {
        if (original == null || original.length == 0) throw invalid("gallery.file_empty");
        if (original.length > MAX_BYTES) throw invalid("gallery.file_too_large");
        try {
            try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(original))) {
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw invalid("gallery.file_decode");
                var reader = readers.next();
                try {
                    reader.setInput(input);
                    String format = reader.getFormatName().toLowerCase(java.util.Locale.ROOT);
                    if (!Set.of("png", "jpeg", "jpg").contains(format)) throw invalid("gallery.file_format");
                    int width = reader.getWidth(0), height = reader.getHeight(0);
                    if (width < 1 || height < 1 || width > 8192 || height > 8192 || (long) width * height > 24_000_000) throw invalid("gallery.dimensions");
                    var decoded = reader.read(0);
                    var output = new ByteArrayOutputStream();
                    String target = format.equals("png") ? "png" : "jpeg";
                    if (!ImageIO.write(decoded, target, output)) throw invalid("gallery.file_decode");
                    if(output.size()>MAX_BYTES)throw invalid("gallery.converted_too_large");
                    return new Image(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(original)), "image/" + target, output.toByteArray());
                } finally { reader.dispose(); }
            }
        } catch (ApiException ex) { throw ex; }
        catch (Exception ex) { throw invalid("gallery.file_decode"); }
    }
    private static ApiException invalid(String key) { return new ApiException(ErrorCode.INVALID_REQUEST, key); }
}
