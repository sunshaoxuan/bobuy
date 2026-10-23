package com.bobbuy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.HashSet;

@Entity
@Table(name = "bb_user")
public class User {
  @Id
  private Long id;

  @NotBlank(message = "{validation.user.name.required}")
  private String name;

  @Column(length = 100)
  private String username;

  @Column(length = 255)
  private String passwordHash;

  private boolean enabled = true;

  @jakarta.validation.constraints.NotEmpty
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb", nullable = false)
  private Set<Role> roles = new HashSet<>();

  @Column(nullable = false)
  private boolean platformAdmin;

  private double rating;
  private String phone;
  private String email;

  private java.time.Instant emailVerifiedAt;

  public java.time.Instant getEmailVerifiedAt() { return emailVerifiedAt; }
  public void setEmailVerifiedAt(java.time.Instant value) { emailVerifiedAt = value; }

  @Column(length = 2000)
  private String note;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb")
  private UserAddress defaultAddress;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(columnDefinition = "jsonb")
  private List<UserSocialAccount> socialAccounts = new ArrayList<>();

  public User() {
  }

  public User(Long id, String name, Role role, double rating) {
    this.id = id;
    this.name = name;
    this.roles.add(role);
    this.rating = rating;
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getUsername() {
    return username;
  }

  public void setUsername(String username) {
    this.username = username;
  }

  @com.fasterxml.jackson.annotation.JsonIgnore
  public String getPasswordHash() {
    return passwordHash;
  }

  public void setPasswordHash(String passwordHash) {
    this.passwordHash = passwordHash;
  }

  public boolean isEnabled() {
    return enabled;
  }

  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  public Set<Role> getRoles() { return Set.copyOf(roles); }
  public void setRoles(Set<Role> roles) { this.roles = new HashSet<>(roles); }
  public boolean hasRole(Role role) { return roles.contains(role); }
  public boolean isPlatformAdmin() { return platformAdmin; }
  public void setPlatformAdmin(boolean value) { platformAdmin = value; }

  public double getRating() {
    return rating;
  }

  public void setRating(double rating) {
    this.rating = rating;
  }

  public String getPhone() {
    return phone;
  }

  public void setPhone(String phone) {
    this.phone = phone;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getNote() {
    return note;
  }

  public void setNote(String note) {
    this.note = note;
  }

  public UserAddress getDefaultAddress() {
    return defaultAddress;
  }

  public void setDefaultAddress(UserAddress defaultAddress) {
    this.defaultAddress = defaultAddress;
  }

  public List<UserSocialAccount> getSocialAccounts() {
    return socialAccounts;
  }

  public void setSocialAccounts(List<UserSocialAccount> socialAccounts) {
    this.socialAccounts = socialAccounts == null ? new ArrayList<>() : new ArrayList<>(socialAccounts);
  }

  public static class UserAddress {
    private String contactName;
    private String phone;
    private String countryRegion;
    private String city;
    private String addressLine;
    private String postalCode;
    private Double latitude;
    private Double longitude;

    public String getContactName() {
      return contactName;
    }

    public void setContactName(String contactName) {
      this.contactName = contactName;
    }

    public String getPhone() {
      return phone;
    }

    public void setPhone(String phone) {
      this.phone = phone;
    }

    public String getCountryRegion() {
      return countryRegion;
    }

    public void setCountryRegion(String countryRegion) {
      this.countryRegion = countryRegion;
    }

    public String getCity() {
      return city;
    }

    public void setCity(String city) {
      this.city = city;
    }

    public String getAddressLine() {
      return addressLine;
    }

    public void setAddressLine(String addressLine) {
      this.addressLine = addressLine;
    }

    public String getPostalCode() {
      return postalCode;
    }

    public void setPostalCode(String postalCode) {
      this.postalCode = postalCode;
    }

    public Double getLatitude() {
      return latitude;
    }

    public void setLatitude(Double latitude) {
      this.latitude = latitude;
    }

    public Double getLongitude() {
      return longitude;
    }

    public void setLongitude(Double longitude) {
      this.longitude = longitude;
    }
  }

  public static class UserSocialAccount {
    private String platform;
    private String handle;
    private String displayName;
    private boolean verified;
    private String note;

    public String getPlatform() {
      return platform;
    }

    public void setPlatform(String platform) {
      this.platform = platform;
    }

    public String getHandle() {
      return handle;
    }

    public void setHandle(String handle) {
      this.handle = handle;
    }

    public String getDisplayName() {
      return displayName;
    }

    public void setDisplayName(String displayName) {
      this.displayName = displayName;
    }

    public boolean isVerified() {
      return verified;
    }

    public void setVerified(boolean verified) {
      this.verified = verified;
    }

    public String getNote() {
      return note;
    }

    public void setNote(String note) {
      this.note = note;
    }
  }
}
