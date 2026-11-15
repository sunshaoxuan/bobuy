package com.bobbuy.repository;

import com.bobbuy.model.CategoryTreeNode;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryTreeNodeRepository extends JpaRepository<CategoryTreeNode, String> {
    java.util.List<CategoryTreeNode> findAllByParentId(String parentId);
    boolean existsByParentId(String parentId);
}
