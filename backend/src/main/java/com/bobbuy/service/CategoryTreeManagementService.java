package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.CategoryTreeNode;
import com.bobbuy.model.Product;
import com.bobbuy.model.ProductPrimaryCategoryPath;
import com.bobbuy.repository.*;
import com.bobbuy.security.MerchantScope;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class CategoryTreeManagementService {
    public record Node(String id, String parentId, Map<String, String> name, List<String> fullPath,
                       int sortOrder, long productCount, boolean deleteBlocked) {}
    /** Full parent is required; null explicitly means the root. */
    public record Edit(String parentId, Map<String, String> name, Integer sortOrder) {}
    public record ProductPath(String productId, String categoryNodeId) {}
    private static final Set<String> LOCALES = Set.of("zh-CN", "zh-TW", "en-US", "ja-JP");
    private static final Comparator<CategoryTreeNode> ORDER = Comparator.comparingInt(CategoryTreeNode::getSortOrder)
            .thenComparing(CategoryTreeNode::getId);
    private final CategoryTreeNodeRepository nodes;
    private final ProductPrimaryCategoryPathRepository paths;
    private final ProductRepository products;
    private final CategoryLegacyMappingRepository mappings;
    private final ProductCategoryPathResolver resolver;
    private final JdbcTemplate jdbc;

    public CategoryTreeManagementService(CategoryTreeNodeRepository nodes, ProductPrimaryCategoryPathRepository paths,
            ProductRepository products, CategoryLegacyMappingRepository mappings, ProductCategoryPathResolver resolver,
            JdbcTemplate jdbc) {
        this.nodes = nodes; this.paths = paths; this.products = products; this.mappings = mappings; this.resolver = resolver; this.jdbc = jdbc;
    }

    private static ApiException invalid() { return new ApiException(ErrorCode.INVALID_REQUEST, "error.category.invalid"); }

    private Map<String, String> names(Map<String, String> input) {
        if (input == null || !LOCALES.containsAll(input.keySet())) throw invalid();
        Map<String, String> result = new LinkedHashMap<>();
        input.forEach((locale, value) -> {
            if (value == null || value.length() > 200 || value.contains("＞") || value.chars().anyMatch(Character::isISOControl)) throw invalid();
            if (!value.isBlank()) result.put(locale, value.strip());
        });
        if (!result.containsKey("ja-JP")) throw invalid();
        return result;
    }

    private CategoryTreeNode editable(String id) {
        return nodes.findById(id).filter(n -> n.getSystemKey() == null).orElseThrow(CategoryTreeManagementService::invalid);
    }

    private List<CategoryTreeNode> siblings(String parent) {
        var siblings = new ArrayList<>(nodes.findAllByParentId(parent).stream().filter(n -> n.getSystemKey() == null).toList());
        sort(siblings, productCounts(nodes.findAll()));
        return siblings;
    }

    /** Count assigned products throughout each subtree, including unpublished products. */
    private Map<String, Long> productCounts(List<CategoryTreeNode> tree) {
        Map<String, Long> counts = new HashMap<>();
        for (var node : tree) {
            long count = paths.countByCategoryNodeId(node.getId());
            for (String ancestor : node.getFullPath()) counts.merge(ancestor, count, Long::sum);
        }
        return counts;
    }

    private void sort(List<CategoryTreeNode> siblings, Map<String, Long> counts) {
        siblings.sort(siblings.stream().anyMatch(CategoryTreeNode::isExplicitOrder) ? ORDER
                : Comparator.<CategoryTreeNode>comparingLong(n -> counts.getOrDefault(n.getId(), 0L)).reversed().thenComparing(ORDER));
    }

    private void uniqueName(String parent, String name, String except) {
        if (siblings(parent).stream().anyMatch(n -> !n.getId().equals(except) && name.equals(n.getName().get("ja-JP")))) throw invalid();
    }

    private boolean blocked(CategoryTreeNode node) {
        return node.getSystemKey() != null || nodes.existsByParentId(node.getId())
                || paths.countByCategoryNodeId(node.getId()) > 0 || mappings.existsByCategoryNodeId(node.getId());
    }

    private Node view(CategoryTreeNode n) {
        return list().stream().filter(row -> row.id().equals(n.getId())).findFirst().orElseThrow();
    }

    @Transactional(readOnly = true)
    public List<Node> list() {
        var tree = nodes.findAll();
        var counts = productCounts(tree);
        Map<String, List<CategoryTreeNode>> groups = new LinkedHashMap<>();
        tree.stream().filter(n -> n.getSystemKey() == null)
                .forEach(n -> groups.computeIfAbsent(n.getParentId(), key -> new ArrayList<>()).add(n));
        List<Node> result = new ArrayList<>();
        for (var group : groups.values()) {
            sort(group, counts);
            for (int i = 0; i < group.size(); i++) {
                var n = group.get(i);
                result.add(new Node(n.getId(), n.getParentId(), Map.copyOf(n.getName()), List.copyOf(n.getFullPath()),
                        i, counts.getOrDefault(n.getId(), 0L), blocked(n)));
            }
        }
        return result;
    }

    private void place(CategoryTreeNode node, String parent, int position) {
        var ordered = siblings(parent);
        ordered.removeIf(n -> n.getId().equals(node.getId()));
        ordered.add(Math.min(position, ordered.size()), node);
        for (int i = 0; i < ordered.size(); i++) {
            ordered.get(i).setSortOrder(i);
            ordered.get(i).setExplicitOrder(true);
        }
        nodes.saveAll(ordered);
    }

    @Transactional
    public Node create(Edit edit) {
        nodes.lockTree().orElseThrow(CategoryTreeManagementService::invalid);
        if (edit == null || edit.sortOrder() != null && edit.sortOrder() < 0) throw invalid();
        var parent = edit.parentId() == null ? null : editable(edit.parentId());
        var name = names(edit.name());
        uniqueName(edit.parentId(), name.get("ja-JP"), null);
        var full = new ArrayList<String>();
        if (parent != null) full.addAll(parent.getFullPath());
        String id = UUID.randomUUID().toString(); full.add(id);
        var existing = siblings(edit.parentId());
        int rank = existing.stream().mapToInt(CategoryTreeNode::getSortOrder).max().orElse(-1) + 1;
        var node = new CategoryTreeNode(id, edit.parentId(), name, full, rank, null);
        node.setExplicitOrder(existing.stream().anyMatch(CategoryTreeNode::isExplicitOrder));
        nodes.save(node);
        if (edit.sortOrder() != null) place(node, edit.parentId(), edit.sortOrder());
        return view(node);
    }

    @Transactional
    public Node update(String id, Edit edit) {
        nodes.lockTree().orElseThrow(CategoryTreeManagementService::invalid);
        if (edit == null || edit.sortOrder() != null && edit.sortOrder() < 0) throw invalid();
        var node = editable(id);
        var parent = edit.parentId() == null ? null : editable(edit.parentId());
        if (parent != null && parent.getFullPath().contains(id)) throw invalid();
        var name = edit.name() == null ? node.getName() : names(edit.name());
        if (!Objects.equals(name.get("ja-JP"), node.getName().get("ja-JP"))) {
            // Child 2 originally copied Japanese into every locale. Those copies are not reviewed translations.
            name = new LinkedHashMap<>(name);
            String oldJapanese = node.getName().get("ja-JP");
            name.entrySet().removeIf(entry -> !entry.getKey().equals("ja-JP") && entry.getValue().equals(oldJapanese));
        }
        uniqueName(edit.parentId(), name.get("ja-JP"), id);
        String oldParent = node.getParentId();
        boolean moved = !Objects.equals(oldParent, edit.parentId());
        if (moved) {
            var destination = siblings(edit.parentId());
            node.setExplicitOrder(destination.stream().anyMatch(CategoryTreeNode::isExplicitOrder));
            node.setSortOrder(destination.stream().mapToInt(CategoryTreeNode::getSortOrder).max().orElse(-1) + 1);
            var oldPath = List.copyOf(node.getFullPath());
            var prefix = new ArrayList<String>();
            if (parent != null) prefix.addAll(parent.getFullPath());
            prefix.add(id);
            for (var descendant : nodes.findAll()) {
                var path = descendant.getFullPath();
                if (path.size() > oldPath.size() && path.subList(0, oldPath.size()).equals(oldPath)) {
                    var next = new ArrayList<>(prefix); next.addAll(path.subList(oldPath.size(), path.size()));
                    descendant.setFullPath(next); nodes.save(descendant);
                }
            }
            node.setParentId(edit.parentId()); node.setFullPath(prefix);
        }
        node.setName(name); nodes.save(node);
        if (edit.sortOrder() != null) place(node, edit.parentId(), edit.sortOrder());
        return view(node);
    }

    @Transactional
    public void delete(String id) {
        nodes.lockTree().orElseThrow(CategoryTreeManagementService::invalid);
        var node = editable(id);
        if (blocked(node)) throw invalid();
        nodes.delete(node);
    }

    @Transactional(readOnly = true)
    public ProductPath product(String productId) {
        Product product = owned(productId);
        var resolved = resolver.resolve(product);
        String id = resolved.categoryId();
        // Legacy flat labels have no invented tree equivalent. Unrelated saves preserve them.
        if (resolved.source() == ProductCategoryPathResolver.Source.LEGACY_FLAT
                || ProductCategoryPathResolver.UNCATEGORIZED_NODE_ID.equals(id)) id = null;
        return new ProductPath(productId, id);
    }

    @Transactional
    public ProductPath assign(String productId, ProductPath input) {
        nodes.lockTree().orElseThrow(CategoryTreeManagementService::invalid);
        owned(productId);
        if (input == null) throw invalid();
        String id = input.categoryNodeId();
        if (id == null) id = ProductCategoryPathResolver.UNCATEGORIZED_NODE_ID;
        else {
            editable(id);
            if (nodes.existsByParentId(id)) throw invalid();
        }
        // An explicit assignment prevents legacy fallback from undoing a user's clear.
        paths.save(new ProductPrimaryCategoryPath(productId, id));
        // Imported provenance describes the imported assignment, not a later manual one.
        // Import audit rows retain the historical source independently.
        jdbc.update("update bb_product set category_path_source=null where id=?", productId);
        return new ProductPath(productId, ProductCategoryPathResolver.UNCATEGORIZED_NODE_ID.equals(id) ? null : id);
    }

    private Product owned(String id) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        boolean admin = auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_PLATFORM_ADMIN"));
        Long merchant = MerchantScope.current();
        if (!admin && merchant == null) throw new ApiException(ErrorCode.FORBIDDEN, "error.forbidden");
        return products.findById(id).filter(p -> admin || merchant.equals(p.getMerchantId()))
                .orElseThrow(() -> new ApiException(ErrorCode.FORBIDDEN, "error.forbidden"));
    }
}
