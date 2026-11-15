package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.CategoryTreeNode;
import com.bobbuy.model.ProductPrimaryCategoryPath;
import com.bobbuy.repository.CategoryTreeNodeRepository;
import com.bobbuy.repository.ProductPrimaryCategoryPathRepository;
import com.bobbuy.repository.ProductRepository;
import com.bobbuy.security.MerchantScope;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class CategoryTreeManagementService {
    public record Node(String id, String parentId, Map<String,String> name, List<String> fullPath, int sortOrder, long productCount) {}
    public record Edit(String parentId, Map<String,String> name, Integer sortOrder) {}
    public record ProductPath(String productId, String categoryNodeId) {}
    private static final Set<String> LOCALES=Set.of("zh-CN","zh-TW","en-US","ja-JP");
    private final CategoryTreeNodeRepository nodes;
    private final ProductPrimaryCategoryPathRepository paths;
    private final ProductRepository products;
    public CategoryTreeManagementService(CategoryTreeNodeRepository nodes, ProductPrimaryCategoryPathRepository paths, ProductRepository products){this.nodes=nodes;this.paths=paths;this.products=products;}
    private static ApiException invalid(){return new ApiException(ErrorCode.INVALID_REQUEST,"error.category.invalid");}
    private Map<String,String> names(Map<String,String> input){
        if(input==null||input.isEmpty()||!LOCALES.containsAll(input.keySet()))throw invalid();
        var result=new LinkedHashMap<String,String>();input.forEach((locale,value)->{if(value==null||value.isBlank()||value.length()>200)throw invalid();result.put(locale,value.trim());});
        if(!result.containsKey("ja-JP"))throw invalid();return result;
    }
    @Transactional(readOnly=true) public List<Node> list(){return nodes.findAll().stream().filter(node->node.getSystemKey()==null).sorted(Comparator.comparing(CategoryTreeNode::getFullPath,CategoryTreeManagementService::comparePath).thenComparingInt(CategoryTreeNode::getSortOrder)).map(this::view).toList();}
    private static int comparePath(List<String>a,List<String>b){for(int i=0;i<Math.min(a.size(),b.size());i++){int c=a.get(i).compareTo(b.get(i));if(c!=0)return c;}return Integer.compare(a.size(),b.size());}
    private Node view(CategoryTreeNode n){return new Node(n.getId(),n.getParentId(),Map.copyOf(n.getName()),List.copyOf(n.getFullPath()),n.getSortOrder(),paths.countByCategoryNodeId(n.getId()));}
    @Transactional public Node create(Edit edit){
        var parent=edit.parentId()==null?null:nodes.findById(edit.parentId()).filter(value->value.getSystemKey()==null).orElseThrow(CategoryTreeManagementService::invalid);
        String id=UUID.randomUUID().toString();var full=new ArrayList<String>();if(parent!=null)full.addAll(parent.getFullPath());full.add(id);
        int order=edit.sortOrder()==null?nodes.findAllByParentId(edit.parentId()).size():Math.max(0,edit.sortOrder());
        return view(nodes.save(new CategoryTreeNode(id,edit.parentId(),names(edit.name()),full,order,null)));
    }
    @Transactional public Node update(String id, Edit edit){
        var node=nodes.findById(id).orElseThrow(CategoryTreeManagementService::invalid);if(node.getSystemKey()!=null)throw invalid();
        if(edit.name()!=null)node.setName(names(edit.name()));if(edit.sortOrder()!=null)node.setSortOrder(Math.max(0,edit.sortOrder()));
        if(!Objects.equals(node.getParentId(),edit.parentId()))move(node,edit.parentId());return view(nodes.save(node));
    }
    private void move(CategoryTreeNode node,String parentId){
        var parent=parentId==null?null:nodes.findById(parentId).orElseThrow(CategoryTreeManagementService::invalid);
        if(parent!=null&&(parent.getId().equals(node.getId())||parent.getFullPath().contains(node.getId())))throw invalid();
        var old=List.copyOf(node.getFullPath());var prefix=new ArrayList<String>();if(parent!=null)prefix.addAll(parent.getFullPath());prefix.add(node.getId());node.setParentId(parentId);node.setFullPath(prefix);
        for(var child:nodes.findAll())if(!child.getId().equals(node.getId())&&child.getFullPath().size()>old.size()&&child.getFullPath().subList(0,old.size()).equals(old)){var next=new ArrayList<>(prefix);next.addAll(child.getFullPath().subList(old.size(),child.getFullPath().size()));child.setFullPath(next);nodes.save(child);}
    }
    @Transactional public void delete(String id){var node=nodes.findById(id).orElseThrow(CategoryTreeManagementService::invalid);if(node.getSystemKey()!=null||nodes.existsByParentId(id)||paths.countByCategoryNodeId(id)>0)throw invalid();nodes.delete(node);}
    @Transactional(readOnly=true) public ProductPath product(String productId){owned(productId);return new ProductPath(productId,paths.findById(productId).map(ProductPrimaryCategoryPath::getCategoryNodeId).orElse(null));}
    @Transactional public ProductPath assign(String productId, ProductPath input){owned(productId);String id=input==null?null:input.categoryNodeId();if(id==null||id.isBlank())paths.deleteById(productId);else {var node=nodes.findById(id).orElseThrow(CategoryTreeManagementService::invalid);if(node.getSystemKey()!=null)paths.deleteById(productId);else paths.save(new ProductPrimaryCategoryPath(productId,id));}return product(productId);}
    private void owned(String id){var merchant=MerchantScope.current();products.findById(id).filter(p->merchant!=null&&merchant.equals(p.getMerchantId())).orElseThrow(CategoryTreeManagementService::invalid);}
}
