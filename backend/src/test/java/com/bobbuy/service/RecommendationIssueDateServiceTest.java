package com.bobbuy.service;

import com.bobbuy.api.RecommendationIssueDateRequest;
import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.BobbuyAuthenticatedUser;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RecommendationIssueDateServiceTest {
    final RecommendationPostRepository posts=mock(RecommendationPostRepository.class);
    final UserRepository users=mock(UserRepository.class);
    final RecommendationArticleService articles=mock(RecommendationArticleService.class);
    final AuditLogService audit=mock(AuditLogService.class);
    final RecommendationIssueDateService service=new RecommendationIssueDateService(posts,users,articles,audit);
    final RecommendationPost row=new RecommendationPost();
    final String hash="a".repeat(64);
    void authenticate(Role role){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new BobbuyAuthenticatedUser(7L,"synthetic","Synthetic",Set.of(role)),null,List.of(new SimpleGrantedAuthority("ROLE_"+role.name()))));}
    @BeforeEach void setup(){
        authenticate(Role.AGENT);row.id=12L;row.merchantId=7L;row.version=3;row.title="Original title";row.body="Original body";
        row.published=true;row.publishedAt=Instant.parse("2026-11-01T00:00:00Z");row.publisherId=7L;row.publisherName="Original publisher";
        when(users.lockById(7L)).thenReturn(Optional.of(new User(7L,"Synthetic",Role.AGENT,0)));
        when(posts.findOwnedForUpdate(12L,7L)).thenReturn(Optional.of(row));when(posts.findByIdAndMerchantId(12L,7L)).thenReturn(Optional.of(row));
        when(posts.saveAndFlush(row)).thenAnswer(i->{row.version++;return row;});
    }
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    RecommendationIssueDateRequest request(LocalDate date,String ref,String sourceHash,long version,boolean reviewed){return new RecommendationIssueDateRequest(date,ref,sourceHash,version,reviewed);}
    RecommendationIssueDateRequest valid(){return request(LocalDate.of(2026,10,31),"message:synthetic-mail-123",hash.toUpperCase(Locale.ROOT),3,true);}
    void reviewed(LocalDate date){row.issueDate=date;row.issueDateSourceRef="message:old-source";row.issueDateSourceHash=hash;row.issueDateReviewedBy=7L;row.issueDateReviewedAt=Instant.parse("2026-11-01T00:00:00Z");}
    @Test void persistsReviewedCalendarEvidenceWithServerIdentityAndKeepsPublicationFacts(){
        var result=service.save(12L,valid());assertThat(result.issueDate()).isEqualTo(LocalDate.of(2026,10,31));assertThat(result.source()).isEqualTo("REVIEWED_SOURCE");
        assertThat(result.reviewedBy()).isEqualTo(7L);assertThat(result.reviewedAt()).isNotNull();assertThat(result.sourceHash()).isEqualTo(hash);assertThat(result.version()).isEqualTo(4);
        assertThat(row.issueDate).isEqualTo(result.issueDate());assertThat(row.issueDateSourceRef).isEqualTo("message:synthetic-mail-123");
        assertThat(row.title).isEqualTo("Original title");assertThat(row.body).isEqualTo("Original body");assertThat(row.published).isTrue();assertThat(row.publishedAt).isEqualTo(Instant.parse("2026-11-01T00:00:00Z"));assertThat(row.publisherName).isEqualTo("Original publisher");
        var order=inOrder(users,posts,articles,audit);order.verify(users).lockById(7L);order.verify(posts).findOwnedForUpdate(12L,7L);order.verify(articles).snapshot(row);order.verify(posts).saveAndFlush(row);order.verify(articles).snapshot(row);order.verify(audit).logStatusChange("RecommendationIssueDate",12L,"UNKNOWN",LocalDate.of(2026,10,31)+"#"+hash,7L);
    }
    @Test void staleVersionRefusesWithoutHistoryOrWrite(){row.version=4;assertThatThrownBy(()->service.save(12L,valid())).isInstanceOf(RecommendationIssueDateService.Changed.class);verify(posts,never()).saveAndFlush(any());verifyNoInteractions(articles,audit);}
    @Test void rejectedSourceReviewNeverTouchesPostOrHistory(){
        for(String ref:List.of("javascript:alert(1)","http://example.invalid/source","https://user:secret@example.invalid/source","https://example.invalid/source#fragment","https://example.invalid/a b","message:","not-a-source"))assertThatThrownBy(()->service.save(12L,request(LocalDate.of(2026,1,1),ref,hash,3,true))).isInstanceOf(ApiException.class);
        for(var invalid:List.of(request(null,"message:source",hash,3,true),request(LocalDate.of(0,1,1),"message:source",hash,3,true),request(LocalDate.of(2026,1,1),"message:source","wrong",3,true),request(LocalDate.of(2026,1,1),"message:source",hash,3,false),request(LocalDate.of(2026,1,1),"message:source",hash,-1,true)))assertThatThrownBy(()->service.save(12L,invalid)).isInstanceOf(ApiException.class);
        verifyNoInteractions(posts,articles,audit);
    }
    @Test void customerAndAnonymousCannotReadOrWriteEvenWithKnownPostId(){
        authenticate(Role.CUSTOMER);assertThatThrownBy(()->service.get(12L)).isInstanceOf(ApiException.class);assertThatThrownBy(()->service.save(12L,valid())).isInstanceOf(ApiException.class);
        SecurityContextHolder.clearContext();assertThatThrownBy(()->service.get(12L)).isInstanceOf(ApiException.class);assertThatThrownBy(()->service.save(12L,valid())).isInstanceOf(ApiException.class);verifyNoInteractions(posts,users,articles,audit);
    }
    @Test void crossMerchantLookupIsBoundToAuthenticatedOwner(){when(posts.findOwnedForUpdate(12L,7L)).thenReturn(Optional.empty());assertThatThrownBy(()->service.save(12L,valid())).isInstanceOfSatisfying(ApiException.class,e->assertThat(e.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));verify(posts).findOwnedForUpdate(12L,7L);verify(posts,never()).saveAndFlush(any());verifyNoInteractions(articles,audit);}
    @Test void sameFactsAtCurrentVersionDoNotRewriteReviewerTimeOrHistory(){
        reviewed(valid().issueDate());row.issueDateSourceRef=valid().sourceRef();Instant timestamp=row.issueDateReviewedAt;
        var result=service.save(12L,valid());assertThat(result.reviewedAt()).isEqualTo(timestamp);assertThat(result.version()).isEqualTo(3);verify(posts,never()).saveAndFlush(any());verifyNoInteractions(articles,audit);
    }
    @Test void correctedDateRetainsBeforeAndAfterEvidenceAndAcceptsHttpsReference(){
        reviewed(LocalDate.of(2026,10,1));var dates=new ArrayList<LocalDate>();doAnswer(i->{dates.add(((RecommendationPost)i.getArgument(0)).issueDate);return null;}).when(articles).snapshot(any());
        var result=service.save(12L,request(LocalDate.of(2026,10,2),"https://example.invalid/official-source?item=12","b".repeat(64),3,true));
        assertThat(dates).containsExactly(LocalDate.of(2026,10,1),LocalDate.of(2026,10,2));assertThat(result.sourceRef()).isEqualTo("https://example.invalid/official-source?item=12");
    }
    @Test void absentOrPartialReviewReadsUnknownWithoutLeakingUnreviewedReference(){
        assertThat(service.get(12L).source()).isEqualTo("UNKNOWN");row.issueDate=LocalDate.of(2026,1,1);row.issueDateSourceRef="message:unreviewed";
        var unknown=service.get(12L);assertThat(unknown.issueDate()).isNull();assertThat(unknown.sourceRef()).isNull();assertThat(unknown.reviewedBy()).isNull();
        reviewed(LocalDate.of(2026,10,1));assertThat(service.get(12L).source()).isEqualTo("REVIEWED_SOURCE");
    }
}
