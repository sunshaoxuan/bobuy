package com.bobbuy.service;

import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;
import java.util.List;

/** No invented URLs or generic substitute products when a real search provider is unavailable. */
@Service
@Profile("!mock-search")
public class UnconfiguredWebSearchService implements WebSearchService {
 @Override public List<SearchResult> search(String query) { return List.of(); }
}
