package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.model.RecommendationImage;
import com.bobbuy.repository.*;
import com.bobbuy.security.BobbuyAuthenticatedUser;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Images belong to the existing shared category tree; uploads retain their actor identity. */
@Service
public class CategoryImageService {
 private final CategoryTreeNodeRepository nodes;
 private final RecommendationImageRepository images;
 private final MediaBinaryService binaries;
 public CategoryImageService(CategoryTreeNodeRepository nodes,RecommendationImageRepository images,MediaBinaryService binaries){this.nodes=nodes;this.images=images;this.binaries=binaries;}
 /** Public preload hints only: no labels, counts, product eligibility or private media.
  * Empty slots retain the existing root order. This read never waits for the product projection. */
 @Transactional(readOnly=true) public java.util.List<String> publicHints(){
  String prefix="/api/storefront/recommendation-images/";
  var roots=nodes.findAll().stream().filter(n->n.getParentId()==null&&n.getSystemKey()==null)
   .sorted(java.util.Comparator.comparingInt(com.bobbuy.model.CategoryTreeNode::getSortOrder).thenComparing(com.bobbuy.model.CategoryTreeNode::getId)).toList();
  var ids=roots.stream().map(com.bobbuy.model.CategoryTreeNode::getImageUrl).filter(java.util.Objects::nonNull)
   .filter(url->url.startsWith(prefix)&&url.substring(prefix.length()).matches("[a-zA-Z0-9-]+"))
   .map(url->url.substring(prefix.length())).distinct().toList();
  var allowed=new java.util.HashSet<String>();if(!ids.isEmpty())images.publicIds(ids).forEach(id->allowed.add(prefix+id));
  return roots.stream().map(n->allowed.contains(n.getImageUrl())?n.getImageUrl():"").toList();
 }
 @Transactional public String upload(String id,MultipartFile file){
  var auth=SecurityContextHolder.getContext().getAuthentication();
  if(auth==null||!(auth.getPrincipal() instanceof BobbuyAuthenticatedUser user)||user.id()==null||auth.getAuthorities().stream().noneMatch(a->a.getAuthority().equals("ROLE_AGENT")||a.getAuthority().equals("ROLE_PLATFORM_ADMIN")))throw new ApiException(ErrorCode.FORBIDDEN,"error.forbidden");
  nodes.lockTree().orElseThrow(()->new ApiException(ErrorCode.INVALID_REQUEST,"error.category.invalid"));
  var node=nodes.findById(id).filter(n->n.getSystemKey()==null&&n.getFullPath()!=null&&n.getFullPath().size()>=1&&n.getFullPath().size()<=2).orElseThrow(()->new ApiException(ErrorCode.INVALID_REQUEST,"error.category.invalid"));
  var checked=RecommendationImageValidator.validate(file);
  String hash=MediaBinaryService.sha(("category-public:"+checked.hash()).getBytes(StandardCharsets.UTF_8));
  var image=images.findByMerchantIdAndImageHash(user.id(),hash).map(existing->binaries.reuse(existing,checked.content())).orElseGet(()->{
   var value=new RecommendationImage();value.id=UUID.randomUUID().toString();value.merchantId=user.id();value.imageHash=hash;value.contentType=checked.contentType();value.content=checked.content();value.accessScope="PUBLIC";return binaries.persist(value);
  });
  String url="/api/storefront/recommendation-images/"+image.id;
  node.setImageUrl(url);nodes.save(node);return url;
 }
}
