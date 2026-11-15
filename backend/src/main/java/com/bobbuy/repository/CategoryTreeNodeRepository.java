package com.bobbuy.repository;

import com.bobbuy.model.CategoryTreeNode;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryTreeNodeRepository extends JpaRepository<CategoryTreeNode, String> {
    // Serialize tree writers, including imports and assignments, on the permanent system row.
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select n from CategoryTreeNode n where n.systemKey='UNCATEGORIZED'")
    java.util.Optional<CategoryTreeNode> lockTree();
    java.util.List<CategoryTreeNode> findAllByParentId(String parentId);
    boolean existsByParentId(String parentId);
}
