package com.bobbuy.security;

import com.bobbuy.model.Role;
import java.security.Principal;
import java.util.Set;

public record BobbuyAuthenticatedUser(Long id, String username, String displayName, Set<Role> roles) implements Principal {
    @Override
    public String getName() {
        return id == null ? "" : String.valueOf(id);
    }
}
