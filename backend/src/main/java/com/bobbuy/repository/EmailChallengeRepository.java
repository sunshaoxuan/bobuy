package com.bobbuy.repository;
import com.bobbuy.model.EmailChallenge;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EmailChallengeRepository extends JpaRepository<EmailChallenge, Long> {}
