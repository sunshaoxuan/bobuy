package com.bobbuy.service;
import com.bobbuy.api.response.ApiException;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class ProductRatingServiceTest {
 ProductRepository products=mock(ProductRepository.class);ProductRatingRepository ratings=mock(ProductRatingRepository.class);
 ProductRatingService service=new ProductRatingService(products,ratings);
 @BeforeEach void setup(){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("agent-1",null,List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));}
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 Product product(String id,long owner,ProductVisibility visibility){var p=new Product();p.setId(id);p.setMerchantId(owner);p.setVisibilityStatus(visibility);return p;}
 ProductRating row(String id,long owner,String stars,boolean visible){var r=new ProductRating();r.productId=id;r.merchantId=owner;r.stars=stars==null?null:new BigDecimal(stars);r.publicVisible=visible;r.version=2;return r;}
 @Test void absentRatingIsNullAndHidden(){when(products.findById("p")).thenReturn(Optional.of(product("p",1,ProductVisibility.PUBLIC)));when(ratings.findById("p")).thenReturn(Optional.empty());assertThat(service.get("p")).isEqualTo(new ProductRatingService.Value(null,false,0));verify(ratings,never()).saveAndFlush(any());}
 @Test void rejectsInvalidScoresAndUnreviewedPublication(){for(var n:List.of("-0.5","5.5","4.25"))assertThatThrownBy(()->ProductRatingService.validate(new ProductRatingService.Input(new BigDecimal(n),false,0,true))).isInstanceOf(ApiException.class);assertThatThrownBy(()->ProductRatingService.validate(new ProductRatingService.Input(null,true,0,true))).isInstanceOf(ApiException.class);assertThatThrownBy(()->ProductRatingService.validate(new ProductRatingService.Input(BigDecimal.ONE,true,0,false))).isInstanceOf(ApiException.class);}
 @Test void permitsActualZeroHalfStarsAndNullHidden(){for(var n:List.of("0","0.5","4.5","5.0"))ProductRatingService.validate(new ProductRatingService.Input(new BigDecimal(n),true,0,true));ProductRatingService.validate(new ProductRatingService.Input(null,false,0,true));}
 @Test void refusesForeignProductAndUnauthenticatedRead(){when(products.findById("p")).thenReturn(Optional.of(product("p",2,ProductVisibility.PUBLIC)));assertThatThrownBy(()->service.get("p")).isInstanceOf(ApiException.class);verifyNoInteractions(ratings);SecurityContextHolder.clearContext();assertThatThrownBy(()->service.get("p")).isInstanceOf(ApiException.class);}
 @Test void serializesCreationAndDoesNotChangeProductFacts(){var p=product("p",1,ProductVisibility.PUBLIC);p.setBasePrice(123);when(products.lockById("p")).thenReturn(Optional.of(p));when(ratings.findById("p")).thenReturn(Optional.empty());when(ratings.saveAndFlush(any())).thenAnswer(a->a.getArgument(0));assertThat(service.save("p",new ProductRatingService.Input(new BigDecimal("4.5"),true,0,true))).isEqualTo(new ProductRatingService.Value(new BigDecimal("4.5"),true,1));assertThat(p.getBasePrice()).isEqualTo(123);verify(products,never()).save(any());}
 @Test void rejectsStaleVersionWithoutWriting(){when(products.lockById("p")).thenReturn(Optional.of(product("p",1,ProductVisibility.PUBLIC)));when(ratings.findById("p")).thenReturn(Optional.of(row("p",1,"3",false)));assertThatThrownBy(()->service.save("p",new ProductRatingService.Input(new BigDecimal("5"),true,1,true))).isInstanceOf(ApiException.class);verify(ratings,never()).saveAndFlush(any());}
 @Test void publicProjectionExcludesHiddenUnratedForeignAndPrivateProducts(){var owners=Map.of("yes",1L,"hidden",1L,"null",1L,"foreign",1L,"private",1L);when(products.findAllById(owners.keySet())).thenReturn(List.of(product("yes",1,ProductVisibility.PUBLIC),product("hidden",1,ProductVisibility.PUBLIC),product("null",1,ProductVisibility.PUBLIC),product("foreign",1,ProductVisibility.PUBLIC),product("private",1,ProductVisibility.DRAFTER_ONLY)));when(ratings.findAllById(any())).thenReturn(List.of(row("yes",1,"4.5",true),row("hidden",1,"5",false),row("null",1,null,true),row("foreign",2,"5",true)));assertThat(service.publicRatings(owners)).containsExactly(entry("yes",new BigDecimal("4.5")));}
}
