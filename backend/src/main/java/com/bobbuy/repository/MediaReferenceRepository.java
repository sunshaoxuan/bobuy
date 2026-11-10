package com.bobbuy.repository;
import com.bobbuy.model.MediaReference;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface MediaReferenceRepository extends JpaRepository<MediaReference,String>{
 List<MediaReference> findByBlobSha256(String sha);
 boolean existsByBlobSha256(String sha);
}
