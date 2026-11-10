package com.bobbuy.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@org.springframework.context.annotation.Profile("mock-search")
public class MockWebSearchService implements WebSearchService {
  @Override
  public List<SearchResult> search(String query) {
    List<SearchResult> results = new ArrayList<>();
    if (query == null || query.isBlank()) {
      return results;
    }

    String normalized = query.toLowerCase();

    if (normalized.contains("seafood") || normalized.contains("53432")) {
      results.add(new SearchResult(
          "Costco Seafood Mix 53432",
          "https://www.costco.com/seafood-mix-53432.product.10053432.html",
          "Costco seafood assortment with shelf-ready packaging and item number 53432.",
          List.of(
              "https://images.costco-static.com/ImageDelivery/imageService?profileId=12026540&imageId=53432-847__1&recipeName=680",
              "https://images.costco-static.com/ImageDelivery/imageService?profileId=12026540&imageId=53432-847__2&recipeName=680"
          )
      ));
    } else if (normalized.contains("muffin") || normalized.contains("3169-2") || normalized.contains("kirkland")) {
      results.add(new SearchResult(
          "Kirkland Signature Muffin Mix",
          "https://www.costco.com/kirkland-signature-muffin-mix.product.10031692.html",
          "Kirkland Signature muffin mix multipack sold through Costco with item reference 3169-2.",
          List.of(
              "https://images.costco-static.com/ImageDelivery/imageService?profileId=12026540&imageId=31692-847__1&recipeName=680",
              "https://images.costco-static.com/ImageDelivery/imageService?profileId=12026540&imageId=31692-847__2&recipeName=680"
          )
      ));
    } else if (normalized.contains("matcha") || normalized.contains("kitkat")) {
      results.add(new SearchResult(
          "Nestlé KitKat Mini Matcha Whole Wheat Flour - Official",
          "https://www.nestle.jp/kitkat/matcha",
          "Experience the perfect blend of high-quality Uji matcha and whole wheat flour biscuits. A classic Japanese treat.",
          List.of(
              "https://www.nestle.jp/sites/default/files/2025-04/kitkat-matcha-pack-front.png",
              "https://www.nestle.jp/sites/default/files/2025-04/kitkat-matcha-pack-side.png"
          )
      ));
    } else if (normalized.contains("organic milk") || normalized.contains("costco")) {
        results.add(new SearchResult(
            "Kirkland Signature Organic Whole Milk, 3 pk/64 fl oz",
            "https://www.costco.com/kirkland-signature-organic-whole-milk.product.100344145.html",
            "Kirkland Signature Organic Whole Milk is produced on family farms and is USDA certified organic. 3 pack of 64 fl oz.",
            List.of(
                "https://images.costco-static.com/ImageDelivery/imageService?profileId=12026540&imageId=344145-847__1&recipeName=680",
                "https://images.costco-static.com/ImageDelivery/imageService?profileId=12026540&imageId=344145-847__2&recipeName=680"
            )
        ));
    } else {
      results.add(new SearchResult(
          "Product Detail for " + query,
          "https://www.costco.com/CatalogSearch?keyword=" + query.replace(' ', '+'),
          "Automatically generated trusted retail result for the identified product: " + query,
          List.of("https://images.costco-static.com/ImageDelivery/imageService?profileId=12026540&imageId=generic-847__1&recipeName=680")
      ));
    }

    return results;
  }
}
