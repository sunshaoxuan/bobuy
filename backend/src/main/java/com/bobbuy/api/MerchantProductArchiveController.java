package com.bobbuy.api;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.MediaGalleryItem;
import com.bobbuy.model.MediaType;
import com.bobbuy.model.Product;
import com.bobbuy.model.ProductSale;
import com.bobbuy.repository.ProductRepository;
import com.bobbuy.security.MerchantScope;
import com.bobbuy.service.LocalizedJsonbReaderService;
import com.bobbuy.service.ProductCategoryLabels;
import com.bobbuy.service.ProductSaleService;
import com.bobbuy.service.ProductRatingService;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/merchant/product-archive")
public class MerchantProductArchiveController {
    private static final int PAGE_SIZE = 24;
    private static final int EXPORT_LIMIT = 500;
    private final ProductRepository products;
    private final ProductCategoryLabels categoryLabels;
    private final ProductSaleService sales;
    private final LocalizedJsonbReaderService localized;
    private final ProductRatingService ratings;

    public MerchantProductArchiveController(ProductRepository products, ProductCategoryLabels categoryLabels,
                                            ProductSaleService sales, LocalizedJsonbReaderService localized, ProductRatingService ratings) {
        this.products = products;
        this.categoryLabels = categoryLabels;
        this.sales = sales;
        this.localized = localized;
        this.ratings = ratings;
    }

    public record Price(BigDecimal amount, String currency, String unit) {}
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record Row(String id, String name, String itemNumber, String brand, String specification,
                      String categoryId, String categoryPath, String image, int mediaCount, String netContent, String packSize,
                      boolean catalogDriven, boolean privateDraft, Price currentRegular, BigDecimal rating) {}
    public record Page(List<Row> rows, long total) {}
    public record ExportSelection(List<String> ids, boolean limitExceeded) {}

    @GetMapping
    @Transactional(readOnly = true)
    public ApiResponse<Page> list(@RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "") String query, Locale locale) {
        long owner = owner();
        if (page < 0 || query.length() > 400) throw new ApiException(ErrorCode.INVALID_REQUEST, "product.archive_invalid");
        String search = query.strip();
        var ids = products.archiveIds(owner, search, PAGE_SIZE, (long) page * PAGE_SIZE);
        long total = products.archiveCount(owner, search);
        if (ids.isEmpty()) return ApiResponse.success(new Page(List.of(), total));
        var byId = new HashMap<String, Product>();
        products.findAllByMerchantIdAndIdIn(owner, ids).forEach(product -> byId.put(product.getId(), product));
        var ordered = ids.stream().map(byId::get).filter(Objects::nonNull).toList();
        var paths = categoryLabels.categoryLabels(ordered, locale);
        var prices = sales.currentRegulars(ordered);
        var averages = ratings.archiveRatings(ordered);
        return ApiResponse.success(new Page(ordered.stream()
                .map(product -> summarize(product, paths.get(product.getId()), prices.get(product.getId()), averages.get(product.getId()), locale))
                .toList(), total));
    }

    @GetMapping("/export-selection")
    public ApiResponse<ExportSelection> exportSelection() {
        var ids = products.archiveIds(owner(), "", EXPORT_LIMIT + 1, 0);
        if (ids.size() > EXPORT_LIMIT) return ApiResponse.success(new ExportSelection(List.of(), true));
        return ApiResponse.success(new ExportSelection(ids, false));
    }

    private Row summarize(Product product, String path, ProductSale sale, BigDecimal rating, Locale locale) {
        var media = product.getMediaGallery() == null ? List.<MediaGalleryItem>of() : product.getMediaGallery();
        var cover = media.stream().filter(Objects::nonNull)
                .filter(item -> item.getType() == null || item.getType() == MediaType.IMAGE)
                .map(MediaGalleryItem::getUrl).filter(url -> url != null && !url.isBlank()).findFirst().orElse(null);
        var catalog = product.getCatalogData();
        String specification = catalog == null ? null : localized.read(catalog.specification(), locale);
        String name = localized.read(product.getName() == null ? Map.of() : product.getName(), locale);
        var attributes = product.getAttributes() == null ? Map.<String,String>of() : product.getAttributes();
        return new Row(product.getId(), Objects.requireNonNullElse(name, ""), product.getItemNumber(), product.getBrand(), specification,
                product.getCategoryId(), path, cover, media.size(), attributes.get("netContent"), attributes.get("packSize"), catalog != null,
                "DRAFTER_ONLY".equals(String.valueOf(product.getVisibilityStatus())),
                sale == null ? null : new Price(sale.amount(), sale.currency(), sale.unit()), rating);
    }

    private static long owner() {
        Long owner = MerchantScope.current();
        if (owner == null || owner <= 0) throw new ApiException(ErrorCode.FORBIDDEN, "error.auth.forbidden");
        return owner;
    }
}
