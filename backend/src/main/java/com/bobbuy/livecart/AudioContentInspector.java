package com.bobbuy.livecart;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

/** Reads the container itself; request filenames, MIME headers and client clocks are not trusted. */
final class AudioContentInspector {
    record Media(String mimeType, double durationSeconds) {}

    static Optional<Media> inspect(byte[] bytes) {
        if (bytes == null || bytes.length < 12) return Optional.empty();
        Optional<Double> mp4 = mp4Duration(bytes);
        if (mp4.isPresent()) return Optional.of(new Media("audio/mp4", mp4.get()));
        Optional<Double> webm = webmDuration(bytes);
        return webm.map(value -> new Media("audio/webm", value));
    }

    private static Optional<Double> mp4Duration(byte[] bytes) {
        if (!ascii(bytes, 4, "ftyp")) return Optional.empty();
        for (int i = 4; i + 24 < bytes.length; i++) {
            if (!ascii(bytes, i, "mvhd")) continue;
            int p = i + 4;
            int version = bytes[p] & 0xff;
            int scaleAt = p + (version == 1 ? 20 : 12);
            int durationAt = scaleAt + 4;
            if (durationAt + (version == 1 ? 8 : 4) > bytes.length) return Optional.empty();
            long scale = uint32(bytes, scaleAt);
            long duration = version == 1 ? ByteBuffer.wrap(bytes, durationAt, 8).getLong() : uint32(bytes, durationAt);
            if (scale <= 0 || duration <= 0) return Optional.empty();
            return finite((double) duration / scale);
        }
        return Optional.empty();
    }

    private static Optional<Double> webmDuration(byte[] bytes) {
        if ((bytes[0] & 0xff) != 0x1a || (bytes[1] & 0xff) != 0x45 || (bytes[2] & 0xff) != 0xdf || (bytes[3] & 0xff) != 0xa3)
            return Optional.empty();
        long scale = 1_000_000L;
        for (int i = 4; i + 5 < bytes.length; i++) {
            if ((bytes[i] & 0xff) == 0x2a && (bytes[i + 1] & 0xff) == 0xd7 && (bytes[i + 2] & 0xff) == 0xb1) {
                VarInt size = varInt(bytes, i + 3);
                if (size != null && size.value > 0 && size.value <= 8 && size.end + size.value <= bytes.length)
                    scale = unsigned(bytes, size.end, (int) size.value);
            }
            if ((bytes[i] & 0xff) == 0x44 && (bytes[i + 1] & 0xff) == 0x89) {
                VarInt size = varInt(bytes, i + 2);
                if (size == null || (size.value != 4 && size.value != 8) || size.end + size.value > bytes.length) continue;
                ByteBuffer value = ByteBuffer.wrap(bytes, size.end, (int) size.value).order(ByteOrder.BIG_ENDIAN);
                double ticks = size.value == 4 ? value.getFloat() : value.getDouble();
                return finite(ticks * scale / 1_000_000_000d);
            }
        }
        return Optional.empty();
    }

    private record VarInt(int end, long value) {}
    private static VarInt varInt(byte[] bytes, int offset) {
        if (offset >= bytes.length) return null;
        int first = bytes[offset] & 0xff, length = 1, mask = 0x80;
        while (length <= 8 && (first & mask) == 0) { length++; mask >>= 1; }
        if (length > 8 || offset + length > bytes.length) return null;
        long value = first & (mask - 1);
        for (int i = 1; i < length; i++) value = (value << 8) | (bytes[offset + i] & 0xff);
        return new VarInt(offset + length, value);
    }
    private static long unsigned(byte[] bytes, int offset, int length) { long value=0;for(int i=0;i<length;i++)value=(value<<8)|(bytes[offset+i]&0xff);return value; }
    private static long uint32(byte[] bytes, int offset) { return Integer.toUnsignedLong(ByteBuffer.wrap(bytes, offset, 4).getInt()); }
    private static boolean ascii(byte[] bytes, int offset, String text) { return offset >= 0 && offset + text.length() <= bytes.length && text.equals(new String(bytes, offset, text.length(), StandardCharsets.US_ASCII)); }
    private static Optional<Double> finite(double value) { return Double.isFinite(value) && value > 0 ? Optional.of(value) : Optional.empty(); }
}
