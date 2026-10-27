package com.bobbuy.model;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name="bb_mail_settings_event")
public class MailSettingsEvent {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 public Long actorId;
 public Instant occurredAt;
 public String eventType;
 public long settingsVersion;
 public MailSettingsEvent() {}
 public MailSettingsEvent(long actor,long version,String type) {
  actorId=actor; settingsVersion=version; eventType=type; occurredAt=Instant.now();
 }
}
