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
 @Transactional public String upload(String id,MultipartFile file){
  var auth=SecurityContextHolder.getContext().getAuthentication();
  if(auth==null||!(auth.getPrincipal() instanceof BobbuyAuthenticatedUser user)||user.id()==null||auth.getAuthorities().stream().noneMatch(a->a.getAuthority().equals("ROLE_AGENT")||a.getAuthority().equals("ROLE_PLATFORM_ADMIN")))throw new ApiException(ErrorCode.FORBIDDEN,"error.forbidden");
  nodes.lockTree().orElseThrow(()->new ApiException(ErrorCode.INVALID_REQUEST,"error.category.invalid"));
  var node=nodes.findById(id).filter(n->n.getSystemKey()==null&&n.getParentId()==null).orElseThrow(()->new ApiException(ErrorCode.INVALID_REQUEST,"error.category.invalid"));
  var checked=RecommendationImageValidator.validate(file);
  String hash=MediaBinaryService.sha(("category-public:"+checked.hash()).getBytes(StandardCharsets.UTF_8));
  var image=images.findByMerchantIdAndImageHash(user.id(),hash).map(existing->binaries.reuse(existing,checked.content())).orElseGet(()->{
   var value=new RecommendationImage();value.id=UUID.randomUUID().toString();value.merchantId=user.id();value.imageHash=hash;value.contentType=checked.contentType();value.content=checked.content();value.accessScope="PUBLIC";return binaries.persist(value);
  });
  String url="/api/storefront/recommendation-images/"+image.id;
  node.setImageUrl(url);nodes.save(node);return url;
 }
}
