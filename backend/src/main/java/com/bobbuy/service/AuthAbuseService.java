package com.bobbuy.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Database-backed authentication quotas shared by every application replica. */
@Service
public class AuthAbuseService {
    public enum Purpose { LOGIN, REGISTER, VERIFICATION_RESEND, VERIFICATION_VERIFY, FORGOT_PASSWORD }
    private final JdbcTemplate db;
    private final boolean enabled;
    private final int limit;
    private final Duration window;
    private final Duration baseDelay;
    private final Duration maxDelay;

    public AuthAbuseService(JdbcTemplate db,
            @Value("${bobbuy.auth-abuse.enabled:false}") boolean enabled,
            @Value("${bobbuy.auth-abuse.limit:10}") int limit,
            @Value("${bobbuy.auth-abuse.window-seconds:300}") long windowSeconds,
            @Value("${bobbuy.auth-abuse.base-delay-seconds:1}") long baseDelaySeconds,
            @Value("${bobbuy.auth-abuse.max-delay-seconds:60}") long maxDelaySeconds) {
        this.db=db; this.enabled=enabled; this.limit=Math.max(1,limit);
        this.window=Duration.ofSeconds(Math.max(1,windowSeconds));
        this.baseDelay=Duration.ofSeconds(Math.max(0,baseDelaySeconds));
        this.maxDelay=Duration.ofSeconds(Math.max(1,maxDelaySeconds));
    }

    @Transactional
    public Attempt begin(Purpose purpose, String clientIp, String target) {
        Attempt attempt=new Attempt(purpose,key("ip",clientIp),key("target",normalize(target)));
        if (!enabled) return attempt;
        long ipRetry=consume(attempt.ipKey(),purpose); long targetRetry=consume(attempt.targetKey(),purpose);
        long retry=Math.max(ipRetry,targetRetry);
        if(retry>0){ audit(attempt,"THROTTLED"); throw new AuthAbuseException(retry); }
        return attempt;
    }

    @Transactional
    public void failed(Attempt attempt) {
        if(!enabled)return;
        fail(attempt.ipKey()); fail(attempt.targetKey()); audit(attempt,"REJECTED");
    }

    @Transactional
    public void succeeded(Attempt attempt) {
        if(!enabled)return;
        db.update("UPDATE auth_abuse_bucket SET failure_count=0, blocked_until=NULL, updated_at=current_timestamp WHERE bucket_key IN (?,?)",attempt.ipKey(),attempt.targetKey());
        audit(attempt,"ACCEPTED");
    }

    private long consume(String key,Purpose purpose){
        db.update("""
            INSERT INTO auth_abuse_bucket(bucket_key,purpose,window_started_at,request_count,failure_count,updated_at)
            VALUES (?, ?, current_timestamp, 1, 0, current_timestamp)
            ON CONFLICT(bucket_key) DO UPDATE SET
              purpose=excluded.purpose,
              window_started_at=CASE WHEN auth_abuse_bucket.window_started_at < current_timestamp-(? * interval '1 second') THEN current_timestamp ELSE auth_abuse_bucket.window_started_at END,
              request_count=CASE WHEN auth_abuse_bucket.window_started_at < current_timestamp-(? * interval '1 second') THEN 1 ELSE auth_abuse_bucket.request_count+1 END,
              failure_count=CASE WHEN auth_abuse_bucket.window_started_at < current_timestamp-(? * interval '1 second') THEN 0 ELSE auth_abuse_bucket.failure_count END,
              blocked_until=CASE WHEN auth_abuse_bucket.window_started_at < current_timestamp-(? * interval '1 second') THEN NULL ELSE auth_abuse_bucket.blocked_until END,
              updated_at=current_timestamp
            """,key,purpose.name(),window.toSeconds(),window.toSeconds(),window.toSeconds(),window.toSeconds());
        return db.queryForObject("SELECT CASE WHEN blocked_until>current_timestamp THEN ceil(extract(epoch from blocked_until-current_timestamp))::bigint WHEN request_count>? THEN ceil(extract(epoch from window_started_at+(? * interval '1 second')-current_timestamp))::bigint ELSE 0 END FROM auth_abuse_bucket WHERE bucket_key=?",Long.class,limit,window.toSeconds(),key);
    }

    private void fail(String key){
        db.update("UPDATE auth_abuse_bucket SET failure_count=failure_count+1, blocked_until=current_timestamp+(LEAST(?, ? * power(2, LEAST(failure_count, 20))) * interval '1 second'), updated_at=current_timestamp WHERE bucket_key=?",maxDelay.toSeconds(),baseDelay.toSeconds(),key);
    }
    private void audit(Attempt a,String outcome){db.update("INSERT INTO auth_abuse_audit(purpose,outcome,ip_key,target_key) VALUES (?,?,?,?)",a.purpose().name(),outcome,a.ipKey(),a.targetKey());}
    private static String normalize(String value){return value==null?"":value.trim().toLowerCase(Locale.ROOT);}
    private static String key(String type,String value){
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((type+'\0'+normalize(value)).getBytes(StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}
    }
    public record Attempt(Purpose purpose,String ipKey,String targetKey) {}
}

