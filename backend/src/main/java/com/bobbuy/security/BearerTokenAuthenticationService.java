package com.bobbuy.security;

import com.bobbuy.model.User;
import com.bobbuy.repository.UserRepository;
import java.util.ArrayList;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

@Service
public class BearerTokenAuthenticationService {
    private final JwtTokenService jwtTokenService;
    private final UserRepository userRepository;

    public BearerTokenAuthenticationService(JwtTokenService jwtTokenService, UserRepository userRepository) {
        this.jwtTokenService = jwtTokenService;
        this.userRepository = userRepository;
    }

    public Authentication authenticate(String token) {
        JwtTokenService.VerifiedToken verifiedToken = jwtTokenService.verify(token);
        User user = userRepository.findById(verifiedToken.userId())
            .filter(User::isEnabled)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        BobbuyAuthenticatedUser principal =
            new BobbuyAuthenticatedUser(user.getId(), user.getUsername(), user.getName(), user.getRoles());
        var authorities = new ArrayList<SimpleGrantedAuthority>();
        user.getRoles().forEach(role -> authorities.add(new SimpleGrantedAuthority("ROLE_" + role.name())));
        if (user.isPlatformAdmin()) authorities.add(new SimpleGrantedAuthority("ROLE_PLATFORM_ADMIN"));
        return new UsernamePasswordAuthenticationToken(
            principal,
            null,
            authorities
        );
    }
}
