package com.bobbuy.service;

import com.bobbuy.api.RecommendationIssueDateRequest;
import com.bobbuy.api.response.*;
import com.bobbuy.model.RecommendationPost;
import com.bobbuy.repository.RecommendationPostRepository;
import com.bobbuy.repository.RecommendationSourceArtifactRepository;
import com.bobbuy.repository.UserRepository;
import com.bobbuy.security.MerchantScope;
import java.net.URI;
import java.time.*;
import java.util.Locale;
import java.util.Objects;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RecommendationIssueDateService {
    private final RecommendationPostRepository posts;
    private final UserRepository users;
    private final RecommendationArticleService articles;
    private final AuditLogService audit;
    private final RecommendationSourceArtifactRepository artifacts;
    public static final String RAW="recommendation-issue-date-source-v1",HTML="recommendation-issue-date-source-html-utf8-v1",LEGACY="legacy-operator-supplied",MANUAL="manual-source-unavailable";
    public RecommendationIssueDateService(RecommendationPostRepository posts,UserRepository users,RecommendationArticleService articles,AuditLogService audit,RecommendationSourceArtifactRepository artifacts){this.posts=posts;this.users=users;this.articles=articles;this.audit=audit;this.artifacts=artifacts;}
    public record Review(LocalDate issueDate,String sourceRef,String sourceHash,Long reviewedBy,Instant reviewedAt,String source,long version,String algorithm,boolean sourceAvailable,String computedHash,boolean hashEditable){
        public Review(LocalDate issueDate,String sourceRef,String sourceHash,Long reviewedBy,Instant reviewedAt,String source,long version){this(issueDate,sourceRef,sourceHash,reviewedBy,reviewedAt,source,version,null,false,null,true);}
    }
    public static final class Changed extends RuntimeException {}
    private static ApiException invalid(){return new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.invalid");}
    private static ApiException missing(){return new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.recommendation.not_found");}
    private static Long owner(){Long id=MerchantScope.current();if(id==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");return id;}
    public static String sourceHash(byte[] bytes,String algorithm){
        if(bytes==null||bytes.length==0||!RAW.equals(algorithm)&&!HTML.equals(algorithm))throw new IllegalArgumentException("Unsupported source artifact");
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}
    }
    private Review view(RecommendationPost p){
        var artifact=p.issueDateSourceRef==null?java.util.Optional.<com.bobbuy.model.RecommendationSourceArtifact>empty():artifacts.findBySourceRef(p.issueDateSourceRef);
        boolean available=artifact.isPresent();String computed=artifact.map(a->sourceHash(a.content,a.algorithm)).orElse(null);
        return p.hasReviewedIssueDate()?new Review(p.issueDate,p.issueDateSourceRef,p.issueDateSourceHash,p.issueDateReviewedBy,p.issueDateReviewedAt,"REVIEWED_SOURCE",p.version,p.issueDateSourceAlgorithm,available,computed,!available):new Review(null,null,null,null,null,"UNKNOWN",p.version,null,false,null,true);
    }
    @Transactional(readOnly=true) public Review get(Long id){return view(posts.findByIdAndMerchantId(id,owner()).orElseThrow(RecommendationIssueDateService::missing));}
    private static String sourceReference(String value){
        if(value==null||value.isBlank()||value.length()>2048||value.chars().anyMatch(c->Character.isISOControl(c)||Character.isWhitespace(c)))throw invalid();
        try{
            var uri=URI.create(value);
            boolean https="https".equalsIgnoreCase(uri.getScheme())&&uri.getHost()!=null&&uri.getRawUserInfo()==null&&uri.getRawFragment()==null;
            boolean message="message".equalsIgnoreCase(uri.getScheme())&&uri.isOpaque()&&!uri.getRawSchemeSpecificPart().isBlank()&&uri.getRawFragment()==null;
            if(!https&&!message)throw invalid();return value;
        }catch(IllegalArgumentException e){throw invalid();}
    }
    @Transactional public Review save(Long id,RecommendationIssueDateRequest request){
        Long reviewer=owner();users.lockById(reviewer).orElseThrow(()->new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden"));
        if(request==null||!request.reviewed()||request.issueDate()==null||request.issueDate().getYear()<1||request.issueDate().getYear()>9999||request.version()<0)throw invalid();
        String ref=sourceReference(request.sourceRef());var artifact=artifacts.findBySourceRef(ref);
        String hash,algorithm;
        if(artifact.isPresent()){var a=artifact.get();hash=sourceHash(a.content,a.algorithm);algorithm=a.algorithm;if(!hash.equals(a.sha256))throw new IllegalStateException("Stored source artifact hash mismatch");if(request.sourceHash()!=null&&!request.sourceHash().isBlank()&&!hash.equalsIgnoreCase(request.sourceHash()))throw invalid();}
        else{if(request.sourceHash()==null||!request.sourceHash().matches("[0-9a-fA-F]{64}"))throw invalid();hash=request.sourceHash().toLowerCase(Locale.ROOT);algorithm=MANUAL;}
        var post=posts.findOwnedForUpdate(id,reviewer).orElseThrow(RecommendationIssueDateService::missing);
        if(post.version!=request.version())throw new Changed();
        if(post.hasReviewedIssueDate()&&Objects.equals(post.issueDate,request.issueDate())&&Objects.equals(post.issueDateSourceRef,ref)&&Objects.equals(post.issueDateSourceHash,hash))return view(post);
        String before=post.hasReviewedIssueDate()?post.issueDate+"#"+post.issueDateSourceHash:"UNKNOWN";
        articles.snapshot(post);
        post.issueDate=request.issueDate();post.issueDateSourceRef=ref;post.issueDateSourceHash=hash;post.issueDateSourceAlgorithm=algorithm;post.issueDateReviewedBy=reviewer;
        post.issueDateReviewedAt=Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);post.updatedAt=LocalDateTime.now();
        posts.saveAndFlush(post);articles.snapshot(post);
        audit.logStatusChange("RecommendationIssueDate",post.id,before,post.issueDate+"#"+hash,reviewer);
        return view(post);
    }
}
