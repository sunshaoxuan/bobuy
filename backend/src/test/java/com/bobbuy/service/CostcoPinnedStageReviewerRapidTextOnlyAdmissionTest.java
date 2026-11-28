package com.bobbuy.service;

import com.bobbuy.model.CostcoOnboardingJob;
import com.bobbuy.model.StorageCondition;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.bobbuy.service.CostcoOnboardingDecision.Stage;
import static com.bobbuy.service.CostcoOnboardingDecision.Verdict;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CostcoPinnedStageReviewerRapidTextOnlyAdmissionTest {
    private static final String INPUT = "a".repeat(64);
    private static final Instant NOW = Instant.parse("2026-11-28T00:00:00Z");

    @Test void admitsEvidenceBackedRapidCandidateWithoutRequiringAnOfficialImage() throws Exception {
        var mapper = new ObjectMapper().findAndRegisterModules();
        var gateway = new MockGateway(mapper);
        var store = new Store();
        var photoOutput = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2, 2,
                java.awt.image.BufferedImage.TYPE_INT_RGB), "png", photoOutput);
        byte[] photo = photoOutput.toByteArray();
        String photoHash = CostcoPinnedStageReviewer.digest(photo);
        store.bytes.put(photoHash, photo);
        byte[] page = "<h1>Costco item 53432</h1>".getBytes(StandardCharsets.UTF_8);
        String pageHash = CostcoPinnedStageReviewer.digest(page);
        store.bytes.put(pageHash, page);
        var receipt = new CostcoOfficialEvidence("page", URI.create("https://www.costco.co.jp/p/53432"),
                URI.create("https://www.costco.co.jp/p/53432"), pageHash, NOW, "text/html", null, null, List.of());
        var prior = List.of(accepted(Stage.INTAKE), accepted(Stage.IDENTITY), accepted(Stage.FACTS));
        var job = new CostcoOnboardingJob("rapid-job", "c".repeat(64), 7, "costco-jp", "JP", INPUT,
                "53432", photoHash, 4, CostcoOnboardingJob.State.AI_REVIEW, List.of(receipt), prior,
                null, null, null, NOW);

        var result = new CostcoPinnedStageReviewer(gateway, mapper, store).review(Stage.ADMISSION, job);

        assertNull(result.candidate().officialImageSha256());
        assertEquals("frozen-seafood",result.candidate().archiveDetails().categoryNodeId());
        assertEquals(StorageCondition.FROZEN,result.candidate().archiveDetails().storageCondition());
        assertTrue(gateway.prompt.contains("RAPID TEXT-ONLY ADMISSION"));
        assertTrue(gateway.prompt.contains("absence is expected and has no bearing on ADMISSION"));
        assertTrue(gateway.prompt.contains("candidate officialImageSha256 must be null"));
    }

    private static CostcoOnboardingDecision accepted(Stage stage) {
        var candidate = stage == Stage.FACTS
                ? new CostcoOnboardingDecision.Candidate("53432","Fixture brand","Fixture product",
                    null,"1 kg","1 pack",null,Map.of("ja-JP","テスト商品"),List.of(),List.of(),null,null,
                    new CostcoOnboardingDecision.ArchiveDetails("テスト説明","frozen-seafood",StorageCondition.FROZEN),
                    Map.of(),Map.of())
                : null;
        return new CostcoOnboardingDecision(stage, Verdict.ACCEPT, "fixture", "fixture",
                CostcoEvidenceAcquisitionPlanner.REQUIRED_NODE, INPUT, List.of(), "fixture", "fixture",
                "Accepted fixture stage", "53432", candidate,
                new CostcoOnboardingDecision.EngineTrace(INPUT, INPUT, 1, null, null, Map.of()));
    }

    private static final class MockGateway extends LlmGatewayPinnedTest.Fake {
        private final ObjectMapper mapper;
        private String prompt;

        private MockGateway(ObjectMapper mapper) { this.mapper = mapper; }

        @Override public PinnedCompletion generatePinned(URI required, String text, List<PinnedImage> images) {
            prompt = text;
            var candidate = new CostcoOnboardingDecision.Candidate("53432", "Fixture brand", "Fixture product",
                    null, "1 kg", "1 pack", null,
                    Map.of("zh-CN", "测试商品", "zh-TW", "測試商品", "ja-JP", "テスト商品", "en-US", "Test product"),
                    List.of("model"), List.of(), null, null, null,
                    Map.of("zh-CN", "1 千克", "zh-TW", "1 公斤", "ja-JP", "1 kg", "en-US", "1 kg"),
                    Map.of("zh-CN", "测试说明", "zh-TW", "測試說明", "ja-JP", "テスト説明", "en-US", "Test description"));
            try {
                String answer = mapper.writeValueAsString(Map.of("verdict", "ACCEPT", "reason",
                        "Identity, official text, category, and locales are supported", "identifiedItemNumber", "53432",
                        "candidate", candidate));
                return new PinnedCompletion(answer, "mock", "mock", required, 1, null, null);
            } catch (Exception error) {
                throw new AssertionError(error);
            }
        }
    }

    private static final class Store implements CostcoEvidenceStore {
        private final Map<String, byte[]> bytes = new HashMap<>();
        @Override public void put(CostcoOfficialEvidenceFetcher.Query query, CostcoOfficialEvidence receipt, byte[] value) {
            throw new UnsupportedOperationException();
        }
        @Override public byte[] readVerified(long merchantId, String sha256) { return bytes.get(sha256); }
    }
}
