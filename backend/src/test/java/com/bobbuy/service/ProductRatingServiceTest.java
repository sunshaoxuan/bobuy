package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.BobbuyAuthenticatedUser;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
class ProductRatingServiceTest {
 ProductRepository products=mock(ProductRepository.class);ProductReviewRepository reviews=mock(ProductReviewRepository.class);
 ProductRatingService service=new ProductRatingService(products,reviews);
 @BeforeEach void setup(){var user=new BobbuyAuthenticatedUser(2L,"user","User",Set.of(Role.CUSTOMER));SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user,null,List.of()));}
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 Product product(){var p=new Product();p.setId("p");p.setMerchantId(1L);p.setVisibilityStatus(ProductVisibility.PUBLIC);return p;}
 @Test void acceptsAllNineScoresAndRejectsOtherScores(){for(int n=2;n<=10;n++)ProductRatingService.validate(new ProductRatingService.Input(BigDecimal.valueOf(n).divide(BigDecimal.valueOf(2)),"",0));for(String n:List.of("0","0.5","1.1","4.25","5.5"))assertThatThrownBy(()->ProductRatingService.validate(new ProductRatingService.Input(new BigDecimal(n),"",0))).isInstanceOf(RuntimeException.class);assertThatThrownBy(()->ProductRatingService.validate(new ProductRatingService.Input(BigDecimal.ONE,"x".repeat(2001),0))).isInstanceOf(RuntimeException.class);}
 @Test void locksProductAndUsesAuthenticatedAuthor(){when(products.lockById("p")).thenReturn(Optional.of(product()));when(reviews.findByProductIdAndUserId("p",2L)).thenReturn(Optional.empty());when(reviews.saveAndFlush(any())).thenAnswer(a->a.getArgument(0));var result=service.save("p",new ProductRatingService.Input(new BigDecimal("4.5")," <script>text</script> ",0));assertThat(result.stars()).isEqualByComparingTo("4.5");assertThat(result.comment()).isEqualTo("<script>text</script>");assertThat(result.version()).isEqualTo(1);verify(products).lockById("p");verify(products,never()).save(any());}
 @Test void staleVersionNeverWrites(){when(products.lockById("p")).thenReturn(Optional.of(product()));var row=new ProductReview();row.version=2;when(reviews.findByProductIdAndUserId("p",2L)).thenReturn(Optional.of(row));assertThatThrownBy(()->service.save("p",new ProductRatingService.Input(BigDecimal.ONE,"",1))).isInstanceOf(org.springframework.orm.ObjectOptimisticLockingFailureException.class);verify(reviews,never()).saveAndFlush(any());}
 @Test void coherentAverageDistributionAndNoReviewState(){when(products.findById("p")).thenReturn(Optional.of(product()));when(reviews.buckets(List.of("p"))).thenReturn(List.of(new Object[]{"p",BigDecimal.ONE,1L},new Object[]{"p",new BigDecimal("2"),2L}));var summary=service.summary("p");assertThat(summary.count()).isEqualTo(3);assertThat(summary.sum()).isEqualByComparingTo("5");assertThat(summary.average()).isEqualByComparingTo("1.666667");assertThat(summary.distribution()).hasSize(9);assertThat(summary.distribution().stream().mapToLong(ProductRatingService.Bucket::count).sum()).isEqualTo(3);when(reviews.buckets(List.of("p"))).thenReturn(List.of());assertThat(service.summary("p").average()).isNull();}
 @Test void privateProductsCannotExposeReviewData(){var p=product();p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);when(products.findById("p")).thenReturn(Optional.of(p));assertThatThrownBy(()->service.summary("p")).isInstanceOf(RuntimeException.class);verifyNoInteractions(reviews);}
}
