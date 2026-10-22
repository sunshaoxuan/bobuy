package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StorefrontService {
    private final UserRepository users;
    private final TripRepository trips;
    private final ProductRepository products;
    private final OrderHeaderRepository orders;
    private final EmailChallengeRepository challenges;
    private final MerchantCustomerRepository relations;
    private final CheckoutIdentityRepository identities;
    private final AuthService auth;
    private final PasswordEncoder passwords;
    private final JavaMailSender mail;
    private final String from;
    private final SecureRandom random = new SecureRandom();

    public StorefrontService(UserRepository users, TripRepository trips, ProductRepository products,
            OrderHeaderRepository orders, EmailChallengeRepository challenges, MerchantCustomerRepository relations,
            CheckoutIdentityRepository identities, AuthService auth, PasswordEncoder passwords,
            JavaMailSender mail, @Value("${bobuy.mail.from:accounts@bobuy.cc}") String from) {
        this.users = users; this.trips = trips; this.products = products; this.orders = orders;
        this.challenges = challenges; this.relations = relations; this.identities = identities;
        this.auth = auth; this.passwords = passwords; this.mail = mail; this.from = from;
    }

    public List<PublicTrip> publicTrips() {
        return trips.findAll().stream().filter(this::bookable)
            .sorted(Comparator.comparing(Trip::getDepartDate))
            .map(t -> new PublicTrip(t.getId(), t.getAgentId(),
                users.findById(t.getAgentId()).map(User::getName).orElse("Bobuy"),
                t.getOrigin(), t.getDestination(), t.getDepartDate())).toList();
    }

    public List<PublicProduct> publicProducts() {
        return products.findAll().stream().filter(p -> p.getVisibilityStatus() == ProductVisibility.PUBLIC)
            .sorted(Comparator.comparing(Product::getId))
            .map(p -> new PublicProduct(p.getId(), p.getMerchantId(), p.getName(), p.getDescription(), p.getBrand(), p.getBasePrice(),
                p.getCategoryId(), p.getMediaGallery().stream().filter(MediaGalleryItem::isVisible)
                    .filter(m -> m.getType() == MediaType.IMAGE).map(MediaGalleryItem::getUrl).toList())).toList();
    }

    @Transactional
    public User register(Registration request) {
        if (request.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) throw invalid("密码 UTF-8 长度最多 72 字节");
        String username = request.username().trim().toLowerCase(Locale.ROOT);
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.findByUsernameIgnoreCase(username).isPresent() || users.existsByEmailIgnoreCase(email)) {
            throw invalid("用户名或邮箱已被使用");
        }
        User user = new User(nextId(), username, Role.CUSTOMER, 0);
        user.setUsername(username); user.setEmail(email);
        user.setPasswordHash(passwords.encode(request.password()));
        users.saveAndFlush(user);
        sendChallenge(user);
        return user;
    }

    @Transactional
    public void resend(Authentication authentication) {
        User user = lockedCustomer(authentication);
        if (user.getEmailVerifiedAt() != null) return;
        EmailChallenge prior = challenges.findById(user.getId()).orElse(null);
        if (prior != null && prior.sentAt.plusSeconds(60).isAfter(Instant.now())) {
            throw invalid("请在一分钟后重新发送验证码");
        }
        sendChallenge(user);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public void verify(Authentication authentication, String code) {
        User user = lockedCustomer(authentication);
        if (user.getEmailVerifiedAt() != null) return;
        EmailChallenge challenge = challenges.findById(user.getId()).orElseThrow(() -> invalid("请重新获取验证码"));
        if (challenge.attempts >= 5 || !challenge.expiresAt.isAfter(Instant.now())) throw invalid("验证码已失效");
        challenge.attempts++;
        challenges.saveAndFlush(challenge);
        if (!passwords.matches(code, challenge.codeHash)) throw invalid("验证码不正确");
        user.setEmailVerifiedAt(Instant.now());
        users.save(user);
        challenges.delete(challenge);
    }

    private void sendChallenge(User user) {
        String code = String.format(Locale.ROOT, "%06d", random.nextInt(1000000));
        EmailChallenge challenge = new EmailChallenge();
        challenge.userId = user.getId(); challenge.codeHash = passwords.encode(code);
        challenge.sentAt = Instant.now(); challenge.expiresAt = challenge.sentAt.plusSeconds(600);
        challenges.save(challenge);
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from); message.setTo(user.getEmail()); message.setSubject("Bobuy 邮箱验证码");
        message.setText("您的邮箱验证码是 " + code + "，10 分钟内有效。请勿向他人透露。");
        mail.send(message);
    }

    @Transactional
    public CheckoutResult checkout(Authentication authentication, Checkout request) {
        User user = lockedCustomer(authentication);
        String businessId = "WEB-" + user.getId() + "-" + request.requestId();
        Optional<OrderHeader> prior = orders.findByBusinessId(businessId);
        if (prior.isPresent()) {
            OrderHeader existing = prior.get();
            Map<String, Integer> previous = new TreeMap<>();
            existing.getLines().forEach(l -> previous.put(l.getSkuId(), l.getQuantity()));
            if (!existing.getTripId().equals(request.tripId()) || !previous.equals(quantities(request.items()))) {
                throw invalid("重复请求与原订单内容不一致，请刷新购物车");
            }
            return result(existing, user);
        }
        Trip trip = trips.findById(request.tripId()).filter(this::bookable)
            .orElseThrow(() -> invalid("该行程暂不可下单，请重新选择"));
        OrderHeader order = new OrderHeader(businessId, user.getId(), trip.getId());
        order.setId(nextId());
        BigDecimal total = BigDecimal.ZERO;
        for (var entry : quantities(request.items()).entrySet()) {
            Product product = products.findById(entry.getKey())
                .filter(p -> p.getVisibilityStatus() == ProductVisibility.PUBLIC)
                .filter(p -> trip.getAgentId().equals(p.getMerchantId()))
                .orElseThrow(() -> invalid("商品已下架，请刷新购物车"));
            if (!Double.isFinite(product.getBasePrice()) || product.getBasePrice() < 0) throw invalid("商品价格不可用");
            OrderLine line = new OrderLine(product.getId(), product.getName().getOrDefault("zh-CN", product.getName().values().stream().findFirst().orElse(product.getId())),
                null, entry.getValue(), product.getBasePrice());
            line.setId(nextId());
            order.addLine(line);
            total = total.add(BigDecimal.valueOf(product.getBasePrice()).multiply(BigDecimal.valueOf(entry.getValue())));
        }
        order.setTotalAmount(total.doubleValue());
        orders.saveAndFlush(order);
        String key = trip.getAgentId() + ":" + user.getId();
        if (!relations.existsById(key)) {
            MerchantCustomer relation = new MerchantCustomer(); relation.id = key;
            relation.merchantId = trip.getAgentId(); relation.customerId = user.getId(); relations.save(relation);
        }
        return result(order, user);
    }

    private Map<String, Integer> quantities(List<Item> items) {
        Map<String, Integer> result = new TreeMap<>();
        for (Item item : items) {
            int total = result.getOrDefault(item.productId(), 0) + item.quantity();
            if (total > 99) throw invalid("每种商品最多 99 件");
            result.put(item.productId(), total);
        }
        return result;
    }

    public List<CustomerRelation> customers(Authentication authentication) {
        Long merchantId = auth.currentUser(authentication).id();
        Set<Long> customerIds = new HashSet<>();
        orders.findAll().stream().filter(o -> ownedTrip(o.getTripId(), merchantId)).forEach(o -> customerIds.add(o.getCustomerId()));
        return customerIds.stream().filter(Objects::nonNull).sorted().map(id -> {
            User user = users.findById(id).orElseThrow();
            MerchantCustomer relation = relations.findById(merchantId + ":" + id).orElse(null);
            return new CustomerRelation(id, user.getName(), user.getEmailVerifiedAt() != null,
                relation != null && relation.approvedAt != null, relation == null ? null : relation.approvedAt);
        }).toList();
    }

    @Transactional
    public void approve(Authentication authentication, Long customerId) {
        Long merchantId = auth.currentUser(authentication).id();
        users.lockById(customerId).filter(u -> u.getRole() == Role.CUSTOMER)
            .orElseThrow(() -> invalid("客户不存在"));
        boolean hasOrder = orders.findByCustomerId(customerId).stream().anyMatch(o -> ownedTrip(o.getTripId(), merchantId));
        if (!hasOrder) throw new ApiException(ErrorCode.FORBIDDEN, "仅可激活向本商家下过单的客户");
        String key = merchantId + ":" + customerId;
        MerchantCustomer relation = relations.findById(key).orElseGet(MerchantCustomer::new);
        relation.id = key; relation.merchantId = merchantId; relation.customerId = customerId;
        if (relation.approvedAt == null) { relation.approvedAt = Instant.now(); relation.approvedBy = merchantId; }
        relations.save(relation);
    }

    private boolean ownedTrip(Long tripId, Long merchantId) {
        return trips.findById(tripId).map(t -> merchantId.equals(t.getAgentId())).orElse(false);
    }
    private CheckoutResult result(OrderHeader order, User user) {
        Trip trip = trips.findById(order.getTripId()).orElseThrow();
        boolean approved = relations.findById(trip.getAgentId() + ":" + user.getId()).map(r -> r.approvedAt != null).orElse(false);
        return new CheckoutResult(order.getId(), order.getTotalAmount(), order.getStatus().name(), user.getEmailVerifiedAt() != null, approved);
    }
    private User lockedCustomer(Authentication authentication) {
        return users.lockById(auth.currentUser(authentication).id()).filter(u -> u.getRole() == Role.CUSTOMER)
            .orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN, "请使用客户账户下单"));
    }
    private boolean bookable(Trip trip) {
        return trip.getStatus() == TripStatus.PUBLISHED && trip.getDepartDate() != null && !trip.getDepartDate().isBefore(LocalDate.now());
    }
    private Long nextId() { return identities.saveAndFlush(new CheckoutIdentity()).id; }
    private ApiException invalid(String message) { return new ApiException(ErrorCode.INVALID_REQUEST, message); }

    public record Registration(@NotBlank @Pattern(regexp = "[a-zA-Z0-9_]{3,40}") String username,
        @NotBlank @Size(min = 8, max = 72) String password, @NotBlank @Email @Size(max = 254) String email) {}
    public record PublicTrip(Long id, Long merchantId, String merchantName, String origin, String destination, LocalDate departDate) {}
    public record PublicProduct(String id, Long merchantId, Map<String,String> name, Map<String,String> description, String brand,
        double price, String categoryId, List<String> images) {}
    public record Item(@NotBlank @Size(max = 255) String productId, @Min(1) @Max(99) int quantity) {}
    public record Checkout(@NotNull UUID requestId, @NotNull Long tripId, @NotEmpty @Size(max = 50) List<@Valid Item> items) {}
    public record CheckoutResult(Long orderId, double total, String status, boolean emailVerified, boolean merchantApproved) {}
    public record CustomerRelation(Long customerId, String name, boolean emailVerified, boolean merchantApproved, Instant approvedAt) {}
}
