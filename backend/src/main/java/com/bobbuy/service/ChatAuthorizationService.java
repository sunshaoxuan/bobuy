package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.ChatMessage;
import com.bobbuy.repository.OrderHeaderRepository;
import com.bobbuy.security.CustomerIdentityResolver;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class ChatAuthorizationService {
    // Chat topics are resolved to `/topic/order/{orderId}`, `/topic/trip/{tripId}`,
    // or `/topic/private/{participantA}/{participantB}`. WebSocket authorization
    // extracts the numeric resource id from group(1) for order/trip topics.
    private static final Pattern ORDER_TOPIC = Pattern.compile("^/topic/order/(\\d+)$");
    private static final Pattern TRIP_TOPIC = Pattern.compile("^/topic/trip/(\\d+)$");
    private static final Pattern PRIVATE_TOPIC = Pattern.compile("^/topic/private/([^/]+)/([^/]+)$");

    private final OrderHeaderRepository orderHeaderRepository;
    private final CustomerIdentityResolver customerIdentityResolver;
    private final com.bobbuy.repository.TripRepository tripRepository;

    public ChatAuthorizationService(OrderHeaderRepository orderHeaderRepository,
                                    CustomerIdentityResolver customerIdentityResolver,
                                    com.bobbuy.repository.TripRepository tripRepository) {
        this.orderHeaderRepository = orderHeaderRepository;
        this.customerIdentityResolver = customerIdentityResolver;
        this.tripRepository = tripRepository;
    }

    public void authorizeMessage(Authentication authentication, ChatMessage message) {
        requireRestAuthentication(authentication);
        if (message != null && isConversationAllowed(authentication, message.getOrderId(), message.getTripId(), false)) {
            message.setSenderId(authentication.getName());
            return;
        }
        if (message != null && message.getOrderId() == null && message.getTripId() == null &&
            isPrivateConversationAllowed(authentication, authentication.getName(), message.getRecipientId())) {
            message.setSenderId(authentication.getName());
            return;
        }
        throw forbiddenApi();
    }

    public void authorizeOrderAccess(Authentication authentication, Long orderId) {
        requireRestAuthentication(authentication);
        if (!isConversationAllowed(authentication, orderId, null, false)) {
            throw forbiddenApi();
        }
    }

    public void authorizeTripAccess(Authentication authentication, Long tripId) {
        requireRestAuthentication(authentication);
        if (!isConversationAllowed(authentication, null, tripId, false)) {
            throw forbiddenApi();
        }
    }

    public void authorizePrivateAccess(Authentication authentication, String userA, String userB) {
        requireRestAuthentication(authentication);
        if (isPrivateConversationAllowed(authentication, userA, userB)) {
            return;
        }
        throw forbiddenApi();
    }

    public void authorizeWebSocketDestination(Authentication authentication, String destination) {
        if (!isAuthenticated(authentication)) {
            throw new AuthenticationCredentialsNotFoundException("Missing websocket authentication");
        }
        if (destination == null || destination.isBlank()) {
            return;
        }
        Matcher orderMatcher = ORDER_TOPIC.matcher(destination);
        if (orderMatcher.matches()) {
            if (!isConversationAllowed(authentication, Long.parseLong(orderMatcher.group(1)), null, false)) {
                throw new AccessDeniedException("Chat destination is forbidden");
            }
            return;
        }
        Matcher tripMatcher = TRIP_TOPIC.matcher(destination);
        if (tripMatcher.matches()) {
            if (!isConversationAllowed(authentication, null, Long.parseLong(tripMatcher.group(1)), false)) {
                throw new AccessDeniedException("Chat destination is forbidden");
            }
            return;
        }
        Matcher privateMatcher = PRIVATE_TOPIC.matcher(destination);
        if (privateMatcher.matches() && !isPrivateConversationAllowed(authentication, privateMatcher.group(1), privateMatcher.group(2))) {
            throw new AccessDeniedException("Chat destination is forbidden");
        }
    }

    private void requireRestAuthentication(Authentication authentication) {
        if (!isAuthenticated(authentication)) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "error.auth.invalid_credentials");
        }
    }

    private boolean isConversationAllowed(Authentication authentication, Long orderId, Long tripId, boolean allowUnscoped) {
        if (!isAuthenticated(authentication)) {
            return false;
        }
        if (!customerIdentityResolver.isCustomer(authentication)) {
            Long merchant = customerIdentityResolver.resolveCustomerId(authentication).orElse(null);
            if (merchant == null) return false;
            if (orderId != null) return orderHeaderRepository.findById(orderId).filter(order -> tripId == null || tripId.equals(order.getTripId()))
                .flatMap(order -> tripRepository.findById(order.getTripId()))
                .map(t -> merchant.equals(t.getAgentId())).orElse(false);
            if (tripId != null) return tripRepository.findById(tripId).map(t -> merchant.equals(t.getAgentId())).orElse(false);
            return false;
        }
        Long customerId = customerIdentityResolver.resolveCustomerId(authentication).orElse(null);
        if (customerId == null) {
            return false;
        }
        if (orderId != null) {
            return orderHeaderRepository.findById(orderId)
                .map(order -> customerId.equals(order.getCustomerId()) && (tripId == null || tripId.equals(order.getTripId())))
                .orElse(false);
        }
        if (tripId != null) return orderHeaderRepository.existsByTripIdAndCustomerId(tripId, customerId);
        // Unscoped chat messages do not bind to a specific order/trip resource.
        // They remain allowed here only for existing REST send flows that already
        // passed authentication and do not expose customer cross-context reads.
        return allowUnscoped;
    }

    private boolean isPrivateConversationAllowed(Authentication authentication, String userA, String userB) {
        Long a = customerIdentityResolver.resolveCustomerId(userA).orElse(null);
        Long b = customerIdentityResolver.resolveCustomerId(userB).orElse(null);
        Long current = customerIdentityResolver.resolveCustomerId(authentication).orElse(null);
        if (a == null || b == null || current == null || (!current.equals(a) && !current.equals(b))) return false;
        Long customer = customerIdentityResolver.isCustomer(authentication) ? current : (current.equals(a) ? b : a);
        Long merchant = customerIdentityResolver.isCustomer(authentication) ? (current.equals(a) ? b : a) : current;
        return orderHeaderRepository.findByCustomerId(customer).stream().anyMatch(order -> tripRepository.findById(order.getTripId())
            .map(trip -> merchant.equals(trip.getAgentId())).orElse(false));
    }

    private boolean isAuthenticated(Authentication authentication) {
        return authentication != null && authentication.isAuthenticated();
    }

    private ApiException forbiddenApi() {
        return new ApiException(ErrorCode.FORBIDDEN, "error.chat.forbidden");
    }
}
