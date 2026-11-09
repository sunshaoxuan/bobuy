package com.bobbuy.api;

import com.bobbuy.api.response.*;
import com.bobbuy.model.CostcoOnboardingJob;
import com.bobbuy.repository.JdbcCostcoOnboardingJobRepository;
import com.bobbuy.repository.SupplierRepository;
import com.bobbuy.security.BobbuyAuthenticatedUser;
import com.bobbuy.service.CostcoEvidencePersistence;
import com.bobbuy.service.CostcoNumberOnboardingService;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

/** Only queues owned durable work. No external AI/retrieval/product mutation in the request transaction. */
@RestController
@RequestMapping("/api/ai/costco-onboarding")
public class CostcoOnboardingController {
    private final CostcoNumberOnboardingService service; private final JdbcCostcoOnboardingJobRepository jobs;
    private final SupplierRepository suppliers; private final CostcoEvidencePersistence evidence;
    private final boolean workerEnabled;
    public CostcoOnboardingController(CostcoNumberOnboardingService service, JdbcCostcoOnboardingJobRepository jobs,
            SupplierRepository suppliers, CostcoEvidencePersistence evidence,@org.springframework.beans.factory.annotation.Value("${bobbuy.ai.costco.worker.enabled:false}") boolean workerEnabled) { this.service=service;this.jobs=jobs;this.suppliers=suppliers;this.evidence=evidence;this.workerEnabled=workerEnabled; }
    public record NumberInput(String requestId,String supplierId,String market,String itemNumber) {
        @JsonAnySetter public void unknown(String field,Object value){throw new IllegalArgumentException("onboarding.unknown_field");}
    }
    public record View(String id,CostcoOnboardingJob.State state,long revision,String itemNumber,
            String productId,Long productVersion,String failureCode,String stage,com.bobbuy.service.CostcoOnboardingDecision.Candidate candidate) {}
    public static View view(CostcoOnboardingJob job) {
        return new View(job.id(),job.state(),job.revision(),job.itemNumber(),job.productId(),job.productVersion(),job.failureCode(),
                job.decisions().isEmpty()?null:job.decisions().get(job.decisions().size()-1).stage().name(),job.decisions().stream().filter(d->d.candidate()!=null).reduce((a,b)->b).map(com.bobbuy.service.CostcoOnboardingDecision::candidate).orElse(null));
    }
    private long owner(Authentication auth) {
        if(auth==null || !auth.isAuthenticated() || auth.getAuthorities().stream().noneMatch(a->a.getAuthority().equals("ROLE_AGENT"))
                || !(auth.getPrincipal() instanceof BobbuyAuthenticatedUser user) || user.id()==null || user.id()<=0)
            throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");
        return user.id();
    }
    private void supplier(long owner,String id) {
        if(id==null||id.isBlank()||id.length()>100||suppliers.findById(id).filter(s->Long.valueOf(owner).equals(s.getMerchantId())).isEmpty())
            throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"onboarding.supplier_not_found");
    }
    @PostMapping public ApiResponse<View> number(Authentication auth,@RequestBody NumberInput request) {
        long owner=owner(auth);if(!workerEnabled)throw new ApiException(ErrorCode.INVALID_STATUS,"onboarding.worker_disabled");supplier(owner,request.supplierId());
        try { return ApiResponse.success(view(service.enqueue(new CostcoNumberOnboardingService.Input(owner,request.supplierId(),request.market(),request.requestId(),request.itemNumber(),null)))); }
        catch(IllegalArgumentException e){throw new ApiException(ErrorCode.INVALID_REQUEST,e.getMessage());}
        catch(CostcoNumberOnboardingService.NeedsInput e){throw new ApiException(ErrorCode.FORBIDDEN,e.getMessage());}
        catch(IllegalStateException e){throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"onboarding.idempotency_conflict");}
    }
    @PostMapping(value="/photo",consumes=org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @org.springframework.transaction.annotation.Transactional
    public ApiResponse<View> photo(Authentication auth,@RequestParam String requestId,@RequestParam String supplierId,
            @RequestParam String market,@RequestParam MultipartFile file) throws IOException {
        long owner=owner(auth);if(!workerEnabled)throw new ApiException(ErrorCode.INVALID_STATUS,"onboarding.worker_disabled");supplier(owner,supplierId);
        // Validate scope/idempotency input before persisting even private evidence.
        new CostcoNumberOnboardingService.Input(owner,supplierId,market,requestId,null,"0".repeat(64));
        if(file==null||file.isEmpty()||file.getSize()>8*1024*1024)throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.image");
        String hash=evidence.putPrivatePhoto(owner,file.getBytes());
        try { return ApiResponse.success(view(service.enqueue(new CostcoNumberOnboardingService.Input(owner,supplierId,market,requestId,null,hash)))); }
        catch(CostcoNumberOnboardingService.NeedsInput e){throw new ApiException(ErrorCode.FORBIDDEN,e.getMessage());}
        catch(IllegalStateException e){throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"onboarding.idempotency_conflict");}
    }
    @ExceptionHandler(com.bobbuy.service.CostcoOnboardingQuotaException.class)
    public org.springframework.http.ResponseEntity<ApiError> quota(com.bobbuy.service.CostcoOnboardingQuotaException failure){return org.springframework.http.ResponseEntity.status(429).header("Retry-After",Integer.toString(failure.retryAfterSeconds())).body(new ApiError("RATE_LIMITED",failure.getMessage()));}
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public org.springframework.http.ResponseEntity<ApiError> conflict(org.springframework.web.server.ResponseStatusException failure){return org.springframework.http.ResponseEntity.status(failure.getStatusCode()).body(new ApiError("INVALID_REQUEST","onboarding.idempotency_conflict"));}
    @ExceptionHandler(CostcoNumberOnboardingService.NeedsInput.class)
    public org.springframework.http.ResponseEntity<ApiError> scopeChanged(CostcoNumberOnboardingService.NeedsInput failure){return org.springframework.http.ResponseEntity.status(403).body(new ApiError("FORBIDDEN",failure.getMessage()));}
    @GetMapping public ApiResponse<?> recent(Authentication auth) { return ApiResponse.success(jobs.recent(owner(auth)).stream().map(CostcoOnboardingController::view).toList()); }
    public record Status(boolean workerEnabled) {}
    @GetMapping("/status") public ApiResponse<Status> status(Authentication auth){owner(auth);return ApiResponse.success(new Status(workerEnabled));}
    @GetMapping("/{id}") public ApiResponse<View> get(Authentication auth,@PathVariable String id) {
        long owner=owner(auth);var job=jobs.findOwned(id,owner).orElseThrow(()->new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"onboarding.not_found"));
        return ApiResponse.success(view(job));
    }
}
