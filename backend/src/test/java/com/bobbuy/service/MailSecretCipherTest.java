package com.bobbuy.service;

import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import static org.assertj.core.api.Assertions.*;

class MailSecretCipherTest {
 @TempDir Path temp;
 @Test void authenticatedRandomEncryptionBindsIdentityAndSupportsRetainedRotationKeys() throws Exception {
  Path keyring=temp.resolve("test-only.keys");
  byte[] first=new byte[32],second=new byte[32];new java.security.SecureRandom().nextBytes(first);new java.security.SecureRandom().nextBytes(second);
  Files.writeString(keyring,"v1="+Base64.getEncoder().encodeToString(first)+"\nv2="+Base64.getEncoder().encodeToString(second));
  var old=new MailSecretCipher(keyring.toString(),"v1");var current=new MailSecretCipher(keyring.toString(),"v2");
  String encrypted=old.encrypt("synthetic-password","identity");
  assertThat(encrypted).doesNotContain("synthetic-password");
  assertThat(old.encrypt("synthetic-password","identity")).isNotEqualTo(encrypted);
  assertThat(current.decrypt(encrypted,"v1","identity")).isEqualTo("synthetic-password");
  String rotated=current.encrypt(current.decrypt(encrypted,"v1","identity"),"identity");
  assertThat(current.decrypt(rotated,"v2","identity")).isEqualTo("synthetic-password");
  assertThatThrownBy(()->current.decrypt(encrypted,"v1","different-identity")).hasMessage("Mail encryption is unavailable");
  String tampered=encrypted.substring(0,encrypted.length()-5)+"AAAAA";
  assertThatThrownBy(()->current.decrypt(tampered,"v1","identity")).hasMessage("Mail encryption is unavailable");
  assertThatThrownBy(()->current.decrypt(encrypted,"missing","identity")).hasMessage("Mail encryption is unavailable");
 }
 @Test void missingOrInvalidExternalKeyFailsClosedWithoutSecretInErrors() throws Exception {
  var missing=new MailSecretCipher("","v1");assertThat(missing.ready()).isFalse();
  assertThatThrownBy(()->missing.encrypt("do-not-log-this","identity")).hasMessage("Mail encryption is unavailable");
  Path invalid=temp.resolve("invalid.keys");Files.writeString(invalid,"v1=not-base64");
  assertThat(new MailSecretCipher(invalid.toString(),"v1").ready()).isFalse();
 }
}
