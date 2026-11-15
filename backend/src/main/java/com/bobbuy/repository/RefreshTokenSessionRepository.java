package com.bobbuy.repository;

import com.bobbuy.model.RefreshTokenSession;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface RefreshTokenSessionRepository extends JpaRepository<RefreshTokenSession, Long> {
    Optional<RefreshTokenSession> findByTokenHash(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select session from RefreshTokenSession session where session.tokenHash = :tokenHash")
    Optional<RefreshTokenSession> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    List<RefreshTokenSession> findAllByFamilyIdAndRevokedAtIsNull(String familyId);

    List<RefreshTokenSession> findAllByUserIdAndRevokedAtIsNull(Long userId);
}
