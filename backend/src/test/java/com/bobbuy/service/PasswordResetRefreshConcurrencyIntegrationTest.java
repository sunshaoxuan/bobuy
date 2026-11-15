package com.bobbuy.service;

import static org.junit.jupiter.api.Assertions.*;

import com.bobbuy.api.BobbuyApplication;
import com.bobbuy.api.response.ApiException;
import com.bobbuy.model.PasswordResetToken;
import com.bobbuy.model.RefreshTokenSession;
import com.bobbuy.model.User;
import com.bobbuy.repository.PasswordResetTokenRepository;
import com.bobbuy.repository.RefreshTokenSessionRepository;
import com.bobbuy.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest(
        classes = BobbuyApplication.class,
        properties = "bobbuy.account-mail.password-reset-enabled=true")
class PasswordResetRefreshConcurrencyIntegrationTest {
    @Autowired UserRepository users;
    @Autowired PasswordResetTokenRepository resetTokens;
    @Autowired RefreshTokenSessionRepository sessions;
    @Autowired PasswordResetService resets;
    @Autowired RefreshTokenService refreshTokens;
    @Autowired BobbuyStore store;
    @Autowired PlatformTransactionManager transactions;

    @Test
    void resetWaitsForConcurrentSessionReplacementAndRevokesIt() throws Exception {
        store.seed();
        User user=users.findByUsernameIgnoreCase("agent").orElseThrow();
        String raw="concurrent-reset-token";
        PasswordResetToken reset=new PasswordResetToken();
        reset.setUserId(user.getId()); reset.setTokenHash(hash(raw)); reset.setEmailHash(hash(user.getEmail().trim().toLowerCase()));
        reset.setCreatedAt(Instant.now()); reset.setExpiresAt(Instant.now().plusSeconds(60)); resetTokens.saveAndFlush(reset);

        CountDownLatch locked=new CountDownLatch(1), release=new CountDownLatch(1);
        ExecutorService executor=Executors.newFixedThreadPool(2);
        try {
            Future<Long> replacement=executor.submit(() -> new TransactionTemplate(transactions).execute(status -> {
                users.lockById(user.getId()).orElseThrow();
                locked.countDown();
                await(release);
                RefreshTokenSession session=new RefreshTokenSession();
                Instant now=Instant.now(); session.setUserId(user.getId()); session.setTokenHash(hash("replacement-refresh"));
                session.setFamilyId("concurrent-family"); session.setCreatedAt(now); session.setLastUsedAt(now); session.setExpiresAt(now.plusSeconds(300));
                return sessions.saveAndFlush(session).getId();
            }));
            assertTrue(locked.await(5,TimeUnit.SECONDS));
            Future<?> passwordReset=executor.submit(() -> resets.reset(raw,"replacement-password"));
            Thread.sleep(100);
            assertFalse(passwordReset.isDone(),"reset must wait on the shared user lock");
            release.countDown();
            Long sessionId=replacement.get(5,TimeUnit.SECONDS);
            passwordReset.get(5,TimeUnit.SECONDS);
            RefreshTokenSession revoked=sessions.findById(sessionId).orElseThrow();
            assertNotNull(revoked.getRevokedAt());
            assertEquals("PASSWORD_RESET",revoked.getRevocationReason());
        } finally {
            release.countDown(); executor.shutdownNow();
        }
    }

    @Test
    void refreshReloadsSessionAfterWaitingForUserLock() throws Exception {
        store.seed();
        User user=users.findByUsernameIgnoreCase("agent").orElseThrow();
        String raw="refresh-revoked-while-waiting";
        RefreshTokenSession session=new RefreshTokenSession();
        Instant now=Instant.now(); session.setUserId(user.getId()); session.setTokenHash(hash(raw));
        session.setFamilyId("stale-refresh-family"); session.setCreatedAt(now); session.setLastUsedAt(now);
        session.setExpiresAt(now.plusSeconds(300)); Long sessionId=sessions.saveAndFlush(session).getId();

        CountDownLatch changed=new CountDownLatch(1), release=new CountDownLatch(1);
        ExecutorService executor=Executors.newFixedThreadPool(2);
        try {
            Future<?> revocation=executor.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
                users.lockById(user.getId()).orElseThrow();
                RefreshTokenSession locked=sessions.findById(sessionId).orElseThrow();
                locked.setRevokedAt(Instant.now()); locked.setRevocationReason("LOGOUT"); sessions.saveAndFlush(locked);
                changed.countDown(); await(release);
            }));
            assertTrue(changed.await(5,TimeUnit.SECONDS));
            Future<?> refresh=executor.submit(() -> refreshTokens.refresh(raw,"concurrent-client"));
            Thread.sleep(100);
            assertFalse(refresh.isDone(),"refresh must wait on the shared user lock");
            release.countDown(); revocation.get(5,TimeUnit.SECONDS);
            ExecutionException failure=assertThrows(ExecutionException.class,() -> refresh.get(5,TimeUnit.SECONDS));
            assertInstanceOf(ApiException.class,failure.getCause());
        } finally {
            release.countDown(); executor.shutdownNow();
        }
    }

    @Test
    void resetReloadsTokenAfterWaitingForUserLock() throws Exception {
        store.seed();
        User user=users.findByUsernameIgnoreCase("agent").orElseThrow();
        String raw="reset-consumed-while-waiting";
        PasswordResetToken reset=new PasswordResetToken();
        reset.setUserId(user.getId()); reset.setTokenHash(hash(raw)); reset.setEmailHash(hash(user.getEmail().trim().toLowerCase()));
        reset.setCreatedAt(Instant.now()); reset.setExpiresAt(Instant.now().plusSeconds(60)); Long tokenId=resetTokens.saveAndFlush(reset).getId();

        CountDownLatch changed=new CountDownLatch(1), release=new CountDownLatch(1);
        ExecutorService executor=Executors.newFixedThreadPool(2);
        try {
            Future<?> consumption=executor.submit(() -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
                users.lockById(user.getId()).orElseThrow();
                PasswordResetToken locked=resetTokens.findById(tokenId).orElseThrow();
                locked.setConsumedAt(Instant.now()); resetTokens.saveAndFlush(locked);
                changed.countDown(); await(release);
            }));
            assertTrue(changed.await(5,TimeUnit.SECONDS));
            Future<?> passwordReset=executor.submit(() -> resets.reset(raw,"replacement-password"));
            Thread.sleep(100);
            assertFalse(passwordReset.isDone(),"reset must wait on the shared user lock");
            release.countDown(); consumption.get(5,TimeUnit.SECONDS);
            ExecutionException failure=assertThrows(ExecutionException.class,() -> passwordReset.get(5,TimeUnit.SECONDS));
            assertInstanceOf(ApiException.class,failure.getCause());
        } finally {
            release.countDown(); executor.shutdownNow();
        }
    }

    private static void await(CountDownLatch latch) {
        try { if (!latch.await(5,TimeUnit.SECONDS)) throw new AssertionError("timeout"); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new AssertionError(e); }
    }
    private static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new AssertionError(e); }
    }
}
