package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.BobbuyAuthenticatedUser;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class CategoryImageServiceTest {
 final CategoryTreeNodeRepository nodes=mock(CategoryTreeNodeRepository.class);
 final RecommendationImageRepository images=mock(RecommendationImageRepository.class);
 final MediaBinaryService binaries=mock(MediaBinaryService.class);
 final CategoryImageService service=new CategoryImageService(nodes,images,binaries);
 final CategoryTreeNode root=new CategoryTreeNode("root",null,Map.of("ja-JP","Example"),List.of("root"),0,null);
 @BeforeEach void setup(){when(nodes.lockTree()).thenReturn(Optional.of(root));when(nodes.findById("root")).thenReturn(Optional.of(root));when(binaries.persist(any())).thenAnswer(c->c.getArgument(0));login("ROLE_AGENT");}
 void login(String role){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new BobbuyAuthenticatedUser(7L,"actor","Actor",Set.of()),"unused",List.of(new SimpleGrantedAuthority(role))));}
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 MockMultipartFile image(int color)throws Exception{var picture=new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB);picture.setRGB(0,0,color);var output=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(picture,"png",output);return new MockMultipartFile("file","image.png","image/png",output.toByteArray());}
 @Test void publicHintsKeepRootOrderButExposeOnlyExplicitPublicImageUrlsWithoutReadingBytes(){
  var later=new CategoryTreeNode("later",null,Map.of("ja-JP","Private label"),List.of("later"),2,null);later.setImageUrl("/api/storefront/recommendation-images/private");
  var child=new CategoryTreeNode("child","root",Map.of(),List.of("root","child"),0,null);child.setImageUrl("/api/storefront/recommendation-images/child");
  var system=new CategoryTreeNode("system",null,Map.of(),List.of("system"),0,"UNCATEGORIZED");system.setImageUrl("/api/storefront/recommendation-images/system");
  root.setImageUrl("/api/storefront/recommendation-images/public");
  when(nodes.findAll()).thenReturn(List.of(later,child,system,root));when(images.publicIds(any())).thenReturn(List.of("public"));SecurityContextHolder.clearContext();
  assertThat(service.publicHints()).containsExactly("/api/storefront/recommendation-images/public","");verify(images).publicIds(List.of("public","private"));verify(images,never()).findAllById(any());verifyNoInteractions(binaries);
  root.setImageUrl("https://external.invalid/image.png");later.setImageUrl(null);reset(images);assertThat(service.publicHints()).containsExactly("","");verifyNoInteractions(images);
 }
 @Test void forbidsCustomersBeforeStorage()throws Exception{login("ROLE_CUSTOMER");assertThatThrownBy(()->service.upload("root",image(1))).isInstanceOf(com.bobbuy.api.response.ApiException.class);verifyNoInteractions(nodes,images,binaries);}
 @Test void supportsDirectChildWithoutChangingRootAndRejectsDeepOrSystemNodes()throws Exception{
  var child=new CategoryTreeNode("child","root",Map.of(),List.of("root","child"),0,null);
  when(nodes.findById("child")).thenReturn(Optional.of(child));String url=service.upload("child",image(1));
  assertThat(child.getImageUrl()).isEqualTo(url);assertThat(root.getImageUrl()).isNull();verify(nodes).save(child);
  var deep=new CategoryTreeNode("deep","child",Map.of(),List.of("root","child","deep"),0,null);
  var system=new CategoryTreeNode("system",null,Map.of(),List.of("system"),0,"UNCATEGORIZED");
  when(nodes.findById("deep")).thenReturn(Optional.of(deep));when(nodes.findById("system")).thenReturn(Optional.of(system));
  clearInvocations(images,binaries,nodes);
  assertThatThrownBy(()->service.upload("deep",image(1))).isInstanceOf(com.bobbuy.api.response.ApiException.class);
  assertThatThrownBy(()->service.upload("system",image(1))).isInstanceOf(com.bobbuy.api.response.ApiException.class);
  verifyNoInteractions(images,binaries);verify(nodes,never()).save(any());
 }
 @Test void rejectsMalformedBytesWithoutStorage()throws Exception{assertThatThrownBy(()->service.upload("root",new MockMultipartFile("file","image.png","image/png","<svg/>".getBytes()))).isInstanceOf(com.bobbuy.api.response.ApiException.class);verifyNoInteractions(images,binaries);verify(nodes,never()).save(any());}

 @Test void supportsAdminReplacementAndReusesSameActorImage()throws Exception{login("ROLE_PLATFORM_ADMIN");String first=service.upload("root",image(1));assertThat(first).startsWith("/api/storefront/recommendation-images/");assertThat(root.getImageUrl()).isEqualTo(first);var saved=org.mockito.ArgumentCaptor.forClass(RecommendationImage.class);verify(binaries).persist(saved.capture());assertThat(saved.getValue().merchantId).isEqualTo(7L);assertThat(saved.getValue().accessScope).isEqualTo("PUBLIC");when(images.findByMerchantIdAndImageHash(7L,saved.getValue().imageHash)).thenReturn(Optional.of(saved.getValue()));when(binaries.reuse(eq(saved.getValue()),any())).thenReturn(saved.getValue());assertThat(service.upload("root",image(1))).isEqualTo(first);assertThat(service.upload("root",image(2))).isNotEqualTo(first);verify(nodes,times(3)).save(root);}
}
