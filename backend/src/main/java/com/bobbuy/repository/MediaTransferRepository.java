package com.bobbuy.repository;
import com.bobbuy.model.MediaTransfer;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;

public interface MediaTransferRepository extends JpaRepository<MediaTransfer,String> {
 boolean existsByRawSha256(String sha256);
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select t from MediaTransfer t where t.imageId=:id")
 Optional<MediaTransfer> lock(@Param("id") String id);
 @Query("select t.imageId from MediaTransfer t where t.state <> 'VERIFIED' and (t.leaseUntil is null or t.leaseUntil < :now) order by t.updatedAt,t.imageId")
 List<String> pending(@Param("now") Instant now,Pageable page);
}
