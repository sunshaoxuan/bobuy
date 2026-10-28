package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.PriceTier;
import com.bobbuy.model.Product;
import com.bobbuy.model.ProductPatch;
import com.bobbuy.model.ProductVisibility;
import com.bobbuy.service.AiAgentService;
import com.bobbuy.service.AiOnboardingPipelineException;
import com.bobbuy.service.AiProductOnboardingService;
import com.bobbuy.service.BobbuyStore;
import com.bobbuy.service.ImageStorageService;
import com.bobbuy.service.ProcurementHudService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/ai")
public class AiAgentController {
  private static final Logger log = LoggerFactory.getLogger(AiAgentController.class);
  private static final double SEMANTIC_OVERWRITE_THRESHOLD = 70d;
  private final AiAgentService aiAgentService;
  private final AiProductOnboardingService aiProductOnboardingService;
  private final BobbuyStore store;
  private final ImageStorageService imageStorageService;
  private final ProcurementHudService procurementHudService;

  @Value("${bobbuy.ai.default-reconcile-quantity:1}")
  private int defaultReconcileQuantity;

  public AiAgentController(AiAgentService aiAgentService,
                           AiProductOnboardingService aiProductOnboardingService,
                           BobbuyStore store,
                           ImageStorageService imageStorageService,
                           ProcurementHudService procurementHudService) {
    this.aiAgentService = aiAgentService;
    this.aiProductOnboardingService = aiProductOnboardingService;
    this.store = store;
    this.imageStorageService = imageStorageService;
    this.procurementHudService = procurementHudService;
  }

  @PostMapping("/parse")
  public ResponseEntity<ApiResponse<AiParseResponse>> parse(@Valid @RequestBody AiParseRequest request) {
    List<AiExtractedItemResponse> items = aiAgentService.parse(request.getText())
        .stream()
        .map(item -> new AiExtractedItemResponse(
            item.id(),
            item.originalName(),
            item.matchedName(),
            item.quantity(),
            item.note(),
            item.price(),
            item.confidence()
        ))
        .toList();
    return ResponseEntity.ok(ApiResponse.success(new AiParseResponse(items)));
  }

  @PostMapping("/experience/confirm")
  public ResponseEntity<ApiResponse<Void>> confirmMapping(@Valid @RequestBody AiConfirmMappingRequest request) {
    aiAgentService.confirmMapping(request.getOriginalName(), request.getMatchedName());
    return ResponseEntity.ok(ApiResponse.success(null));
  }

  @PostMapping("/translate")
  public ResponseEntity<ApiResponse<AiTranslateResponse>> translate(@Valid @RequestBody AiTranslateRequest request) {
    String translated = aiAgentService.translate(request.getText(), request.getTargetLocale())
        .orElse("");
    return ResponseEntity.ok(ApiResponse.success(new AiTranslateResponse(translated)));
  }

  @PostMapping("/onboard/scan")
  public ResponseEntity<ApiResponse<AiOnboardingSuggestion>> scan(@Valid @RequestBody AiOnboardScanRequest request) {
    try {
      return aiProductOnboardingService.onboardFromPhoto(request.getBase64Image(), request.getSampleId())
          .map(suggestion -> ResponseEntity.ok(ApiResponse.success(suggestion)))
          .orElseThrow(() -> new ApiException(ErrorCode.INVALID_REQUEST, "error.ai.extract_failed"));
    } catch (AiOnboardingPipelineException ex) {
      log.warn("AI onboarding scan failed at stage={} message={}", ex.getStage(), ex.getMessage());
      throw new ApiException(ErrorCode.INVALID_REQUEST, ex.getMessageKey());
    }
  }

  @PostMapping("/onboard/confirm")
  public ResponseEntity<ApiResponse<MobileProductResponse>> confirmOnboard(@Valid @RequestBody AiOnboardingSuggestion suggestion) {
    try {
      Product result;
      String evidenceImageUrl = imageStorageService.saveBase64(suggestion.originalPhotoBase64());
      ProductVisibility targetVisibility = suggestion.visibilityStatus();
      boolean manualReviewRequired = suggestion.trace() != null && Boolean.TRUE.equals(suggestion.trace().manualReviewRequired());
      if (manualReviewRequired || (suggestion.matchScore() != null && suggestion.matchScore() < SEMANTIC_OVERWRITE_THRESHOLD)) {
        targetVisibility = ProductVisibility.DRAFTER_ONLY;
      }
      String targetProductId = suggestion.existingProductId();
      if ((targetProductId == null || targetProductId.isBlank()) && suggestion.itemNumber() != null && !suggestion.itemNumber().isBlank()) {
        targetProductId = store.findProductByItemNumber(suggestion.itemNumber()).map(Product::getId).orElse(null);
      }
      boolean allowOverwrite = suggestion.existingProductFound()
          && targetProductId != null
          && (suggestion.matchScore() == null || suggestion.matchScore() >= SEMANTIC_OVERWRITE_THRESHOLD);

      if (!allowOverwrite && !suggestion.existingProductFound() && targetProductId != null) {
        allowOverwrite = true;
      }

      if (allowOverwrite) {
        ProductPatch patch = new ProductPatch();
        if (suggestion.name() != null && !suggestion.name().isBlank()) {
          Map<String, String> nameMap = new HashMap<>();
          nameMap.put("zh-CN", suggestion.name());
          nameMap.put("ja-JP", suggestion.name());
          nameMap.put("en-US", suggestion.name());
          patch.setName(nameMap);
        }
        if (suggestion.description() != null && !suggestion.description().isBlank()) {
          Map<String, String> descMap = new HashMap<>();
          descMap.put("zh-CN", suggestion.description());
          descMap.put("ja-JP", suggestion.description());
          descMap.put("en-US", suggestion.description());
          patch.setDescription(descMap);
        }
        if (suggestion.price() != null) {
          patch.setBasePrice(suggestion.price());
        }
        if (suggestion.detectedPriceTiers() != null && !suggestion.detectedPriceTiers().isEmpty()) {
          patch.setPriceTiers(suggestion.detectedPriceTiers());
        }
        if (targetVisibility != null) {
          patch.setVisibilityStatus(targetVisibility);
        }

        List<com.bobbuy.model.MediaGalleryItem> gallery = new java.util.ArrayList<>(suggestion.mediaGallery() != null ? suggestion.mediaGallery() : List.of());
        if (evidenceImageUrl != null) {
          gallery.add(0, createEvidenceImage(evidenceImageUrl));
        }
        patch.setMediaGallery(gallery);

        if (suggestion.brand() != null) {
          patch.setBrand(suggestion.brand());
        }
        if (suggestion.categoryId() != null && !suggestion.categoryId().isBlank()) {
          patch.setCategoryId(suggestion.categoryId());
        }
        if (suggestion.itemNumber() != null && !suggestion.itemNumber().isBlank()) {
          patch.setItemNumber(suggestion.itemNumber());
        }
        if (suggestion.storageCondition() != null) {
          patch.setStorageCondition(suggestion.storageCondition());
        }
        if (suggestion.orderMethod() != null) {
          patch.setOrderMethod(suggestion.orderMethod());
        }
        if (suggestion.attributes() != null) {
          patch.setAttributes(suggestion.attributes());
        }
        result = store.patchProduct(targetProductId, patch)
            .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.product.not_found"));
      } else {
        Product newProduct = new Product();
        Map<String, String> nameMap = new HashMap<>();
        nameMap.put("zh-CN", suggestion.name());
        nameMap.put("ja-JP", suggestion.name());
        nameMap.put("en-US", suggestion.name());
        newProduct.setName(nameMap);

        Map<String, String> descMap = new HashMap<>();
        if (suggestion.description() != null) {
          descMap.put("zh-CN", suggestion.description());
          descMap.put("ja-JP", suggestion.description());
          descMap.put("en-US", suggestion.description());
        }
        newProduct.setDescription(descMap);

        newProduct.setBrand(suggestion.brand());
        newProduct.setBasePrice(suggestion.price() != null ? suggestion.price() : 0.0);

        List<com.bobbuy.model.MediaGalleryItem> gallery = new java.util.ArrayList<>(suggestion.mediaGallery() != null ? suggestion.mediaGallery() : List.of());
        if (evidenceImageUrl != null) {
          gallery.add(0, createEvidenceImage(evidenceImageUrl));
        }
        newProduct.setMediaGallery(gallery);

        newProduct.setStorageCondition(suggestion.storageCondition());
        newProduct.setOrderMethod(suggestion.orderMethod());
        newProduct.setCategoryId(suggestion.categoryId() == null || suggestion.categoryId().isBlank() ? null : suggestion.categoryId());
        newProduct.setItemNumber(suggestion.itemNumber());
        newProduct.setTemporary(true);
        newProduct.setVisibilityStatus(targetVisibility != null ? targetVisibility : ProductVisibility.DRAFTER_ONLY);
        newProduct.setRecommended(false);
        newProduct.setMerchantSkus(new HashMap<>());
        newProduct.setAttributes(suggestion.attributes());
        if (suggestion.detectedPriceTiers() != null) {
          newProduct.setPriceTiers(suggestion.detectedPriceTiers());
        }

        result = store.createProduct(newProduct);
      }

      ProcurementHudService.ReconcileInventoryResult reconcileResult =
          procurementHudService.reconcileInventoryWithDetails(result.getId(), defaultReconcileQuantity);

      AiOnboardingTrace requestTrace = suggestion.trace();
      AiOnboardingTrace finalTrace = new AiOnboardingTrace(
          requestTrace != null ? requestTrace.inputSampleId() : suggestion.inputSampleId(),
          requestTrace != null ? requestTrace.recognitionSummary() : suggestion.recognitionSummary(),
          requestTrace != null ? requestTrace.sourceDomains() : suggestion.sourceDomains(),
          allowOverwrite ? "EXISTING_PRODUCT" : "NEW_PRODUCT",
          result.getId(),
          requestTrace != null ? requestTrace.provider() : null,
          requestTrace != null ? requestTrace.activeProvider() : null,
          requestTrace != null ? requestTrace.model() : null,
          requestTrace != null ? requestTrace.stage() : "MANUAL_REVIEW",
          requestTrace != null ? requestTrace.latencyMs() : null,
          requestTrace != null ? requestTrace.errorCode() : null,
          requestTrace != null ? requestTrace.errorMessage() : null,
          requestTrace != null ? requestTrace.fallbackReason() : null,
          requestTrace != null ? requestTrace.retryCount() : 0,
          requestTrace != null ? requestTrace.attemptNo() : 1,
          requestTrace != null ? requestTrace.inputRef() : suggestion.inputSampleId(),
          result.getId(),
          "CONFIRMED",
          false,
          requestTrace != null ? requestTrace.createdAt() : LocalDateTime.now(),
          LocalDateTime.now(),
          requestTrace != null ? requestTrace.events() : List.of());

      return ResponseEntity.ok(ApiResponse.success(
          new MobileProductResponse(
              result,
              suggestion.name(),
              suggestion.description(),
              reconcileResult.reconciledQuantity(),
              reconcileResult.tripId(),
              reconcileResult.allocatedBusinessIds(),
              finalTrace)));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      log.error("AI onboarding confirm failed [PERSISTENCE]: itemNumber={} existingProductFound={}",
          suggestion.itemNumber(), suggestion.existingProductFound(), ex);
      throw new ApiException(ErrorCode.INTERNAL_ERROR, "error.ai.product_persist_failed");
    }
  }

  private com.bobbuy.model.MediaGalleryItem createEvidenceImage(String evidenceImageUrl) {
    return new com.bobbuy.model.MediaGalleryItem(
        evidenceImageUrl,
        com.bobbuy.model.MediaType.IMAGE,
        new HashMap<>(),
        true,
        evidenceImageUrl,
        "user-upload",
        "USER_UPLOAD_EVIDENCE");
  }
}
