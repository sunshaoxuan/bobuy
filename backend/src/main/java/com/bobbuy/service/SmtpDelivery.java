package com.bobbuy.service;

import com.bobbuy.model.MailSettings;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

@Component
public class SmtpDelivery {
 public void send(MailSettings settings,String password,SimpleMailMessage message) {
  JavaMailSenderImpl sender=createSender(settings,password);
  message.setFrom(settings.fromAddress); message.setReplyTo(settings.replyTo);
  try { sender.send(message); }
  catch(Exception ignored) { throw new IllegalStateException("SMTP delivery failed"); }
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
}
