package com.bobbuy.service;
import java.util.Map;

/** Internal binary adapter. Never exposes credentials, buckets or signed URLs to a browser. */
public interface MediaObjectStore {
 class Missing extends RuntimeException {public Missing(){super("Object not found");}}
 record ObjectData(byte[] bytes,String contentType,Map<String,String> metadata) {}
 record ListedObject(String key,long bytes) {}
 record ObjectPage(java.util.List<ListedObject> objects,String nextToken) {}
 /** Migration audit only; application reads never expose this inventory to clients. */
 default ObjectPage list(String prefix,String token){throw new UnsupportedOperationException("Object inventory is unavailable");}
 void put(String key,byte[] bytes,String contentType,String sha256);
 ObjectData get(String key);
}
