package com.bobbuy.service;

import com.bobbuy.model.MailSettings;
import jakarta.mail.MessagingException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

@Component
public class SmtpDelivery {
 public enum FailureCategory { CONNECTION, TLS, AUTHENTICATION, REJECTED, TIMEOUT, UNKNOWN }
 public static final class DeliveryException extends IllegalStateException {
  private final FailureCategory category;
  public DeliveryException(FailureCategory category) { super("SMTP delivery failed: "+category); this.category=category; }
  public FailureCategory category() { return category; }
 }
 public void send(MailSettings settings,String password,SimpleMailMessage message) {
  JavaMailSenderImpl sender=createSender(settings,password);
  message.setFrom(settings.fromAddress); message.setReplyTo(settings.replyTo);
  try { sender.send(message); }
  catch(Exception failure) { throw new DeliveryException(classify(failure)); }
  finally { sender.setPassword(null); }
 }
 JavaMailSenderImpl createSender(MailSettings settings,String password) {
  JavaMailSenderImpl sender=new JavaMailSenderImpl();
  sender.setHost(settings.host); sender.setPort(settings.port);
  sender.setUsername(settings.username); sender.setPassword(password);
  sender.setDefaultEncoding("UTF-8");
  var p=sender.getJavaMailProperties();
  p.setProperty("mail.smtp.auth","true");
  p.setProperty("mail.smtp.ssl.checkserveridentity","true");
  p.setProperty("mail.smtp.ssl.protocols","TLSv1.3 TLSv1.2");
  p.setProperty("mail.smtp.starttls.enable",String.valueOf(settings.tlsMode.equals("STARTTLS")));
  p.setProperty("mail.smtp.starttls.required",String.valueOf(settings.tlsMode.equals("STARTTLS")));
  p.setProperty("mail.smtp.ssl.enable",String.valueOf(settings.tlsMode.equals("TLS")));
  p.setProperty("mail.smtp.connectiontimeout","5000");
  p.setProperty("mail.smtp.timeout","5000"); p.setProperty("mail.smtp.writetimeout","5000");
  p.setProperty("mail.debug","false"); p.setProperty("mail.debug.auth","false");
  return sender;
 }
 private FailureCategory classify(Throwable failure) {
  boolean connectionFailure=false,tlsFailure=false,authenticationFailure=false,rejectedFailure=false;
  var pending=new java.util.ArrayDeque<Throwable>();
  var visited=java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<Throwable,Boolean>());
  var rejectionCode=java.util.regex.Pattern.compile("\\b(550|551|552|553|554)\\b");
  pending.add(failure);
  while(!pending.isEmpty()) {
   Throwable current=pending.removeFirst();
   if(!visited.add(current)) continue;
   if(current.getCause()!=null) pending.add(current.getCause());
   if(current instanceof MailSendException sendFailure) {
    for(Exception nested:sendFailure.getFailedMessages().values()) {
     if(nested!=null) pending.add(nested);
    }
   }
   if(current instanceof MessagingException messagingFailure && messagingFailure.getNextException()!=null) {
    pending.add(messagingFailure.getNextException());
   }
   String name=current.getClass().getName().toLowerCase(java.util.Locale.ROOT);
   String message=String.valueOf(current.getMessage()).toLowerCase(java.util.Locale.ROOT);
   if(name.contains("timeout") || message.contains("timed out") || message.contains("timeout")) return FailureCategory.TIMEOUT;
   if(name.contains("ssl") || name.contains("certificate") || message.contains("certificate") || message.contains("handshake")) tlsFailure=true;
   if(name.contains("authentication") || message.contains("authentication failed") || message.contains("535")) authenticationFailure=true;
   if(message.contains("rejected") || rejectionCode.matcher(message).find()) rejectedFailure=true;
   if(name.contains("connect") || message.contains("connection")) connectionFailure=true;
  }
  if(tlsFailure) return FailureCategory.TLS;
  if(authenticationFailure) return FailureCategory.AUTHENTICATION;
  if(rejectedFailure) return FailureCategory.REJECTED;
  return connectionFailure ? FailureCategory.CONNECTION : FailureCategory.UNKNOWN;
 }
}
