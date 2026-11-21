package com.bobbuy.service;

import com.bobbuy.model.MailSettings;
import jakarta.mail.AuthenticationFailedException;
import jakarta.mail.MessagingException;
import jakarta.mail.SendFailedException;
import jakarta.mail.Transport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

@Component
public class SmtpDelivery {
 private static final Logger log = LoggerFactory.getLogger(SmtpDelivery.class);

 private final int readTimeoutMs;

 public SmtpDelivery(@Value("${bobuy.mail.smtp-read-timeout-ms:15000}") int readTimeoutMs) {
  if (readTimeoutMs < 5000 || readTimeoutMs > 30000) {
   throw new IllegalArgumentException("SMTP read timeout must be between 5000 and 30000 ms");
  }
  this.readTimeoutMs = readTimeoutMs;
 }

 enum Stage { PREPARE, CONNECT, AUTH, REJECTED, SUBMIT_UNKNOWN, CLOSE_AFTER_ACCEPT }

 static final class Failure extends RuntimeException {
  final Stage stage;

  Failure(Stage stage) {
   super("SMTP delivery failed at " + stage);
   this.stage = stage;
  }
 }

 public void send(MailSettings settings, String password, SimpleMailMessage message) {
  JavaMailSenderImpl sender = createSender(settings, password);
  Transport transport = null;
  Stage stage = Stage.PREPARE;
  boolean accepted = false;
  try {
   var mime = sender.createMimeMessage();
   var helper = new MimeMessageHelper(mime, "UTF-8");
   helper.setFrom(settings.fromAddress);
   helper.setReplyTo(settings.replyTo);
   helper.setTo(message.getTo());
   helper.setSubject(message.getSubject());
   helper.setText(message.getText());
   mime.saveChanges();

   stage = Stage.CONNECT;
   transport = openTransport(sender);
   transport.connect(settings.host, settings.port, settings.username, password);
   stage = Stage.SUBMIT_UNKNOWN;
   transport.sendMessage(mime, mime.getAllRecipients());
   accepted = true;
  } catch (AuthenticationFailedException failure) {
   throw new Failure(Stage.AUTH);
  } catch (SendFailedException failure) {
   // Angus can wrap a socket failure in SendFailedException. Only a negative
   // SMTP reply proves rejection. Loss of the final DATA reply is ambiguous.
   throw new Failure(hasNegativeReply(failure) ? Stage.REJECTED : stage);
  } catch (MessagingException | RuntimeException failure) {
   throw new Failure(stage);
  } finally {
   sender.setPassword(null);
   if (transport != null) {
    try {
     transport.close();
    } catch (MessagingException | RuntimeException closeFailure) {
     if (accepted) log.warn("SMTP event {}", Stage.CLOSE_AFTER_ACCEPT);
    }
   }
  }
 }

 Transport openTransport(JavaMailSenderImpl sender) throws MessagingException {
  return sender.getSession().getTransport("smtp");
 }

 private boolean hasNegativeReply(MessagingException failure) {
  for (Exception current = failure; current != null; ) {
   if (current instanceof org.eclipse.angus.mail.smtp.SMTPSendFailedException reply) {
    return reply.getReturnCode() >= 400;
   }
   if (current instanceof org.eclipse.angus.mail.smtp.SMTPAddressFailedException reply) {
    return reply.getReturnCode() >= 400;
   }
   current = current instanceof MessagingException messaging ? messaging.getNextException() : null;
  }
  return false;
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
  p.setProperty("mail.smtp.timeout",Integer.toString(readTimeoutMs));
  p.setProperty("mail.smtp.writetimeout","5000");
  p.setProperty("mail.debug","false"); p.setProperty("mail.debug.auth","false");
  return sender;
 }
}
