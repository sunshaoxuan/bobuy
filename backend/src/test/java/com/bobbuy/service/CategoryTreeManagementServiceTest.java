package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CategoryTreeManagementServiceTest {
    private final CategoryTreeNodeRepository nodes = mock(CategoryTreeNodeRepository.class);
    private final ProductPrimaryCategoryPathRepository paths = mock(ProductPrimaryCategoryPathRepository.class);
    private final ProductRepository products = mock(ProductRepository.class);
    private final CategoryLegacyMappingRepository mappings = mock(CategoryLegacyMappingRepository.class);
    private final CategoryRepository legacy = mock(CategoryRepository.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final Map<String, CategoryTreeNode> tree = new LinkedHashMap<>();
    private final Map<String, ProductPrimaryCategoryPath> assigned = new HashMap<>();
    private CategoryTreeManagementService service;

    @BeforeEach void setup() {
        var system = new CategoryTreeNode("system-uncategorized", null, Map.of("ja-JP", "未分類"), List.of("system-uncategorized"), Integer.MAX_VALUE, "UNCATEGORIZED");
        tree.put(system.getId(), system);
        when(nodes.lockTree()).thenReturn(Optional.of(system));
        when(nodes.findById(anyString())).thenAnswer(c -> Optional.ofNullable(tree.get(c.getArgument(0))));
        when(nodes.findAll()).thenAnswer(c -> new ArrayList<>(tree.values()));
        when(nodes.findAllByParentId(any())).thenAnswer(c -> tree.values().stream().filter(n -> Objects.equals(n.getParentId(), c.getArgument(0))).toList());
        when(nodes.existsByParentId(anyString())).thenAnswer(c -> tree.values().stream().anyMatch(n -> Objects.equals(n.getParentId(), c.getArgument(0))));
        when(nodes.save(any())).thenAnswer(c -> {CategoryTreeNode n = c.getArgument(0); tree.put(n.getId(), n); return n;});
        doAnswer(c -> {tree.remove(((CategoryTreeNode)c.getArgument(0)).getId()); return null;}).when(nodes).delete(any());
        when(paths.findById(anyString())).thenAnswer(c -> Optional.ofNullable(assigned.get(c.getArgument(0))));
        when(paths.save(any())).thenAnswer(c -> {ProductPrimaryCategoryPath p = c.getArgument(0); assigned.put(p.getProductId(), p); return p;});
        when(paths.countByCategoryNodeId(anyString())).thenAnswer(c -> assigned.values().stream().filter(p -> p.getCategoryNodeId().equals(c.getArgument(0))).count());
        service = new CategoryTreeManagementService(nodes, paths, products, mappings, new ProductCategoryPathResolver(paths, mappings, legacy), jdbc);
    }
    @Test void shoppingMappingProtectsEmptySourceAndRejectsOverlappingMoves() {
        var first=add(null,"First");var second=add(null,"Second");
        var shopping=mock(ShoppingCategoryService.class);service.setShopping(shopping);
        when(shopping.referencesSource(first.id())).thenReturn(true);
        assertThat(service.list()).filteredOn(n->n.id().equals(first.id())).allMatch(CategoryTreeManagementService.Node::deleteBlocked);
        assertThatThrownBy(()->service.delete(first.id())).isInstanceOf(com.bobbuy.api.response.ApiException.class);
        verify(nodes,never()).delete(any());
        doThrow(new IllegalArgumentException("overlap")).when(shopping).validateSources(any());
        assertThatThrownBy(()->service.update(first.id(),new CategoryTreeManagementService.Edit(second.id(),null,null))).isInstanceOf(com.bobbuy.api.response.ApiException.class);
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    private CategoryTreeManagementService.Node add(String parent, String name) {
        return service.create(new CategoryTreeManagementService.Edit(parent, Map.of("ja-JP", name), null));
    }
    private void login(String role, String id) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(id, "unused", List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    @Test void addsNamesAndOrdersAndRejectsDuplicateSiblingNames() {
        var a = add(null, "食品"); var b = add(a.id(), "飲料");
        assertThat(b.fullPath()).containsExactly(a.id(), b.id());
        assertThat(b.name()).containsExactlyEntriesOf(Map.of("ja-JP", "飲料"));
        assertThatThrownBy(() -> add(a.id(), "飲料")).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> add(null, " ")).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> add(null, "食品＞飲料")).isInstanceOf(RuntimeException.class);
        assertThat(service.list()).hasSize(2);
    }

    @Test void reorderIsOneOperationAndNormalizesDuplicateImportedRanks() {
        var a = add(null, "一"); var b = add(null, "二"); var c = add(null, "三");
        tree.get(b.id()).setSortOrder(0);
        service.update(c.id(), new CategoryTreeManagementService.Edit(null, null, 0));
        assertThat(service.list()).extracting(CategoryTreeManagementService.Node::sortOrder).containsExactly(0, 1, 2);
        assertThat(service.list().get(0).id()).isEqualTo(c.id());
        verifyNoInteractions(products);
    }

    @Test void configuredOrderSurvivesProductCountChanges() {
        var a=add(null,"少"); var b=add(null,"多");
        var x=add(b.id(),"少子"); var y=add(b.id(),"多子");
        assigned.put("p1",new ProductPrimaryCategoryPath("p1",x.id()));
        assigned.put("p2",new ProductPrimaryCategoryPath("p2",y.id()));
        assigned.put("p3",new ProductPrimaryCategoryPath("p3",y.id()));
        assertThat(service.list().stream().filter(n->n.parentId()==null)).extracting(CategoryTreeManagementService.Node::id).containsExactly(a.id(),b.id());
        assertThat(service.list().stream().filter(n->b.id().equals(n.parentId()))).extracting(CategoryTreeManagementService.Node::id).containsExactly(x.id(),y.id());
        assertThat(service.list().stream().filter(n->n.id().equals(b.id())).findFirst().orElseThrow().productCount()).isEqualTo(3);
        service.update(b.id(),new CategoryTreeManagementService.Edit(null,Map.of("ja-JP","改名"),null));
        assertThat(tree.get(b.id()).isExplicitOrder()).isFalse();
        assigned.replaceAll((id,path)->new ProductPrimaryCategoryPath(id,a.id()));
        assertThat(service.list().get(0).id()).isEqualTo(a.id());
        assigned.clear();
        assertThat(service.list().get(0).id()).isEqualTo(a.id()); // Stable creation rank breaks ties.
        verifyNoInteractions(products);
    }

    @Test void explicitSiblingOrderSurvivesCountChangesRenameCreateAndMove() {
        var a=add(null,"一"); var b=add(null,"二");
        assigned.put("p",new ProductPrimaryCategoryPath("p",b.id()));
        service.update(a.id(),new CategoryTreeManagementService.Edit(null,null,0));
        assertThat(tree.get(a.id()).isExplicitOrder()).isTrue();
        assertThat(tree.get(b.id()).isExplicitOrder()).isTrue();
        service.update(a.id(),new CategoryTreeManagementService.Edit(null,Map.of("ja-JP","改名"),null));
        var c=add(null,"三");
        assigned.put("p2",new ProductPrimaryCategoryPath("p2",c.id()));
        assigned.put("p3",new ProductPrimaryCategoryPath("p3",c.id()));
        assertThat(service.list()).extracting(CategoryTreeManagementService.Node::id).containsExactly(a.id(),b.id(),c.id());
        var child=add(a.id(),"子");
        service.update(child.id(),new CategoryTreeManagementService.Edit(null,null,null));
        assertThat(tree.get(child.id()).isExplicitOrder()).isTrue();
        assertThat(service.list()).extracting(CategoryTreeManagementService.Node::id).containsExactly(a.id(),b.id(),c.id(),child.id());
        service.update(c.id(),new CategoryTreeManagementService.Edit(b.id(),null,null));
        assertThat(tree.get(c.id()).isExplicitOrder()).isFalse();
        assertThat(assigned.get("p2").getCategoryNodeId()).isEqualTo(c.id());
        verifyNoInteractions(products);
    }

    @Test void renameAndMoveKeepProductIdentityAndDescendantPathsWithoutProductWrites() {
        var root = add(null, "食品"); var branch = add(root.id(), "飲料"); var leaf = add(branch.id(), "水"); var destination = add(null, "日用品");
        assigned.put("product", new ProductPrimaryCategoryPath("product", leaf.id()));
        service.update(branch.id(), new CategoryTreeManagementService.Edit(destination.id(), Map.of("ja-JP", "飲み物", "en-US", ""), null));
        assertThat(tree.get(leaf.id()).getFullPath()).containsExactly(destination.id(), branch.id(), leaf.id());
        assertThat(tree.get(branch.id()).getName()).containsExactlyEntriesOf(Map.of("ja-JP", "飲み物"));
        assertThat(assigned.get("product").getCategoryNodeId()).isEqualTo(leaf.id());
        verifyNoInteractions(products); // No setters/save: publication, stock and price stay untouched.
        verify(paths, never()).save(any());
        service.update(branch.id(), new CategoryTreeManagementService.Edit(null, null, null));
        assertThat(tree.get(leaf.id()).getFullPath()).containsExactly(branch.id(), leaf.id());
    }

    @Test void rejectsCyclesAndSystemNodeMutation() {
        var root = add(null, "食品"); var leaf = add(root.id(), "水");
        for (String target : List.of(root.id(), leaf.id(), "system-uncategorized"))
            assertThatThrownBy(() -> service.update(root.id(), new CategoryTreeManagementService.Edit(target, null, null))).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> service.delete("system-uncategorized")).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> add("system-uncategorized", "水")).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> service.update("system-uncategorized", new CategoryTreeManagementService.Edit(null, Map.of("ja-JP", "変更"), 0))).isInstanceOf(RuntimeException.class);
    }

    @Test void renameUpdatesInheritedJapaneseCopiesWhilePreservingReviewedTranslation() {
        var root=add(null,"食品");
        tree.get(root.id()).setName(Map.of("ja-JP","食品","en-US","食品","zh-CN","食品","zh-TW","食物"));
        var renamed=service.update(root.id(),new CategoryTreeManagementService.Edit(null,Map.of("ja-JP","食品・飲料","en-US","食品","zh-CN","食品","zh-TW","食物"),null));
        assertThat(renamed.name()).containsExactlyInAnyOrderEntriesOf(Map.of("ja-JP","食品・飲料","zh-TW","食物"));
    }

    @Test void deletionBlocksChildrenProductsAndLegacyMappingsThenAllowsEmptyNode() {
        var root = add(null, "食品"); var leaf = add(root.id(), "水");
        assertThatThrownBy(() -> service.delete(root.id())).isInstanceOf(RuntimeException.class);
        assigned.put("product", new ProductPrimaryCategoryPath("product", leaf.id()));
        assertThatThrownBy(() -> service.delete(leaf.id())).isInstanceOf(RuntimeException.class);
        assigned.clear(); when(mappings.existsByCategoryNodeId(leaf.id())).thenReturn(true);
        assertThatThrownBy(() -> service.delete(leaf.id())).isInstanceOf(RuntimeException.class);
        when(mappings.existsByCategoryNodeId(leaf.id())).thenReturn(false);
        service.delete(leaf.id()); assertThat(tree).doesNotContainKey(leaf.id());
        verifyNoInteractions(products);
    }

    @Test void assignsOneLeafAndClearOverridesLegacyFallbackWithoutUpdatingProduct() {
        login("AGENT", "7"); Product product = mock(Product.class);
        when(product.getId()).thenReturn("p"); when(product.getMerchantId()).thenReturn(7L); when(product.getCategoryId()).thenReturn("old");
        when(products.findById("p")).thenReturn(Optional.of(product)); when(legacy.existsById("old")).thenReturn(true);
        var root = add(null, "食品"); var leaf = add(root.id(), "水");
        assertThatThrownBy(() -> service.assign("p", new CategoryTreeManagementService.ProductPath("p", root.id()))).isInstanceOf(RuntimeException.class);
        service.assign("p", new CategoryTreeManagementService.ProductPath("p", leaf.id()));
        assertThat(service.product("p").categoryNodeId()).isEqualTo(leaf.id());
        verify(jdbc).update("update bb_product set category_path_source=null where id=?", "p");
        service.assign("p", new CategoryTreeManagementService.ProductPath("p", null));
        verify(jdbc, times(2)).update("update bb_product set category_path_source=null where id=?", "p");
        assertThat(assigned).hasSize(1);
        assertThat(assigned.get("p").getCategoryNodeId()).isEqualTo("system-uncategorized");
        assertThat(service.product("p").categoryNodeId()).isNull();
        verify(products, never()).save(any()); verify(products, never()).delete(any());
    }

    @Test void merchantCannotEditOtherMerchantButPlatformAdminCan() {
        Product product = mock(Product.class); when(product.getMerchantId()).thenReturn(8L);
        when(products.findById("p")).thenReturn(Optional.of(product));
        login("AGENT", "7");
        assertThatThrownBy(() -> service.assign("p", new CategoryTreeManagementService.ProductPath("p", null))).isInstanceOf(RuntimeException.class);
        login("CUSTOMER", "8");
        assertThatThrownBy(() -> service.assign("p", new CategoryTreeManagementService.ProductPath("p", null))).isInstanceOf(RuntimeException.class);
        login("PLATFORM_ADMIN", "1");
        service.assign("p", new CategoryTreeManagementService.ProductPath("p", null));
        assertThat(assigned).containsKey("p");
    }
}
