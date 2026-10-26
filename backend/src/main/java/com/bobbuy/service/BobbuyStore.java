package com.bobbuy.service;

import com.bobbuy.api.OrderPlacementRequest;
import com.bobbuy.api.ProcurementItemResponse;
import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.security.CustomerIdentityResolver;
import com.bobbuy.model.Category;
import com.bobbuy.model.MediaGalleryItem;
import com.bobbuy.model.MediaType;
import com.bobbuy.model.MerchantSku;
import com.bobbuy.model.OrderHeader;
import com.bobbuy.model.OrderLine;
import com.bobbuy.model.OrderMethod;
import com.bobbuy.model.OrderStatus;
import com.bobbuy.model.PaymentStatus;
import com.bobbuy.model.Product;
import com.bobbuy.model.ProductPatch;
import com.bobbuy.model.ProcurementReceipt;
import com.bobbuy.model.Role;
import com.bobbuy.model.StockStatus;
import com.bobbuy.model.StorageCondition;
import com.bobbuy.model.Supplier;
import com.bobbuy.model.Trip;
import com.bobbuy.model.TripStatus;
import com.bobbuy.model.User;
import com.bobbuy.repository.CategoryRepository;
import com.bobbuy.repository.CustomerPaymentLedgerRepository;
import com.bobbuy.repository.ExperienceMappingRepository;
import com.bobbuy.repository.FinancialAuditLogRepository;
import com.bobbuy.repository.MerchantSkuRepository;
import com.bobbuy.repository.OrderHeaderRepository;
import com.bobbuy.repository.PartnerWalletRepository;
import com.bobbuy.repository.ProcurementReceiptRepository;
import com.bobbuy.repository.ProductRepository;
import com.bobbuy.repository.SupplierRepository;
import com.bobbuy.repository.TripRepository;
import com.bobbuy.repository.TripExpenseRepository;
import com.bobbuy.repository.TripLogisticsTrackingRepository;
import com.bobbuy.repository.TripProfitShareConfigRepository;
import com.bobbuy.repository.UserRepository;
import com.bobbuy.repository.WalletTransactionRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
public class BobbuyStore {
    private static final Logger log = LoggerFactory.getLogger(BobbuyStore.class);
    private static final Long SYSTEM_USER_ID = 0L;

    private final UserRepository userRepository;
    private final com.bobbuy.repository.CheckoutIdentityRepository checkoutIds;
    private final TripRepository tripRepository;
    private final TripWorkflowService tripWorkflow;
    private final OrderHeaderRepository orderHeaderRepository;
    private final ProductRepository productRepository;
    private final com.bobbuy.repository.ProductPriceAdjustmentRepository priceAdjustments;
    private final CategoryRepository categoryRepository;
    private final SupplierRepository supplierRepository;
    private final MerchantSkuRepository merchantSkuRepository;
    private final TripExpenseRepository tripExpenseRepository;
    private final ProcurementReceiptRepository procurementReceiptRepository;
    private final TripLogisticsTrackingRepository tripLogisticsTrackingRepository;
    private final TripProfitShareConfigRepository tripProfitShareConfigRepository;
    private final FinancialAuditLogRepository financialAuditLogRepository;
    private final CustomerPaymentLedgerRepository customerPaymentLedgerRepository;
    private final PartnerWalletRepository partnerWalletRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final ExperienceMappingRepository experienceMappingRepository;
    private final AuditLogService auditLogService;
    private final CustomerIdentityResolver customerIdentityResolver;
    private final PasswordEncoder passwordEncoder;
    private final double unitWeight;
    private final double unitVolume;

    @Value("${bobbuy.seed.enabled:false}")
    private boolean seedEnabled;

    @Value("${bobbuy.seed.force-reset-on-invoke:false}")
    private boolean forceResetOnSeedInvoke;

    @Value("${bobbuy.seed.picking-fixture.enabled:false}")
    private boolean seedPickingFixtureEnabled;

    @Value("${bobbuy.seed.storefront-fixture.enabled:false}")
    private boolean seedStorefrontFixtureEnabled;

    public BobbuyStore(
            UserRepository userRepository,
            com.bobbuy.repository.CheckoutIdentityRepository checkoutIds,
            TripRepository tripRepository,
            TripWorkflowService tripWorkflow,
            OrderHeaderRepository orderHeaderRepository,
            ProductRepository productRepository,
            com.bobbuy.repository.ProductPriceAdjustmentRepository priceAdjustments,
            CategoryRepository categoryRepository,
            SupplierRepository supplierRepository,
            MerchantSkuRepository merchantSkuRepository,
             TripExpenseRepository tripExpenseRepository,
             ProcurementReceiptRepository procurementReceiptRepository,
             TripLogisticsTrackingRepository tripLogisticsTrackingRepository,
             TripProfitShareConfigRepository tripProfitShareConfigRepository,
             FinancialAuditLogRepository financialAuditLogRepository,
             CustomerPaymentLedgerRepository customerPaymentLedgerRepository,
             PartnerWalletRepository partnerWalletRepository,
             WalletTransactionRepository walletTransactionRepository,
              ExperienceMappingRepository experienceMappingRepository,
              AuditLogService auditLogService,
              CustomerIdentityResolver customerIdentityResolver,
              PasswordEncoder passwordEncoder,
              @Value("${bobbuy.trip.unit-weight:1.0}") double unitWeight,
             @Value("${bobbuy.trip.unit-volume:1.0}") double unitVolume) {
        this.userRepository = userRepository;
        this.checkoutIds = checkoutIds;
        this.tripRepository = tripRepository;
        this.tripWorkflow = tripWorkflow;
        this.orderHeaderRepository = orderHeaderRepository;
        this.productRepository = productRepository;
        this.priceAdjustments = priceAdjustments;
        this.categoryRepository = categoryRepository;
        this.supplierRepository = supplierRepository;
        this.merchantSkuRepository = merchantSkuRepository;
        this.tripExpenseRepository = tripExpenseRepository;
        this.procurementReceiptRepository = procurementReceiptRepository;
        this.tripLogisticsTrackingRepository = tripLogisticsTrackingRepository;
        this.tripProfitShareConfigRepository = tripProfitShareConfigRepository;
        this.financialAuditLogRepository = financialAuditLogRepository;
        this.customerPaymentLedgerRepository = customerPaymentLedgerRepository;
        this.partnerWalletRepository = partnerWalletRepository;
        this.walletTransactionRepository = walletTransactionRepository;
        this.experienceMappingRepository = experienceMappingRepository;
        this.auditLogService = auditLogService;
        this.customerIdentityResolver = customerIdentityResolver;
        this.passwordEncoder = passwordEncoder;
        this.unitWeight = unitWeight;
        this.unitVolume = unitVolume;
    }

    @Transactional
    public void seed() {
        if (forceResetOnSeedInvoke) {
            log.info("Force-resetting persisted data before reseeding.");
            clearSeedData();
        } else if (productRepository.count() > 0) {
            log.info("Database already contains data, skipping seed.");
            return;
        }
        log.warn("Seeding demo accounts with local-only credentials; ensure bobbuy.seed.enabled remains disabled in public deployments.");
        clearSeedData();
        User agent = new User(1000L, "Aiko Tan", Role.AGENT, 4.8);
        agent.setPlatformAdmin(true);
        User customer = new User(1001L, "Chen Li", Role.CUSTOMER, 4.6);
        agent.setUsername("agent");
        agent.setPasswordHash(passwordEncoder.encode("agent-pass"));
        agent.setEnabled(true);
        customer.setUsername("customer");
        customer.setPasswordHash(passwordEncoder.encode("customer-pass"));
        customer.setEnabled(true);
        agent.setPhone("+81-90-1000-0000");
        agent.setEmail("aiko@bobbuy.test");
        agent.setNote("Primary procurement coordinator");
        User.UserAddress agentAddress = new User.UserAddress();
        agentAddress.setContactName("Aiko Tan");
        agentAddress.setPhone("+81-90-1000-0000");
        agentAddress.setCountryRegion("Japan");
        agentAddress.setCity("Tokyo");
        agentAddress.setAddressLine("Shibuya 1-2-3");
        agentAddress.setPostalCode("150-0002");
        agent.setDefaultAddress(agentAddress);
        User.UserSocialAccount agentSocial = new User.UserSocialAccount();
        agentSocial.setPlatform("LINE");
        agentSocial.setHandle("@aiko-tan");
        agentSocial.setDisplayName("Aiko Tan");
        agentSocial.setVerified(false);
        agentSocial.setNote("Registration only");
        agent.setSocialAccounts(List.of(agentSocial));
        customer.setPhone("+86-138-0000-0001");
        customer.setEmail("chen.li@bobbuy.test");
        customer.setNote("Prefers pickup at station");
        User.UserAddress customerAddress = new User.UserAddress();
        customerAddress.setContactName("Chen Li");
        customerAddress.setPhone("+86-138-0000-0001");
        customerAddress.setCountryRegion("China");
        customerAddress.setCity("Shanghai");
        customerAddress.setAddressLine("Pudong Century Ave 88");
        customerAddress.setPostalCode("200120");
        customerAddress.setLatitude(31.2304);
        customerAddress.setLongitude(121.4737);
        customer.setDefaultAddress(customerAddress);
        User.UserSocialAccount customerSocial = new User.UserSocialAccount();
        customerSocial.setPlatform("WeChat");
        customerSocial.setHandle("chen-li-1001");
        customerSocial.setDisplayName("Chen Li");
        customerSocial.setVerified(false);
        customerSocial.setNote("Registration only");
        customer.setSocialAccounts(List.of(customerSocial));
        userRepository.save(agent);
        userRepository.save(customer);

        Trip trip = new Trip(2000L, agent.getId(), "Shanghai", LocalDate.now().plusDays(5), TripStatus.PUBLISHED, LocalDateTime.now());
        tripRepository.save(trip);

        OrderHeader header = new OrderHeader("20260117001", customer.getId(), trip.getId());
        header.setId(3000L);
        OrderLine line = new OrderLine("SKU001", "Matcha Kit", null, 2, 32.5);
        header.addLine(line);
        header.setTotalAmount(65.0);
        orderHeaderRepository.save(header);

        if (seedPickingFixtureEnabled) {
            OrderHeader pickingHeader = new OrderHeader("20260117002", customer.getId(), trip.getId());
            pickingHeader.setId(3001L);
            pickingHeader.setStatus(OrderStatus.CONFIRMED);
            OrderLine pickingLine = new OrderLine("SKU001", "Matcha Kit", null, 2, 32.5);
            pickingHeader.addLine(pickingLine);
            pickingHeader.setTotalAmount(65.0);
            orderHeaderRepository.save(pickingHeader);

            Map<String, Object> reviewedReceiptResult = new LinkedHashMap<>();
            reviewedReceiptResult.put("reviewStatus", "REVIEWED");
            reviewedReceiptResult.put("recognitionMode", "SEED");
            reviewedReceiptResult.put("receiptItems", List.of(Map.of(
                    "name", "Matcha Kit",
                    "quantity", 2,
                    "unitPrice", 32.5
            )));
            reviewedReceiptResult.put("matchedOrderLines", List.of(Map.of(
                    "businessId", pickingHeader.getBusinessId(),
                    "skuId", "SKU001",
                    "itemName", "Matcha Kit",
                    "matchedQuantity", 2,
                    "disposition", "MATCHED"
            )));
            reviewedReceiptResult.put("unmatchedReceiptItems", List.of());
            reviewedReceiptResult.put("missingOrderedItems", List.of());
            reviewedReceiptResult.put("selfUseItems", List.of());
            ProcurementReceipt reviewedReceipt = new ProcurementReceipt(
                    trip.getId(),
                    "seed-reviewed-receipt.jpg",
                    "seed/receipt/original.jpg",
                    "https://cdn.bobbuy.example/receipts/seed-reviewed-receipt.jpg",
                    "seed/receipt/thumb.jpg",
                    "https://cdn.bobbuy.example/receipts/seed-reviewed-receipt-thumb.jpg",
                    "RECONCILED",
                    LocalDateTime.now(),
                    LocalDateTime.now(),
                    "",
                    reviewedReceiptResult);
            reviewedReceipt.setManualReconciliationResult(new LinkedHashMap<>(reviewedReceiptResult));
            procurementReceiptRepository.save(reviewedReceipt);
        }

        Category foodCategory = new Category(
                "cat-1000",
                new LinkedHashMap<>(Map.of("zh-CN", "食品", "ja-JP", "食品", "en-US", "Food")),
                new LinkedHashMap<>(Map.of("zh-CN", "食品类商品", "ja-JP", "食品カテゴリ", "en-US", "Food products")),
                List.of(
                        categoryTemplateField("shelfLifeDays", "stock.dynamic.shelf_life_days", "number"),
                        categoryTemplateField("storageTemp", "stock.dynamic.storage_temp", "text"),
                        categoryTemplateField("flavor", "stock.dynamic.flavor", "text")));
        categoryRepository.save(foodCategory);

        Category clothingCategory = new Category(
                "cat-1001",
                new LinkedHashMap<>(Map.of("zh-CN", "服装", "ja-JP", "衣料品", "en-US", "Clothing")),
                new LinkedHashMap<>(Map.of("zh-CN", "服装类商品", "ja-JP", "衣料品カテゴリ", "en-US", "Clothing products")),
                List.of(
                        categoryTemplateFieldWithOptions("size", "stock.dynamic.size", List.of("XS", "S", "M", "L", "XL")),
                        categoryTemplateField("material", "stock.dynamic.material", "text"),
                        categoryTemplateField("color", "stock.dynamic.color", "text")));
        categoryRepository.save(clothingCategory);

        Supplier supplier = new Supplier(
                "sup-1000",
                new LinkedHashMap<>(Map.of("zh-CN", "东京供货商", "ja-JP", "東京サプライヤー", "en-US", "Tokyo Supplier")),
                new LinkedHashMap<>(Map.of("zh-CN", "稳定供应抹茶", "ja-JP", "抹茶を安定供給", "en-US", "Stable matcha supplier")),
                "tokyo-supplier@bobbuy.com");
        supplier.setMerchantId(agent.getId());
        supplierRepository.save(supplier);

        Product product = new Product(
                "prd-1000",
                new LinkedHashMap<>(Map.of("zh-CN", "抹茶套装", "ja-JP", "抹茶セット", "en-US", "Matcha Kit")),
                new LinkedHashMap<>(Map.of("zh-CN", "京都风味抹茶组合", "ja-JP", "京都風味の抹茶セット", "en-US", "Kyoto-style matcha set")),
                "BOBBuy Select",
                32.5,
                0.5,
                0.2,
                List.of(new MediaGalleryItem(
                        "https://cdn.bobbuy.example/products/matcha-kit.png",
                        MediaType.IMAGE,
                        new LinkedHashMap<>(Map.of("zh-CN", "商品主图", "ja-JP", "商品メイン画像", "en-US", "Main image")))),
                StorageCondition.AMBIENT,
                OrderMethod.DIRECT_BUY,
                foodCategory.getId(),
                new LinkedHashMap<>(Map.of(supplier.getId(), "TOKYO-MATCHA-001")));
        product.setMerchantId(agent.getId());
        product.setRecommended(true);
        product.setTemporary(false);
        product.setAttributes(new LinkedHashMap<>(Map.of(
                "netContent", "500g",
                "packSize", "1pack",
                "flavor", "matcha"
        )));
        productRepository.save(product);

        Product existingSampleProduct = new Product(
                "prd-1638",
                new LinkedHashMap<>(Map.of("zh-CN", "Costco 抹茶点心", "ja-JP", "クラシリク抹茶", "en-US", "Costco Matcha Snack")),
                new LinkedHashMap<>(Map.of("zh-CN", "AI 上架既有商品命中样例", "ja-JP", "AIオンボーディング既存商品サンプル", "en-US", "Existing product sample for AI onboarding")),
                "コストコホールセールジャパン",
                798.0,
                0.8,
                0.3,
                List.of(new MediaGalleryItem(
                        "https://images.costco-static.com/ImageDelivery/imageService?profileId=12026540&imageId=59363__1&recipeName=680",
                        MediaType.IMAGE,
                        new LinkedHashMap<>(Map.of("zh-CN", "既有商品图", "ja-JP", "既存商品画像", "en-US", "Existing product image")))),
                StorageCondition.AMBIENT,
                OrderMethod.DIRECT_BUY,
                foodCategory.getId(),
                new LinkedHashMap<>(Map.of(supplier.getId(), "COSTCO-MATCHA-59363")));
        existingSampleProduct.setMerchantId(agent.getId());
        existingSampleProduct.setItemNumber("59363");
        existingSampleProduct.setRecommended(false);
        existingSampleProduct.setTemporary(false);
        existingSampleProduct.setAttributes(new LinkedHashMap<>(Map.of(
                "storageHint", "直射日光・高温多湿を避けて保存",
                "packSize", "1pack",
                "flavor", "抹茶"
        )));
        productRepository.save(existingSampleProduct);
        if (seedStorefrontFixtureEnabled) {
            product.setVisibilityStatus(com.bobbuy.model.ProductVisibility.DRAFTER_ONLY);
            productRepository.save(product);
            existingSampleProduct.setMediaGallery(List.of(new MediaGalleryItem("/assets/products/matcha-muffins.jpg", MediaType.IMAGE, Map.of())));
            existingSampleProduct.setName(Map.of("zh-CN", "抹茶玛芬 · 6 个装"));
            existingSampleProduct.setDescription(Map.of("zh-CN", "抹茶风味烘焙点心，分享装"));
            productRepository.save(existingSampleProduct);
            String[][] fixtures = {
                {"strawberries", "鲜采草莓 · 400g", "鲜果", "1280", "当季鲜果，独立盒装"},
                {"milk", "全脂鲜牛奶 · 1L", "乳品", "328", "冷藏鲜奶，醇厚奶香"},
                {"croissants", "黄油可颂 · 6 个装", "烘焙", "698", "层层酥香，早餐分享装"},
                {"spinach", "新鲜菠菜 · 300g", "蔬菜", "298", "新鲜绿叶菜，日常餐桌之选"},
                {"paper_towels", "厨房纸巾 · 家庭装", "日用", "1498", "厨房清洁，多卷家庭装"},
                {"chicken", "鲜鸡胸肉 · 1kg", "鲜食", "980", "冷藏鲜肉，分装更方便"}
            };
            for (String[] fixture : fixtures) {
                Product sample = new Product("demo-" + fixture[0], Map.of("zh-CN",fixture[1]), Map.of("zh-CN",fixture[4]),
                    "Bobuy Select · " + fixture[2], Double.parseDouble(fixture[3]), 1.0, 1.0,
                    List.of(new MediaGalleryItem("/assets/products/" + fixture[0] + ".png",MediaType.IMAGE,Map.of())),
                    StorageCondition.AMBIENT, OrderMethod.DIRECT_BUY, foodCategory.getId(), Map.of());
                sample.setMerchantId(agent.getId()); productRepository.save(sample);
            }
        }

        MerchantSku merchantSku = new MerchantSku(
                "msku-1000",
                product.getId(),
                supplier.getId(),
                "TOKYO-MATCHA-001",
                30.0,
                StockStatus.IN_STOCK);
        merchantSkuRepository.save(merchantSku);

        MerchantSku muffinSku = new MerchantSku(
                "msku-1638",
                existingSampleProduct.getId(),
                supplier.getId(),
                "COSTCO-MATCHA-59363",
                798.0,
                StockStatus.IN_STOCK);
        merchantSkuRepository.save(muffinSku);
    }

    private void clearSeedData() {
        walletTransactionRepository.deleteAll();
        partnerWalletRepository.deleteAll();
        customerPaymentLedgerRepository.deleteAll();
        experienceMappingRepository.deleteAll();
        merchantSkuRepository.deleteAll();
        productRepository.deleteAll();
        supplierRepository.deleteAll();
        categoryRepository.deleteAll();
        financialAuditLogRepository.deleteAll();
        tripLogisticsTrackingRepository.deleteAll();
        tripProfitShareConfigRepository.deleteAll();
        tripExpenseRepository.deleteAll();
        procurementReceiptRepository.deleteAll();
        orderHeaderRepository.deleteAll();
        tripRepository.deleteAll();
        userRepository.deleteAll();
    }

    @PostConstruct
    @Transactional
    public void initializeSeedIfEnabled() {
        if (seedEnabled) {
            seed();
        }
    }

    public List<User> listUsers() {
        Long merchant = com.bobbuy.security.MerchantScope.current();
        if (merchant == null) return userRepository.findAll();
        java.util.Set<Long> customers = listOrders().stream().map(OrderHeader::getCustomerId).collect(java.util.stream.Collectors.toSet());
        return userRepository.findAll().stream().filter(u -> merchant.equals(u.getId()) || customers.contains(u.getId())).toList();
    }

    public Optional<User> getUser(Long id) {
        return listUsers().stream().filter(u -> id.equals(u.getId())).findFirst();
    }

    @Transactional
    public User createUser(User user) {
        user.setId(nextUserId());
        return userRepository.save(user);
    }

    @Transactional
    public Optional<User> updateUser(Long id, User user) {
        if (!userRepository.existsById(id)) {
            return Optional.empty();
        }
        user.setId(id);
        return Optional.of(userRepository.save(user));
    }

    @Transactional
    public boolean deleteUser(Long id) {
        if (!userRepository.existsById(id)) {
            return false;
        }
        userRepository.deleteById(id);
        return true;
    }

    public List<Trip> listTrips() {
        return tripRepository.findAll().stream()
                .filter(t -> com.bobbuy.security.MerchantScope.visible(t.getAgentId()))
                .filter(t -> isTripVisibleToCustomer(t.getId()))
                .peek(this::refreshTripDynamicLoad)
                .toList();
    }

    public Optional<Trip> getTrip(Long id) {
        return tripRepository.findById(id)
                .filter(t -> com.bobbuy.security.MerchantScope.visible(t.getAgentId()))
                .filter(t -> isTripVisibleToCustomer(t.getId()))
                .map(trip -> {
                    refreshTripDynamicLoad(trip);
                    return trip;
                });
    }

    @Transactional
    public Trip createTrip(Trip trip) {
        Long owner = com.bobbuy.security.MerchantScope.current();
        if (owner != null) trip.setAgentId(owner);
        if (trip.getAgentId() == null) throw new ApiException(ErrorCode.FORBIDDEN, "商家身份无效");
        trip.setId(nextTripId());
        trip.setDeliveryArea(trip.getDeliveryArea().trim());
        trip.setStatus(TripStatus.PUBLISHED);
        trip.setStatusUpdatedAt(LocalDateTime.now());
        return tripRepository.save(trip);
    }

    @Transactional
    public Optional<Trip> updateTrip(Long id, Trip input) {
        return tripRepository.findByIdForUpdate(id)
                .filter(trip -> com.bobbuy.security.MerchantScope.visible(trip.getAgentId()))
                .filter(trip -> isTripVisibleToCustomer(trip.getId()))
                .map(trip -> {
            if (trip.isSettlementFrozen()) throw new ApiException(ErrorCode.INVALID_REQUEST, "error.trip.settlement_frozen");
            trip.setDeliveryArea(input.getDeliveryArea().trim());
            trip.setDeliveryDate(input.getDeliveryDate());
            return tripRepository.save(trip);
        });
    }

    @Transactional
    public boolean deleteTrip(Long id) {
        if (getTrip(id).isEmpty()) return false;
        if (!tripRepository.existsById(id)) {
            return false;
        }
        tripRepository.deleteById(id);
        return true;
    }

    public List<Product> listProducts() {
        return productRepository.findAll().stream()
                .filter(p -> com.bobbuy.security.MerchantScope.visible(p.getMerchantId()))
                .sorted(Comparator
                        .comparing(Product::isRecommended).reversed()
                        .thenComparing(Product::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Product::getId, Comparator.nullsLast(String::compareTo)))
                .toList();
    }

    public Optional<Product> getProduct(String id) {
        return productRepository.findById(id).filter(p -> com.bobbuy.security.MerchantScope.visible(p.getMerchantId()));
    }

    public Optional<Product> findProductByItemNumber(String itemNumber) {
        if (itemNumber == null || itemNumber.isBlank()) {
            return Optional.empty();
        }
        return productRepository.findByItemNumber(itemNumber.trim()).filter(p -> com.bobbuy.security.MerchantScope.visible(p.getMerchantId()));
    }

    @Transactional
    public Product createProduct(Product product) {
        if (com.bobbuy.security.MerchantScope.current() != null) product.setMerchantId(com.bobbuy.security.MerchantScope.current());
        if (product.getId() == null || product.getId().isBlank()) {
            product.setId(UUID.randomUUID().toString());
        }
        ensureLocalizedFields(product);
        return productRepository.save(product);
    }

    @Transactional
    public Optional<Product> updateProduct(String id, Product product) {
        if (getProduct(id).isEmpty()) return Optional.empty();
        var previous=getProduct(id).orElseThrow();
        product.setMerchantId(previous.getMerchantId());
        product.setSale(previous.getSale());
        product.setRecordVersion(previous.getRecordVersion());
        product.setCurrency(previous.getCurrency());
        product.setCatalogData(previous.getCatalogData());
        // Legacy inventory editing cannot replace version-reviewed master data.
        if(previous.getCatalogData()!=null){product.setName(previous.getName());product.setDescription(previous.getDescription());product.setBrand(previous.getBrand());product.setItemNumber(previous.getItemNumber());product.setMediaGallery(previous.getMediaGallery());product.setCategoryId(previous.getCategoryId());}
        if (!productRepository.existsById(id)) {
            return Optional.empty();
        }
        product.setId(id);
        if(product.getCatalogData()==null)ensureLocalizedFields(product);
        return Optional.of(productRepository.save(product));
    }

    @Transactional
    public Optional<Product> patchProduct(String id, ProductPatch patch) {
        Optional<Product> existingOptional = getProduct(id);
        if (existingOptional.isEmpty()) {
            return Optional.empty();
        }
        Product existing = existingOptional.orElseThrow();
        if (patch == null) {
            return Optional.of(existing);
        }
        if(existing.getCatalogData()!=null&&(patch.getName()!=null||patch.getDescription()!=null||patch.getBrand()!=null||patch.getMediaGallery()!=null||patch.getCategoryId()!=null||patch.getItemNumber()!=null))throw new com.bobbuy.api.response.ApiException(com.bobbuy.api.response.ErrorCode.INVALID_REQUEST,"master.use_profile");
        if (patch.getName() != null) {
            mergeLocalizedMap(existing, true, patch.getName());
        }
        if (patch.getDescription() != null) {
            mergeLocalizedMap(existing, false, patch.getDescription());
        }
        if (patch.getBrand() != null) {
            existing.setBrand(patch.getBrand());
        }
        if (patch.getBasePrice() != null) {
            existing.setBasePrice(patch.getBasePrice());
        }
        if (patch.getWeight() != null) {
            existing.setWeight(patch.getWeight());
        }
        if (patch.getVolume() != null) {
            existing.setVolume(patch.getVolume());
        }
        if (patch.getMediaGallery() != null) {
            existing.setMediaGallery(patch.getMediaGallery());
        }
        if (patch.getStorageCondition() != null) {
            existing.setStorageCondition(patch.getStorageCondition());
        }
        if (patch.getOrderMethod() != null) {
            existing.setOrderMethod(patch.getOrderMethod());
        }
        if (patch.getIsRecommended() != null) {
            existing.setRecommended(patch.getIsRecommended());
        }
        if (patch.getIsTemporary() != null) {
            existing.setTemporary(patch.getIsTemporary());
        }
        if (patch.getVisibilityStatus() != null) {
            existing.setVisibilityStatus(patch.getVisibilityStatus());
        }
        if (patch.getCategoryId() != null) {
            existing.setCategoryId(patch.getCategoryId());
        }
        if (patch.getItemNumber() != null) {
            existing.setItemNumber(patch.getItemNumber());
        }
        if (patch.getMerchantSkus() != null) {
            existing.setMerchantSkus(patch.getMerchantSkus());
        }
        if (patch.getAttributes() != null) {
            existing.setAttributes(patch.getAttributes());
        }
        if (patch.getPriceTiers() != null) {
            existing.setPriceTiers(patch.getPriceTiers());
        }
        if (patch.getIsRecommended() != null) {
            existing.setRecommended(patch.getIsRecommended());
        }
        if (patch.getIsTemporary() != null) {
            existing.setTemporary(patch.getIsTemporary());
        }
        return Optional.of(productRepository.save(existing));
    }

    @Transactional
    public boolean deleteProduct(String id) {
        if (getProduct(id).isEmpty()) return false;
        if(priceAdjustments.existsByProductId(id))throw new ApiException(ErrorCode.INVALID_REQUEST,"pricing.retain_history");
        if (!productRepository.existsById(id)) {
            return false;
        }
        merchantSkuRepository.deleteByProductId(id);
        productRepository.deleteById(id);
        return true;
    }

    public List<Category> listCategories() {
        Long owner=com.bobbuy.security.MerchantScope.current();
        return categoryRepository.findAll().stream().filter(c->c.getMerchantId()==null||c.getMerchantId().equals(owner)).toList();
    }

    public Optional<Category> getCategory(String id) {
        Long owner=com.bobbuy.security.MerchantScope.current();
        return categoryRepository.findById(id).filter(c->c.getMerchantId()==null||c.getMerchantId().equals(owner));
    }

    public List<Supplier> listSuppliers() {
        return supplierRepository.findAll().stream().filter(s -> com.bobbuy.security.MerchantScope.visible(s.getMerchantId())).toList();
    }

    public Optional<Supplier> getSupplier(String id) {
        return supplierRepository.findById(id).filter(s -> com.bobbuy.security.MerchantScope.visible(s.getMerchantId()));
    }

    @Transactional
    public Supplier saveSupplier(Supplier supplier) {
        if(com.bobbuy.security.MerchantScope.current()!=null && supplierRepository.existsById(supplier.getId()))
            throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.classification");
        if (com.bobbuy.security.MerchantScope.current() != null) supplier.setMerchantId(com.bobbuy.security.MerchantScope.current());
        return supplierRepository.save(supplier);
    }

    @Transactional
    public Optional<Supplier> updateSupplier(String id, Supplier supplier) {
        return getSupplier(id).map(existing -> {
            existing.setName(supplier.getName());
            existing.setDescription(supplier.getDescription());
            existing.setContactInfo(supplier.getContactInfo());
            existing.setOnboardingRules(supplier.getOnboardingRules());
            return supplierRepository.save(existing);
        });
    }

    public List<MerchantSku> listMerchantSkus() {
        return merchantSkuRepository.findAll().stream().filter(s -> getProduct(s.getProductId()).isPresent()).toList();
    }

    public Optional<MerchantSku> getMerchantSku(String id) {
        return merchantSkuRepository.findById(id).filter(s -> getProduct(s.getProductId()).isPresent());
    }

    public List<OrderHeader> listOrders() {
        return listOrders(null);
    }

    public List<OrderHeader> listOrders(Long tripId) {
        return listOrders(tripId, null);
    }

    public List<OrderHeader> listOrders(Long tripId, Authentication authentication) {
        List<OrderHeader> orders;
        if (tripId == null) {
            orders = orderHeaderRepository.findAll();
        } else {
            orders = orderHeaderRepository.findByTripId(tripId);
        }
        return orders.stream()
                .filter(order -> isOrderVisibleToAuthentication(order, authentication))
                .collect(Collectors.toList());
    }

    public Optional<OrderHeader> getOrder(Long id) {
        return orderHeaderRepository.findById(id).filter(o -> isOrderVisibleToAuthentication(o, null));
    }

    public Optional<OrderHeader> getOrder(Long id, Authentication authentication) {
        return orderHeaderRepository.findById(id)
                .filter(order -> isOrderVisibleToAuthentication(order, authentication));
    }

    public Optional<OrderHeader> getOrderByBusinessId(String businessId) {
        return orderHeaderRepository.findByBusinessId(businessId);
    }

    @Transactional
    public OrderHeader upsertOrder(OrderHeader headerInput) {
        if (com.bobbuy.security.MerchantScope.current() != null) {
            requireOwnedTrip(headerInput.getTripId());
            orderHeaderRepository.findByBusinessId(headerInput.getBusinessId()).ifPresent(o -> requireOwnedTrip(o.getTripId()));
        }
        if (headerInput.getPaymentStatus() == null) {
            headerInput.setPaymentStatus(PaymentStatus.UNPAID);
        }
        if (headerInput.getCreatedAt() == null) {
            headerInput.setCreatedAt(LocalDateTime.now());
        }
        if (headerInput.getLines() == null) {
            headerInput.setLines(new ArrayList<>());
        }
        normalizeLinePurchasedQuantities(headerInput.getLines());
        ensureOrderLinesMutable(headerInput.getTripId());
        Optional<OrderHeader> existingOptional = orderHeaderRepository.findByBusinessIdForUpdate(headerInput.getBusinessId());

        if (existingOptional.isEmpty()) {
            ensureOrderLinesMutable(headerInput.getTripId());
            headerInput.setId(nextOrderIdentity());
            headerInput.setStatusUpdatedAt(LocalDateTime.now());
            for (OrderLine line : headerInput.getLines()) {
                line.setId(nextOrderIdentity());
                line.setHeaderId(headerInput.getId());
            }
            recalculateTotal(headerInput);
            return saveOrderAndRefresh(headerInput);
        }

        OrderHeader existing = existingOptional.orElseThrow();
        ensureOrderLinesMutable(existing.getTripId());
        if (existing.getLines() == null) {
            existing.setLines(new ArrayList<>());
        }
        for (OrderLine newLine : headerInput.getLines()) {
            Optional<OrderLine> match = existing.getLines().stream()
                    .filter(l -> l.canMergeWith(newLine))
                    .findFirst();

            if (match.isPresent()) {
                OrderLine existingLine = match.get();
                existingLine.setQuantity(existingLine.getQuantity() + newLine.getQuantity());
                existingLine.setPurchasedQuantity(existingLine.getPurchasedQuantity() + newLine.getPurchasedQuantity());
            } else {
                newLine.setId(nextOrderIdentity());
                existing.addLine(newLine);
            }
        }
        existing.setStatusUpdatedAt(LocalDateTime.now());
        recalculateTotal(existing);
        return saveOrderAndRefresh(existing);
    }

    @Transactional
    public OrderHeader quickOrder(Long tripId, OrderPlacementRequest request) {
        Trip trip = tripRepository.findById(tripId)
            .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.trip.not_found"));
        ensureOrderLinesMutable(trip.getId());
        Product product = productRepository.findById(request.getSkuId())
            .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.product.not_found"));
        com.bobbuy.security.MerchantScope.require(trip.getAgentId());
        com.bobbuy.security.MerchantScope.require(product.getMerchantId());

        Optional<OrderHeader> existing = orderHeaderRepository.findByBusinessIdAndTripIdForUpdate(request.getBusinessId(), tripId);

        String itemName = product.getName().getOrDefault("zh-CN", 
            product.getName().isEmpty() ? "Unknown Item" : product.getName().values().iterator().next());

        OrderLine newLine = new OrderLine(
            product.getId(),
            itemName,
            null,
            request.getQuantity(),
            product.getBasePrice()
        );

        if (existing.isPresent()) {
            OrderHeader header = existing.get();
            header.addLine(newLine); // addLine handles IDs and merging
            recalculateTotal(header);
            return saveOrderAndRefresh(header);
        } else {
            OrderHeader newHeader = new OrderHeader(request.getBusinessId(), null, tripId);
            newHeader.setTripId(tripId);
            newHeader.setStatus(OrderStatus.NEW);
            newHeader.setPaymentStatus(PaymentStatus.UNPAID);
            newHeader.addLine(newLine);
            newHeader.setId(nextOrderIdentity());
            newHeader.setCreatedAt(LocalDateTime.now());
            newHeader.setStatusUpdatedAt(LocalDateTime.now());
            recalculateTotal(newHeader);
            return saveOrderAndRefresh(newHeader);
        }
    }

    private void recalculateTotal(OrderHeader header) {
        double total = header.getLines().stream()
                .mapToDouble(l -> l.getUnitPrice() * l.getQuantity())
                .sum();
        header.setTotalAmount(total);
    }

    @Transactional
    public Optional<OrderHeader> updateOrder(Long id, OrderHeader order) {
        Optional<OrderHeader> existingOptional = getOrder(id);
        if (existingOptional.isEmpty()) {
            return Optional.empty();
        }
        OrderHeader existing = existingOptional.orElseThrow();
        Long previousTripId = existing.getTripId();
        getTrip(order.getTripId()).orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN, "无权操作此行程"));
        ensureOrderLinesMutable(existing.getTripId());
        ensureOrderLinesMutable(order.getTripId());
        if (order.getPaymentStatus() == null) {
            order.setPaymentStatus(PaymentStatus.UNPAID);
        }
        if (order.getCreatedAt() == null) {
            order.setCreatedAt(existing.getCreatedAt() != null ? existing.getCreatedAt() : LocalDateTime.now());
        }
        if (order.getLines() == null) {
            order.setLines(new ArrayList<>());
        }
        normalizeLinePurchasedQuantities(order.getLines());
        order.setId(id);
        for (OrderLine line : order.getLines()) {
            if (line.getId() == null) {
                line.setId(nextOrderIdentity());
            }
            line.setHeaderId(id);
        }
        order.setStatusUpdatedAt(LocalDateTime.now());
        OrderHeader saved = saveOrderAndRefresh(order);
        if (!java.util.Objects.equals(previousTripId, order.getTripId())) tripWorkflow.refresh(previousTripId);
        return Optional.of(saved);
    }

    @Transactional
    public OrderHeader updateOrderStatus(Long id, OrderStatus nextStatus) {
        OrderHeader order = getOrder(id)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.order.not_found"));
        return applyOrderStatusTransition(order, nextStatus);
    }

    @Transactional
    public boolean deleteOrder(Long id) {
        Optional<OrderHeader> removed = getOrder(id);
        if (removed.isEmpty()) {
            return false;
        }
        ensureOrderLinesMutable(removed.orElseThrow().getTripId());
        orderHeaderRepository.deleteById(id);
        tripWorkflow.refresh(removed.orElseThrow().getTripId());
        return true;
    }

    @Transactional
    public List<OrderHeader> bulkUpdateOrderStatus(Long tripId, OrderStatus targetStatus) {
        getTrip(tripId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.trip.not_found"));
        List<OrderHeader> eligible = listOrders(tripId).stream()
                .filter(order -> isValidStatusTransition(order.getStatus(), targetStatus))
                .collect(Collectors.toList());
        if (eligible.isEmpty()) {
            return new ArrayList<>();
        }
        List<OrderHeader> updated = new ArrayList<>();
        for (OrderHeader order : eligible) {
            updated.add(applyOrderStatusTransition(order, targetStatus));
        }
        return updated;
    }

    public List<ProcurementItemResponse> getProcurementList(Long tripId) {
        getTrip(tripId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.trip.not_found"));
        Map<String, ProcurementItemResponse> aggregated = new ConcurrentHashMap<>();
        listOrders(tripId).forEach(order -> order.getLines().forEach(line -> {
            String key = line.getSkuId() + "||" + line.getItemName();
            aggregated.compute(key, (_key, existing) -> {
                if (existing == null) {
                    return new ProcurementItemResponse(
                            line.getSkuId(),
                            line.getItemName(),
                            line.getQuantity(),
                            line.getPurchasedQuantity(),
                            line.getUnitPrice(),
                            List.of(order.getBusinessId()));
                }
                existing.addQuantity(line.getQuantity());
                existing.addPurchasedQuantity(line.getPurchasedQuantity());
                existing.addBusinessId(order.getBusinessId());
                return existing;
            });
        }));
        return aggregated.values().stream()
                .sorted(Comparator.comparing(ProcurementItemResponse::getItemName)
                        .thenComparing(ProcurementItemResponse::getSkuId))
                .toList();
    }

    public double calculateGmv() {
        return listOrders().stream().mapToDouble(OrderHeader::getTotalAmount).sum();
    }

    public Map<OrderStatus, Integer> orderStatusCounts() {
        Map<OrderStatus, Integer> counts = new EnumMap<>(OrderStatus.class);
        listOrders().forEach(order -> counts.merge(order.getStatus(), 1, Integer::sum));
        return counts;
    }

    private boolean isValidStatusTransition(OrderStatus current, OrderStatus next) {
        return switch (current) {
            case NEW -> next == OrderStatus.CONFIRMED || next == OrderStatus.CANCELLED;
            case CONFIRMED -> next == OrderStatus.PURCHASED || next == OrderStatus.CANCELLED;
            case PURCHASED -> next == OrderStatus.DELIVERED;
            case DELIVERED -> next == OrderStatus.SETTLED;
            case SETTLED, CANCELLED -> false;
        };
    }

    private OrderHeader applyOrderStatusTransition(OrderHeader order, OrderStatus nextStatus) {
        if (!isValidStatusTransition(order.getStatus(), nextStatus)) {
            throw new ApiException(ErrorCode.INVALID_STATUS, "error.order.invalid_status");
        }
        if (order.getTripId() != null) {
            Trip trip = tripRepository.findByIdForUpdate(order.getTripId()).orElseThrow();
            if (trip.isSettlementFrozen() && nextStatus != OrderStatus.SETTLED) {
                throw new ApiException(ErrorCode.INVALID_REQUEST, "error.trip.settlement_frozen");
            }
        }
        String previousStatus = order.getStatus().name();
        order.setStatus(nextStatus);
        if (nextStatus == OrderStatus.DELIVERED) order.setDeliveryStatus(com.bobbuy.model.DeliveryStatus.DELIVERED);
        order.setStatusUpdatedAt(LocalDateTime.now());
        OrderHeader saved = saveOrderAndRefresh(order);
        auditLogService.logStatusChange("ORDER", order.getId(), previousStatus, nextStatus.name(), SYSTEM_USER_ID);
        return saved;
    }

    private OrderHeader saveOrderAndRefresh(OrderHeader order) {
        OrderHeader saved = orderHeaderRepository.saveAndFlush(order);
        tripWorkflow.refresh(order.getTripId());
        return saved;
    }

    private void ensureOrderLinesMutable(Long tripId) {
        if (tripId == null) {
            return;
        }
        Optional<Trip> tripOptional = tripRepository.findByIdForUpdate(tripId);
        if (tripOptional.isEmpty()) {
            return;
        }
        Trip trip = tripOptional.orElseThrow();
        if (trip.isSettlementFrozen()) {
            throw new ApiException(ErrorCode.INVALID_REQUEST, "error.trip.settlement_frozen");
        }
    }

    private int calculateTotalQuantity(OrderHeader header) {
        if (header == null || header.getLines() == null) {
            return 0;
        }
        return header.getLines().stream()
                .mapToInt(OrderLine::getQuantity)
                .sum();
    }

    private void normalizeLinePurchasedQuantities(List<OrderLine> lines) {
        if (lines == null) {
            return;
        }
        for (OrderLine line : lines) {
            int cappedPurchased = Math.min(Math.max(line.getPurchasedQuantity(), 0), Math.max(line.getQuantity(), 0));
            line.setPurchasedQuantity(cappedPurchased);
        }
    }

    private boolean isTripVisibleToCustomer(Long tripId) {
        Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (!customerIdentityResolver.isCustomer(authentication)) return true;
        return customerIdentityResolver.resolveCustomerId(authentication)
                .map(id -> orderHeaderRepository.findByCustomerId(id).stream().anyMatch(o -> tripId.equals(o.getTripId())))
                .orElse(false);
    }

    private boolean isOrderVisibleToAuthentication(OrderHeader order, Authentication authentication) {
        if (authentication == null) authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        Long merchant = com.bobbuy.security.MerchantScope.current();
        if (merchant != null) return tripRepository.findById(order.getTripId()).map(t -> merchant.equals(t.getAgentId())).orElse(false);
        if (!customerIdentityResolver.isCustomer(authentication)) {
            return true;
        }
        return customerIdentityResolver.resolveCustomerId(authentication)
                .map(customerId -> customerId.equals(order.getCustomerId()))
                .orElse(false);
    }

    private void refreshTripDynamicLoad(Trip trip) {
        if (trip == null || trip.getId() == null) {
            return;
        }
        int purchasedQuantity = orderHeaderRepository.findByTripId(trip.getId()).stream()
                .sorted(Comparator.comparing(OrderHeader::getId))
                .mapToInt(order -> order.getLines().stream()
                        .mapToInt(line -> {
                            if (line.getPurchasedQuantity() > 0) {
                                return line.getPurchasedQuantity();
                            }
                            return order.getStatus() == OrderStatus.PURCHASED || order.getStatus() == OrderStatus.DELIVERED || order.getStatus() == OrderStatus.SETTLED ? line.getQuantity() : 0;
                        })
                        .sum())
                .sum();
        trip.recalculateCurrentLoad(purchasedQuantity, unitWeight, unitVolume);
    }

    private void ensureLocalizedFields(Product product) {
        if (product.getName() == null) {
            product.setName(new HashMap<>());
        } else {
            product.setName(new HashMap<>(product.getName()));
        }
        if (product.getDescription() == null) {
            product.setDescription(new HashMap<>());
        } else {
            product.setDescription(new HashMap<>(product.getDescription()));
        }
        if (product.getMediaGallery() == null) {
            product.setMediaGallery(new ArrayList<>());
        } else {
            product.setMediaGallery(new ArrayList<>(product.getMediaGallery()));
        }
        if (product.getMerchantSkus() == null) {
            product.setMerchantSkus(new HashMap<>());
        } else {
            product.setMerchantSkus(new HashMap<>(product.getMerchantSkus()));
        }
    }

    private void mergeLocalizedMap(Product product, boolean isNameField, Map<String, String> patchValues) {
        Map<String, String> source = isNameField ? product.getName() : product.getDescription();
        Map<String, String> target = source == null ? new HashMap<>() : new HashMap<>(source);
        if (isNameField) {
            product.setName(target);
        } else {
            product.setDescription(target);
        }

        for (Map.Entry<String, String> entry : patchValues.entrySet()) {
            if (entry.getValue() == null) {
                target.remove(entry.getKey());
            } else {
                target.put(entry.getKey(), entry.getValue());
            }
        }
    }

    private Map<String, Object> categoryTemplateField(String key, String labelKey, String type) {
        Map<String, Object> field = new LinkedHashMap<>();
        field.put("key", key);
        field.put("labelKey", labelKey);
        field.put("type", type);
        return field;
    }

    private Map<String, Object> categoryTemplateFieldWithOptions(String key, String labelKey, List<String> options) {
        Map<String, Object> field = categoryTemplateField(key, labelKey, "select");
        field.put("options", options);
        return field;
    }

    private Long nextUserId() {
        return checkoutIds.saveAndFlush(new com.bobbuy.model.CheckoutIdentity()).id;
    }

    private void requireOwnedTrip(Long tripId) {
        Trip trip = tripRepository.findById(tripId).orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.trip.not_found"));
        com.bobbuy.security.MerchantScope.require(trip.getAgentId());
    }

    private Long nextTripId() {
        return checkoutIds.saveAndFlush(new com.bobbuy.model.CheckoutIdentity()).id;
    }

    private synchronized Long nextOrderIdentity() {
        return checkoutIds.saveAndFlush(new com.bobbuy.model.CheckoutIdentity()).id;
    }
}
