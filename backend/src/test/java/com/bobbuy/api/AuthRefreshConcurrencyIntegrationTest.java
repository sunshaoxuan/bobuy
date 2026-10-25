package com.bobbuy.api;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.service.AuthService;
import com.bobbuy.service.BobbuyStore;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class AuthRefreshConcurrencyIntegrationTest {

  @Autowired
  private AuthService authService;

  @Autowired
  private BobbuyStore store;

  private ExecutorService executorService;

  @BeforeEach
  void setUp() {
    store.seed();
    executorService = Executors.newFixedThreadPool(4);
  }

  @AfterEach
  void tearDown() {
    executorService.shutdownNow();
  }

  @Test
  void concurrentRefreshOnlySucceedsOnce() throws Exception {
    AuthService.SessionResult loginSession = authService.login("agent", "agent-pass", "agent-browser");
    CountDownLatch ready = new CountDownLatch(4);
    CountDownLatch start = new CountDownLatch(1);
    List<Future<RefreshAttempt>> futures = new ArrayList<>();

    for (int index = 0; index < 4; index++) {
      final int attemptNo = index;
      futures.add(executorService.submit(() -> {
        ready.countDown();
        Assertions.assertTrue(start.await(5, TimeUnit.SECONDS));
        try {
          AuthService.SessionResult session = authService.refresh(loginSession.refreshToken(), "agent-browser-" + attemptNo);
          return RefreshAttempt.success(session.refreshToken());
        } catch (ApiException ex) {
          return RefreshAttempt.failure(ex.getErrorCode());
        }
      }));
    }

    Assertions.assertTrue(ready.await(5, TimeUnit.SECONDS));
    start.countDown();

    List<String> successfulRefreshTokens = new ArrayList<>();
    List<ErrorCode> failures = new ArrayList<>();
    for (Future<RefreshAttempt> future : futures) {
      RefreshAttempt attempt = future.get(5, TimeUnit.SECONDS);
      if (attempt.refreshToken() != null) {
        successfulRefreshTokens.add(attempt.refreshToken());
      } else {
        failures.add(attempt.errorCode());
      }
    }

    Assertions.assertEquals(1, successfulRefreshTokens.size());
    Assertions.assertEquals(3, failures.size());
    Assertions.assertTrue(failures.stream().allMatch(errorCode -> errorCode == ErrorCode.UNAUTHORIZED));

    AuthService.SessionResult nextSession = authService.refresh(successfulRefreshTokens.get(0), "agent-browser-next");
    Assertions.assertNotNull(nextSession.refreshToken());
    Assertions.assertNotEquals(successfulRefreshTokens.get(0), nextSession.refreshToken());
  }

  @Test
  void independentLoginsRefreshConcurrentlyAndLogoutIsSessionScoped() throws Exception {
    var first = authService.login("agent", "agent-pass", "browser-one");
    var second = authService.login("agent", "agent-pass", "browser-two");
    var one = executorService.submit(() -> authService.refresh(first.refreshToken(), "browser-one"));
    var two = executorService.submit(() -> authService.refresh(second.refreshToken(), "browser-two"));
    var refreshedOne = one.get(10, TimeUnit.SECONDS);
    var refreshedTwo = two.get(10, TimeUnit.SECONDS);
    Assertions.assertNotEquals(refreshedOne.refreshToken(), refreshedTwo.refreshToken());
    authService.logout(refreshedOne.refreshToken());
    Assertions.assertThrows(ApiException.class, () -> authService.refresh(refreshedOne.refreshToken(), "browser-one"));
    Assertions.assertNotNull(authService.refresh(refreshedTwo.refreshToken(), "browser-two").accessToken());
  }

  private record RefreshAttempt(String refreshToken, ErrorCode errorCode) {
    private static RefreshAttempt success(String refreshToken) {
      return new RefreshAttempt(refreshToken, null);
    }

    private static RefreshAttempt failure(ErrorCode errorCode) {
      return new RefreshAttempt(null, errorCode);
    }
  }
}
