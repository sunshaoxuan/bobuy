package com.bobbuy.repository;
import com.bobbuy.model.MediaCatalogGuard;
import org.springframework.data.jpa.repository.*;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface MediaCatalogGuardRepository extends JpaRepository<MediaCatalogGuard,Long>{
 @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select g from MediaCatalogGuard g where g.id=1")
 Optional<MediaCatalogGuard> lock();
}
