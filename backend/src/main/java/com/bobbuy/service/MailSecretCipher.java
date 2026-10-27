package com.bobbuy.service;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import javax.crypto.*;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Versioned AES-256-GCM keyring supplied by a protected external file, never by the database. */
@Component
public class MailSecretCipher {
 private final String path;
 private final String activeId;
 private final SecureRandom random=new SecureRandom();
 public MailSecretCipher(@Value("${bobuy.mail.keyring-file:}") String path,
                         @Value("${bobuy.mail.active-key-id:}") String activeId) {
  this.path=path; this.activeId=activeId;
 }
 public String activeId() { return activeId; }
 public boolean ready() { try { key(activeId); return true; } catch(Exception ignored) { return false; } }
 private SecretKey key(String id) throws Exception {
  if(path.isBlank() || !id.matches("[A-Za-z0-9_-]{1,40}")) throw new GeneralSecurityException();
  Properties properties=new Properties();
  try(var stream=Files.newInputStream(Path.of(path))) { properties.load(stream); }
  byte[] raw=Base64.getDecoder().decode(properties.getProperty(id,""));
  try { if(raw.length!=32) throw new GeneralSecurityException(); return new SecretKeySpec(raw,"AES"); }
  finally { Arrays.fill(raw,(byte)0); }
 }
 public String encrypt(String secret,String context) {
  byte[] raw=secret.getBytes(StandardCharsets.UTF_8);
  try {
   byte[] nonce=new byte[12]; random.nextBytes(nonce);
   Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
   cipher.init(Cipher.ENCRYPT_MODE,key(activeId),new GCMParameterSpec(128,nonce));
   cipher.updateAAD(context.getBytes(StandardCharsets.UTF_8));
   return Base64.getEncoder().encodeToString(nonce)+":"+Base64.getEncoder().encodeToString(cipher.doFinal(raw));
  } catch(Exception ignored) { throw unavailable(); }
  finally { Arrays.fill(raw,(byte)0); }
 }
 public String decrypt(String encrypted,String id,String context) {
  byte[] raw=null;
  try {
   String[] parts=encrypted.split(":",-1);
   if(parts.length!=2) throw new GeneralSecurityException();
   byte[] nonce=Base64.getDecoder().decode(parts[0]);
   if(nonce.length!=12) throw new GeneralSecurityException();
   Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
   cipher.init(Cipher.DECRYPT_MODE,key(id),new GCMParameterSpec(128,nonce));
   cipher.updateAAD(context.getBytes(StandardCharsets.UTF_8));
   raw=cipher.doFinal(Base64.getDecoder().decode(parts[1]));
   return new String(raw,StandardCharsets.UTF_8);
  } catch(Exception ignored) { throw unavailable(); }
  finally { if(raw!=null) Arrays.fill(raw,(byte)0); }
 }
 private IllegalStateException unavailable() { return new IllegalStateException("Mail encryption is unavailable"); }
}
