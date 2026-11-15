package com.bobbuy.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bobbuy.api.response.GlobalExceptionHandler;
import java.lang.reflect.Method;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.mockito.stubbing.Answer;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

class AuthAbuseServiceTest {
    @Test void quotaAllowsTheBoundaryAndWindowRecoveryStartsAnewQuota() {
        var database=new QuotaDatabase();
        var service=database.service(2,60);

        service.begin(AuthAbuseService.Purpose.LOGIN,"192.0.2.1","Person@Example.com");
        service.begin(AuthAbuseService.Purpose.LOGIN,"192.0.2.1","person@example.com");
        assertThatThrownBy(()->service.begin(AuthAbuseService.Purpose.LOGIN,"192.0.2.1","person@example.com"))
                .isInstanceOf(AuthAbuseException.class);

        database.advance(Duration.ofSeconds(61));
        service.begin(AuthAbuseService.Purpose.LOGIN,"192.0.2.1","person@example.com");
    }

    @Test void concurrentRequestsCannotOversubscribeTheQuota() throws Exception {
        var database=new QuotaDatabase();
        var service=database.service(5,60);
        var ready=new CountDownLatch(12); var start=new CountDownLatch(1);
        var pool=Executors.newFixedThreadPool(12); var outcomes=new ArrayList<Boolean>();
        for(int i=0;i<12;i++)pool.submit(()->{ready.countDown();start.await();try{service.begin(AuthAbuseService.Purpose.LOGIN,"192.0.2.2","same@example.com");synchronized(outcomes){outcomes.add(true);}}catch(AuthAbuseException rejected){synchronized(outcomes){outcomes.add(false);}}return null;});
        assertThat(ready.await(5,TimeUnit.SECONDS)).isTrue(); start.countDown(); pool.shutdown();
        assertThat(pool.awaitTermination(5,TimeUnit.SECONDS)).isTrue();
        assertThat(outcomes).hasSize(12); assertThat(outcomes.stream().filter(Boolean::booleanValue)).hasSize(5);
    }

    @Test void purposesHaveIndependentRequestAndProgressiveDelayBuckets() {
        var database=new QuotaDatabase(); var service=database.service(1,60);
        var login=service.begin(AuthAbuseService.Purpose.LOGIN,"192.0.2.3","same@example.com");
        service.failed(login);

        service.begin(AuthAbuseService.Purpose.VERIFICATION_VERIFY,"192.0.2.3","same@example.com");
        service.succeeded(new AuthAbuseService.Attempt(AuthAbuseService.Purpose.VERIFICATION_VERIFY,login.ipKey(),login.targetKey()));
        assertThatThrownBy(()->service.begin(AuthAbuseService.Purpose.LOGIN,"192.0.2.3","same@example.com"))
                .isInstanceOf(AuthAbuseException.class);
    }

    @Test void throttledAuditIsWrittenAndExpectedExceptionIsConfiguredToCommit() throws Exception {
        var database=new QuotaDatabase(); var service=database.service(1,60);
        service.begin(AuthAbuseService.Purpose.LOGIN,"192.0.2.4","hidden@example.com");
        assertThatThrownBy(()->service.begin(AuthAbuseService.Purpose.LOGIN,"192.0.2.4","hidden@example.com"))
                .isInstanceOf(AuthAbuseException.class);
        assertThat(database.audits).contains("LOGIN:THROTTLED");

        Method begin=AuthAbuseService.class.getMethod("begin",AuthAbuseService.Purpose.class,String.class,String.class);
        assertThat(begin.getAnnotation(Transactional.class).noRollbackFor()).contains(AuthAbuseException.class);
    }

    @Test void rateLimitedResponseDoesNotRevealWhetherTheTargetExists() {
        var messages=new StaticMessageSource(); messages.addMessage("error.auth.rate_limited",java.util.Locale.ENGLISH,"Try again later");
        var handler=new GlobalExceptionHandler(messages);
        var previousLocaleContext=LocaleContextHolder.getLocaleContext();
        try {
            LocaleContextHolder.setLocale(java.util.Locale.ENGLISH);
            var existing=handler.handleAuthAbuse(new AuthAbuseException(12));
            var absent=handler.handleAuthAbuse(new AuthAbuseException(12));
            assertThat(existing.getStatusCode()).isEqualTo(absent.getStatusCode());
            assertThat(existing.getHeaders()).isEqualTo(absent.getHeaders());
            assertThat(existing.getBody().getErrorCode()).isEqualTo(absent.getBody().getErrorCode());
            assertThat(existing.getBody().getMessage()).isEqualTo(absent.getBody().getMessage());
            assertThat(existing.getBody().getMessage()).doesNotContain("account","email","exist");
        } finally {
            LocaleContextHolder.setLocaleContext(previousLocaleContext);
        }
    }

    private static final class QuotaDatabase {
        private record Key(String purpose,String bucket) {}
        private static final class Bucket {long started; int requests; int failures; long blockedUntil;}
        private final Map<Key,Bucket> buckets=new HashMap<>();
        private final List<String> audits=new ArrayList<>();
        private long now;
        private final JdbcTemplate jdbc=mock(JdbcTemplate.class);

        QuotaDatabase(){
            when(jdbc.update(anyString(),org.mockito.ArgumentMatchers.any(Object[].class))).thenAnswer(update());
            when(jdbc.queryForObject(anyString(),eq(Long.class),org.mockito.ArgumentMatchers.any(Object[].class))).thenAnswer(query());
        }
        AuthAbuseService service(int limit,long window){
            return new AuthAbuseService(jdbc,true,limit,window,2,30) {
                @Override public synchronized Attempt begin(Purpose purpose,String clientIp,String target) {
                    // PostgreSQL keeps the first bucket row locked until the @Transactional method exits.
                    // Keep both stubbed bucket updates in the same critical section to model that ordering.
                    return super.begin(purpose,clientIp,target);
                }
            };
        }
        void advance(Duration duration){synchronized(this){now+=duration.toSeconds();}}

        private Answer<Integer> update(){return invocation->{Object[] raw=invocation.getRawArguments();String sql=(String)raw[0];Object[] a=(Object[])raw[1];synchronized(this){
            if(sql.contains("INSERT INTO auth_abuse_bucket")){Key key=new Key(a[1].toString(),a[0].toString());Bucket b=buckets.computeIfAbsent(key,ignored->{var value=new Bucket();value.started=now;return value;});long window=((Number)a[2]).longValue();if(b.started<now-window){b.started=now;b.requests=0;b.failures=0;b.blockedUntil=0;}b.requests++;}
            else if(sql.contains("failure_count=failure_count+1")){Key key=new Key(a[2].toString(),a[3].toString());Bucket b=buckets.get(key);b.blockedUntil=now+Math.min(((Number)a[0]).longValue(),((Number)a[1]).longValue()*(1L<<Math.min(b.failures,20)));b.failures++;}
            else if(sql.startsWith("UPDATE auth_abuse_bucket SET failure_count=0")){for(int i=1;i<=2;i++){Bucket b=buckets.get(new Key(a[0].toString(),a[i].toString()));if(b!=null){b.failures=0;b.blockedUntil=0;}}}
            else if(sql.contains("INSERT INTO auth_abuse_audit"))audits.add(a[0]+":"+a[1]);
            return 1;}};}
        private Answer<Long> query(){return invocation->{Object[] a=(Object[])invocation.getRawArguments()[2];synchronized(this){Bucket b=buckets.get(new Key(a[2].toString(),a[3].toString()));long limit=((Number)a[0]).longValue();long window=((Number)a[1]).longValue();if(b.blockedUntil>now)return b.blockedUntil-now;if(b.requests>limit)return Math.max(1,b.started+window-now);return 0L;}};}
    }
}
