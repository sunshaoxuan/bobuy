package com.bobbuy.service;

import com.bobbuy.api.*;
import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A separate customer command. Never call the management replacement/default-payment path. */
@Service
public class CustomerOrderAmendmentService {
    private final AuthService auth;
    private final UserRepository users;
    private final OrderHeaderRepository orders;
    private final ProductRepository products;
    private final CheckoutIdentityRepository identities;
    private final CustomerOrderAmendmentReceiptRepository receipts;
    private final CustomerPaymentLedgerRepository payments;
    private final OrderWriteCoordinator writers;
    private final ProductSaleService sales;
    private final StorefrontService storefront;
    private final ProcurementHudService procurement;
    private final EntityManager entities;
    private final ObjectMapper json;
    public CustomerOrderAmendmentService(AuthService auth,UserRepository users,OrderHeaderRepository orders,
            ProductRepository products,CheckoutIdentityRepository identities,CustomerOrderAmendmentReceiptRepository receipts,
            CustomerPaymentLedgerRepository payments,OrderWriteCoordinator writers,ProductSaleService sales,
            StorefrontService storefront,ProcurementHudService procurement,EntityManager entities,ObjectMapper json) {
        this.auth=auth;this.users=users;this.orders=orders;this.products=products;this.identities=identities;
        this.receipts=receipts;this.payments=payments;this.writers=writers;this.sales=sales;this.storefront=storefront;
        this.procurement=procurement;this.entities=entities;
        this.json=json.copy().setNodeFactory(com.fasterxml.jackson.databind.node.JsonNodeFactory.withExactBigDecimals(true)).configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS,true)
                .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY,true);
    }
    @Transactional
    public CustomerOrderAmendmentView preview(Authentication authentication,Long orderId) {
        var user=customer(authentication);var order=owned(user,orderId);var trip=writers.trip(order.getTripId());
        return view(user.getId(),order,trip);
    }
    @Transactional
    public CustomerOrderAmendmentView amend(Authentication authentication,Long orderId,CustomerOrderAmendmentRequest request) {
        var user=customer(authentication);
        // Replays remain read-only after confirmation/payment, but never bypass current ownership.
        var order=owned(user,orderId);var trip=writers.trip(order.getTripId());
        String hash=CustomerOrderAmendmentFingerprint.of(user.getId(),orderId,request),key=user.getId()+":"+request.requestId();
        var prior=receipts.findById(key);
        if(prior.isPresent()) {
            var receipt=prior.get();
            if(!Objects.equals(receipt.customerId,user.getId())||!Objects.equals(receipt.orderId,orderId)||!Objects.equals(receipt.payloadHash,hash))throw conflict(orderId);
            try{return json.treeToValue(receipt.resultView,CustomerOrderAmendmentView.class);}catch(Exception e){throw new IllegalStateException("Invalid amendment receipt",e);}
        }
        var admission=admission(user.getId(),order,trip);
        if(!admission.editable())throw conflict(orderId);
        if(!admission.currentRevision().equals(request.expectedRevision()))throw conflict(orderId);
        var before=json.valueToTree(order);
        var requested=request.lines().stream().sorted(Comparator.comparing(CustomerOrderAmendmentRequest.Line::productId)).toList();
        var locked=new LinkedHashMap<String,Product>();
        for(var line:requested) {
            var product=products.lockById(line.productId()).orElseThrow(()->conflict(orderId));
            entities.refresh(product,LockModeType.PESSIMISTIC_WRITE);
            if(product.getVisibilityStatus()!=ProductVisibility.PUBLIC||!Objects.equals(product.getMerchantId(),trip.getAgentId()))throw conflict(orderId);
            locked.put(product.getId(),product);
        }
        Instant pricedAt=sales.now();BigDecimal total=BigDecimal.ZERO;var changed=new ArrayList<OrderLine>();
        var old=order.getLines().stream().collect(Collectors.toMap(OrderLine::getSkuId,l->l));
        for(var input:requested) {
            var product=locked.get(input.productId());var quote=sales.quoteAt(product,pricedAt).orElseThrow(()->conflict(orderId));
            if(!Objects.equals(quote.priceToken(),input.priceToken())||!Objects.equals(quote.currency(),input.currency())
                    ||input.priceRevision()==null||quote.revision()!=input.priceRevision()||!Objects.equals(order.getCurrency(),quote.currency()))throw conflict(orderId);
            var line=new OrderLine(product.getId(),product.getName().getOrDefault("zh-CN",product.getName().values().stream().findFirst().orElse(product.getId())),quote.unit(),input.quantity(),quote.amount().doubleValue());
            var previous=old.get(input.productId());line.setId(previous==null?identities.saveAndFlush(new CheckoutIdentity()).id:previous.getId());line.setHeaderId(order.getId());
            OrderProductSnapshot.capture(line,product);line.setCurrency(quote.currency());line.setPriceRevision(quote.revision());
            line.setQuotedAmount(quote.amount());line.setRegularAmount(quote.regularAmount());line.setPriceAdjustmentId(quote.adjustmentId());line.setPriceChannel(quote.channel());line.setPricedAt(pricedAt);
            changed.add(line);total=total.add(quote.amount().multiply(BigDecimal.valueOf(input.quantity())));
        }
        if(request.delivery()!=null) {
            var d=request.delivery();order.setDeliverySnapshot(new OrderDeliverySnapshot(1,d.contactName(),d.phone(),d.countryRegion(),d.city(),d.addressLine(),d.postalCode()));
        }
        order.setLines(changed);order.setTotalAmount(total.doubleValue());order.setStatusUpdatedAt(LocalDateTime.now());order.retainProductIdentities();
        orders.saveAndFlush(order);
        var result=view(user.getId(),order,trip);var receipt=new CustomerOrderAmendmentReceipt();receipt.id=key;receipt.customerId=user.getId();
        receipt.requestId=request.requestId();receipt.orderId=orderId;receipt.payloadHash=hash;receipt.originalOrder=before;receipt.resultView=json.valueToTree(result);receipt.createdAt=LocalDateTime.now();
        receipts.saveAndFlush(receipt);return result;
    }
    private User customer(Authentication authentication) {
        var profile=auth.currentUser(authentication);
        var user=users.lockById(profile.id()).orElseThrow(()->new ApiException(ErrorCode.UNAUTHORIZED,"error.auth.invalid_credentials"));
        entities.refresh(user,LockModeType.PESSIMISTIC_WRITE);
        if(!user.isEnabled()||!user.hasRole(Role.CUSTOMER))throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.invalid_credentials");
        return user;
    }
    private OrderHeader owned(User user,Long orderId) {
        var order=writers.existing(orderId);
        if(!Objects.equals(order.getCustomerId(),user.getId()))throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.order.not_found");
        if(order.getTripId()==null)throw new ApiException(ErrorCode.INVALID_STATUS,"error.order.invalid_status");return order;
    }
    private CustomerOrderAmendmentPolicy.Decision admission(Long customerId,OrderHeader order,Trip trip) {
        String revision=revision(order,trip);
        boolean unsupported=order.getLines()==null||order.getLines().isEmpty()||order.getLines().size()>50
                ||order.getLines().stream().anyMatch(l->l==null||l.getId()==null||l.getSkuId()==null||l.getSkuId().isBlank()||l.getQuantity()<1||l.getQuantity()>99)
                ||order.getLines().stream().map(OrderLine::getSkuId).distinct().count()!=order.getLines().size();
        if(unsupported)return new CustomerOrderAmendmentPolicy.Decision(false,CustomerOrderAmendmentPolicy.Reason.CONTACT_MERCHANT,revision);
        boolean commitment=procurement.hasOrderProcurementCommitment(order)||!payments.findByTripIdAndBusinessIdOrderByCreatedAtAscIdAsc(trip.getId(),order.getBusinessId()).isEmpty();
        var snapshot=new CustomerOrderAmendmentPolicy.Snapshot(order.getCustomerId(),revision,name(order.getStatus()),name(order.getPaymentStatus()),name(order.getDeliveryStatus()),name(trip.getStatus()),trip.getDeliveryDate(),trip.isSettlementFrozen(),order.getLines().stream().anyMatch(l->l.getPurchasedQuantity()!=0)?1:0,order.getLines().stream().anyMatch(OrderLine::isPickingConfirmed),order.getReceiptConfirmedAt()!=null||commitment,order.getBillingConfirmedAt()!=null);
        return CustomerOrderAmendmentPolicy.evaluate(customerId,snapshot,LocalDate.now());
    }
    private CustomerOrderAmendmentView view(Long customerId,OrderHeader order,Trip trip) {
        var admission=admission(customerId,order,trip);
        var eligible=storefront.publicProducts().stream().filter(p->Objects.equals(p.merchantId(),trip.getAgentId())&&Objects.equals(p.currency(),order.getCurrency())).toList();
        var metadata=products.findAllById(eligible.stream().map(StorefrontService.PublicProduct::id).toList()).stream().collect(Collectors.toMap(Product::getId,p->p));
        var options=eligible.stream().map(p->{var snapshot=new OrderLine();var product=metadata.get(p.id());if(product!=null)OrderProductSnapshot.capture(snapshot,product);
            return new CustomerOrderAmendmentView.ProductOption(p.id(),p.name(),BigDecimal.valueOf(p.price()),p.currency(),p.saleUnit(),p.priceRevision(),p.priceToken(),snapshot.getBrand(),snapshot.getItemNumber(),snapshot.getModel(),snapshot.getPackaging(),snapshot.getSpecifications());}).toList();
        var byId=options.stream().collect(Collectors.toMap(CustomerOrderAmendmentView.ProductOption::id,p->p));
        var lines=order.getLines()==null?List.<CustomerOrderAmendmentRequest.Line>of():order.getLines().stream().filter(l->l!=null&&l.getSkuId()!=null&&l.getQuantity()>0&&l.getQuantity()<=99).map(l->{var p=byId.get(l.getSkuId());return new CustomerOrderAmendmentRequest.Line(l.getSkuId(),l.getQuantity(),p==null?null:p.priceToken(),p==null?null:p.priceRevision(),p==null?null:p.currency());}).toList();
        var s=order.getDeliverySnapshot();var d=s==null?null:new CustomerOrderAmendmentRequest.Delivery(s.contactName(),s.phone(),s.countryRegion(),s.city(),s.addressLine(),s.postalCode());
        var originals=order.getLines()==null?List.<CustomerOrderAmendmentView.LineSnapshot>of():order.getLines().stream().filter(l->l!=null&&l.getSkuId()!=null).map(l->new CustomerOrderAmendmentView.LineSnapshot(l.getSkuId(),l.getNames().isEmpty()?Map.of("zh-CN",l.getItemName()==null?l.getSkuId():l.getItemName()):l.getNames(),l.getBrand(),l.getItemNumber(),l.getModel(),l.getPackaging(),l.getSpecifications(),l.getSaleUnit())).toList();
        return new CustomerOrderAmendmentView(order.getId(),admission.currentRevision(),admission.reason(),admission.editable(),lines,d,trip.getAgentId(),trip.getId(),order.getCurrency(),BigDecimal.valueOf(order.getTotalAmount()),options,originals);
    }
    private String revision(OrderHeader order,Trip trip) {
        try {
            var fields=new TreeMap<String,Object>();fields.put("order",order);fields.put("orderRevision",order.getOrderRevision());
            fields.put("tripId",trip.getId());fields.put("merchantId",trip.getAgentId());fields.put("tripStatus",trip.getStatus());fields.put("deliveryDate",trip.getDeliveryDate());
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(fields)));
        }catch(Exception e){throw new IllegalStateException("Cannot derive amendment revision",e);}
    }
    private static String name(Enum<?> value){return value==null?null:value.name();}
    private static ObjectOptimisticLockingFailureException conflict(Long orderId){return new ObjectOptimisticLockingFailureException(OrderHeader.class,orderId);}
}
