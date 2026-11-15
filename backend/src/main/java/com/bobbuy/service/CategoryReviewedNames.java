package com.bobbuy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;

/** Reviewed names only; Japanese path identity is never translated or corrected. */
@Component
public class CategoryReviewedNames {
    public record Entry(List<String> japanesePath, String status, Map<String,String> names,
                        String reviewedBy, String reviewedAt) {}
    public record File(int schemaVersion, String status, String sourceFile, String sourceSha256,
                       List<String> pendingReview, List<Entry> entries) {}
    private final Map<List<String>,Map<String,String>> reviewed;

    public CategoryReviewedNames() {
        this(CategoryReviewedNames.class.getResourceAsStream("/category-names/ops-reviewed-names.json"));
    }

    CategoryReviewedNames(InputStream input) {
        try (input) {
            if(input==null) throw new IllegalArgumentException("Missing category name mapping");
            File file=new ObjectMapper().readValue(input,File.class);
            if(file.schemaVersion()!=1 || !Set.of("pending_ops_review","reviewed").contains(file.status())
                    || !"category-tree-migration-2026-11-15.csv".equals(file.sourceFile())
                    || file.entries()==null || file.pendingReview()==null)
                throw new IllegalArgumentException("Invalid category name mapping contract");
            Map<List<String>,Map<String,String>> approved=new HashMap<>();
            Set<List<String>> seen=new HashSet<>();
            for(Entry entry:file.entries()) {
                if(entry.japanesePath()==null || entry.japanesePath().isEmpty()
                        || entry.japanesePath().stream().anyMatch(n->n==null || n.isBlank() || n.contains(">") || n.contains("＞") || n.contains("\n") || n.contains("\r"))
                        || !seen.add(entry.japanesePath()) || !Set.of("pending_ops_review","reviewed").contains(entry.status()))
                    throw new IllegalArgumentException("Invalid or duplicate Japanese mapping path");
                if(!"reviewed".equals(entry.status())) continue;
                if(file.sourceSha256()==null || !file.sourceSha256().matches("[a-f0-9]{64}")
                        || entry.reviewedBy()==null || entry.reviewedBy().isBlank()
                        || entry.reviewedAt()==null || entry.reviewedAt().isBlank()
                        || entry.names()==null || !entry.names().keySet().equals(Set.of("zh-CN","zh-TW","en-US"))
                        || entry.names().values().stream().anyMatch(v->v==null || v.isBlank() || v.length()>200))
                    throw new IllegalArgumentException("Reviewed names require source hash, review receipt and all three translations");
                java.time.LocalDate.parse(entry.reviewedAt());
                approved.put(List.copyOf(entry.japanesePath()),Map.copyOf(entry.names()));
            }
            if("reviewed".equals(file.status()) && (!file.pendingReview().isEmpty() || approved.size()!=file.entries().size() || approved.isEmpty()))
                throw new IllegalArgumentException("Reviewed mapping still has pending entries");
            reviewed=Map.copyOf(approved);
        } catch(IOException e) { throw new IllegalArgumentException("Cannot read reviewed category names",e); }
    }

    public Map<String,String> names(List<String> japanesePath) {
        Map<String,String> result=new HashMap<>(reviewed.getOrDefault(japanesePath,Map.of()));
        result.put("ja-JP",japanesePath.get(japanesePath.size()-1));
        return Map.copyOf(result);
    }
}
