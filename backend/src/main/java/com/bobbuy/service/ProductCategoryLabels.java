package com.bobbuy.service;

import com.bobbuy.model.Product;
import com.bobbuy.repository.CategoryTreeNodeRepository;
import java.util.Locale;
import org.springframework.stereotype.Service;

/** Shared display labels for the mobile list and bounded merchant archive. */
@Service
public class ProductCategoryLabels {
    private final ProductCategoryPathResolver categoryPaths;
    private final CategoryTreeNodeRepository categoryNodes;

    public ProductCategoryLabels(ProductCategoryPathResolver categoryPaths, CategoryTreeNodeRepository categoryNodes) {
        this.categoryPaths = categoryPaths;
        this.categoryNodes = categoryNodes;
    }

    public java.util.Map<String,String> categoryLabels(java.util.List<Product> products,Locale locale) {
        var resolved=categoryPaths.resolveAll(products);
        var leaves=new java.util.HashMap<String,com.bobbuy.model.CategoryTreeNode>();
        categoryNodes.findAllById(resolved.values().stream().map(com.bobbuy.service.ProductCategoryPathResolver.ResolvedCategory::categoryId).distinct().toList()).forEach(n->leaves.put(n.getId(),n));
        var nodes=new java.util.HashMap<>(leaves);
        var ancestors=leaves.values().stream().flatMap(n->n.getFullPath().stream()).filter(id->!nodes.containsKey(id)).distinct().toList();
        if(!ancestors.isEmpty())categoryNodes.findAllById(ancestors).forEach(n->nodes.put(n.getId(),n));
        var result=new java.util.HashMap<String,String>();
        resolved.forEach((productId,path)->{var leaf=leaves.get(path.categoryId());if(leaf!=null){var names=new java.util.ArrayList<String>();for(var id:leaf.getFullPath()){var node=nodes.get(id);if(node!=null){var name=node.getName().get(locale.toLanguageTag());if(name==null||name.isBlank())name=node.getName().get("ja-JP");if(name!=null&&!name.isBlank())names.add(name);}}result.put(productId,String.join(" › ",names));}});
        return result;
    }
}
