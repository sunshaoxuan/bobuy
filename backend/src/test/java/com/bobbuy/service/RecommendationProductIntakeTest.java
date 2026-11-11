package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.*;
import java.time.LocalDateTime;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class RecommendationProductIntakeTest {
 ProductRepository products=mock(ProductRepository.class);UserRepository users=mock(UserRepository.class);RecommendationImageRepository images=mock(RecommendationImageRepository.class);MediaBinaryService binaries=mock(MediaBinaryService.class);RecommendationService rec=mock(RecommendationService.class);
 RecommendationProductIntake service=new RecommendationProductIntake(products,users,images,binaries,rec);Map<String,Product> rows=new HashMap<>();
 RecommendationFacts facts=new RecommendationFacts("合成テスト商品","00123",null,null,null,null,null,null,null,null,null,null,null,null,null,null);
 RecommendationService.Detail detail=new RecommendationService.Detail(new RecommendationService.Summary(4L,"Draft",false,1,LocalDateTime.now(),null,null,null,1L,Map.of()),"Original",List.of(),null,null,Map.of(),null);
 RecommendationProductIntake.Input input(boolean display){return new RecommendationProductIntake.Input("synthetic-request-123",facts,"2-pack","Synthetic",true,display,1,null,List.of());}
 @BeforeEach void setup(){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("agent-1","",List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));when(users.lockById(1L)).thenReturn(Optional.of(mock(User.class)));when(rec.get(4L,false)).thenReturn(detail);when(products.lockById(anyString())).thenAnswer(i->Optional.ofNullable(rows.get(i.getArgument(0))));when(products.findAllByMerchantIdAndItemNumber(1L,"00123")).thenReturn(List.of());when(products.saveAndFlush(any())).thenAnswer(i->{Product p=i.getArgument(0);p.setRecordVersion(0L);rows.put(p.getId(),p);return p;});when(binaries.persist(any())).thenAnswer(i->i.getArgument(0));when(rec.fromProduct(anyLong(),anyString(),anyLong(),any(),anyLong(),anyBoolean())).thenReturn(detail);}
 @AfterEach void cleanup(){SecurityContextHolder.clearContext();}
 @Test void clueOnlyIsPrivateAndNeverPersistedOrLinkedEvenOnRetry(){var image=new RecommendationImageValidator.Image("hash","image/png",new byte[]{1});var first=service.save(4L,input(false),image,List.of());var second=service.save(4L,input(false),image,List.of());assertEquals(first.productId(),second.productId());assertTrue(first.created());assertFalse(second.created());var p=rows.get(first.productId());assertEquals(ProductVisibility.DRAFTER_ONLY,p.getVisibilityStatus());assertEquals(0,p.getBasePrice());assertNull(p.getSale());assertEquals("2-pack",p.getCatalogData().specification().get("ja-JP"));verifyNoInteractions(binaries,images);verify(rec,never()).fromProduct(anyLong(),anyString(),anyLong(),any(),anyLong(),anyBoolean());verify(products,times(1)).saveAndFlush(any());}
 @Test void explicitPhotoIsTypedAsUserProvidedAndMasterPrecedesLink(){service.save(4L,input(true),new RecommendationImageValidator.Image("hash","image/png",new byte[]{1}),List.of());var p=rows.values().iterator().next();assertEquals("USER_PROVIDED",p.getMediaGallery().get(0).getSourceType());assertEquals("urn:bobuy:user-upload:hash",p.getMediaGallery().get(0).getSourceUrl());var order=inOrder(products,rec);order.verify(products).saveAndFlush(any());order.verify(rec).fromProduct(eq(4L),eq(p.getId()),eq(0L),eq(facts),eq(1L),eq(true));}
 @Test void exactItemAndSpecDoesNotCreateDuplicate(){var p=new Product();p.setCatalogData(new ProductCatalogData(Map.of("ja-JP","2-pack"),null,null,List.of(),null,null,1L,java.time.Instant.now()));when(products.findAllByMerchantIdAndItemNumber(1L,"00123")).thenReturn(List.of(p));assertThrows(Exception.class,()->service.save(4L,input(false),null,List.of()));verify(products,never()).saveAndFlush(any());}
 @Test void customerCannotCreateOrStore(){SecurityContextHolder.clearContext();assertThrows(Exception.class,()->service.save(4L,input(true),null,List.of()));verifyNoInteractions(users,products,binaries);}
}
