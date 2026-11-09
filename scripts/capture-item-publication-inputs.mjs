/** Exact source-only V31 capture. No staging, builds, database, runtime or release acceptance. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const baselinePath='docs/reports/c2-cart-20261109/accepted-inputs.json';
const target='docs/reports/item-publication-20261109/accepted-inputs.json';
const candidatePaths=[
 'backend/src/main/java/com/bobbuy/api/RecommendationController.java',
 'backend/src/main/java/com/bobbuy/model/RecommendationItem.java',
 'backend/src/main/java/com/bobbuy/model/RecommendationPublicationSnapshot.java',
 'backend/src/main/java/com/bobbuy/repository/RecommendationItemRepository.java',
 'backend/src/main/java/com/bobbuy/service/ProductCatalogProjection.java',
 'backend/src/main/java/com/bobbuy/service/RecommendationPublication.java',
 'backend/src/main/java/com/bobbuy/service/RecommendationService.java',
 'backend/src/main/java/com/bobbuy/service/RecommendationTaxonomyService.java',
 'backend/src/main/java/com/bobbuy/service/ReferenceQuoteService.java',
 'backend/src/main/resources/db/migration/V31__recommendation_item_publication.sql',
 'backend/src/main/resources/messages_ja_JP.properties',
 'backend/src/main/resources/messages_zh_CN.properties',
 'backend/src/main/resources/messages_zh_TW.properties',
 'backend/src/main/resources/messages.properties',
 'backend/src/test/java/com/bobbuy/api/ProductCatalogIntegrationTest.java',
 'backend/src/test/java/com/bobbuy/api/ProductLifecycleIntegrationTest.java',
 'backend/src/test/java/com/bobbuy/api/ProductMarkerIntegrationTest.java',
 'backend/src/test/java/com/bobbuy/api/RecommendationClassificationTest.java',
 'backend/src/test/java/com/bobbuy/api/RecommendationCommerceTest.java',
 'backend/src/test/java/com/bobbuy/api/RecommendationIntegrationTest.java',
 'backend/src/test/java/com/bobbuy/api/RecommendationNodeTest.java',
 'backend/src/test/java/com/bobbuy/api/RecommendationItemPublicationIntegrationTest.java',
 'backend/src/test/java/com/bobbuy/api/RecommendationPublicationMigrationIntegrationTest.java',
 'backend/src/test/java/com/bobbuy/service/PublicBrowseProjectionCompatibilityTest.java',
 'backend/src/test/java/com/bobbuy/service/PublicCatalogRealProjectionNoAgentTest.java',
 'backend/src/test/java/com/bobbuy/service/PublicProductCatalogProjectionTest.java',
 'backend/src/test/java/com/bobbuy/service/PublicProductCatalogServiceTest.java',
 'backend/src/test/java/com/bobbuy/service/RecommendationItemPublicationTest.java',
 'backend/src/test/java/com/bobbuy/service/ReferenceQuoteTest.java',
 'backend/src/test/java/com/bobbuy/test/RecommendationPublicationFixtures.java',
 'docs/reports/RECOMMENDATION-ITEM-PUBLICATION-BACKEND-20261109.md',
 'docs/reports/RECOMMENDATION-ITEM-PUBLICATION-FRONTEND-20261109.md',
 'frontend/src/api.ts',
 'frontend/src/components/RecommendationClassification.tsx',
 'frontend/src/components/RecommendationClassificationPublication.test.tsx',
 'frontend/src/components/RecommendationFromProduct.test.tsx',
 'frontend/src/components/RecommendationFromProduct.tsx',
 'frontend/src/locales/en-US.ts',
 'frontend/src/locales/ja-JP.ts',
 'frontend/src/locales/zh-CN.ts',
 'frontend/src/locales/zh-TW.ts',
 'frontend/src/pages/Recommendations.test.tsx',
 'frontend/src/pages/Recommendations.tsx',
 'frontend/src/pages/RecommendationsItemPublication.test.tsx',
 'frontend/src/pages/RecommendationsRevisionRace.test.tsx',
 'frontend/src/recommendationPublicationApi.test.ts',
];
const articleInputs=[
 'backend/src/main/java/com/bobbuy/api/RecommendationController.java',
 'backend/src/main/java/com/bobbuy/service/RecommendationArticleService.java',
 'backend/src/main/java/com/bobbuy/service/RecommendationService.java',
 'backend/src/test/java/com/bobbuy/api/RecommendationArticleRevisionIntegrationTest.java',
 'backend/src/test/java/com/bobbuy/service/RecommendationArticleRevisionTest.java',
 'frontend/src/api.ts','frontend/src/components/ArticleLanguages.tsx',
 'frontend/src/components/PublishedArticleRevision.test.tsx','frontend/src/components/PublishedArticleRevision.tsx',
 'frontend/src/components/SafeArticleText.test.tsx','frontend/src/components/SafeArticleText.tsx',
 'frontend/src/locales/en-US.ts','frontend/src/locales/ja-JP.ts','frontend/src/locales/zh-CN.ts','frontend/src/locales/zh-TW.ts',
 'frontend/src/main.tsx','frontend/src/pages/LoginPage.test.tsx','frontend/src/pages/PublicRecommendations.tsx',
 'frontend/src/pages/RecommendationBrowse.tsx','frontend/src/pages/Recommendations.articleRevision.test.tsx',
 'frontend/src/pages/Recommendations.navigation.test.tsx','frontend/src/pages/Recommendations.test.tsx',
 'frontend/src/pages/Recommendations.tsx','frontend/src/pages/StoreNavigation.test.tsx',
 'docs/reports/ITEM-ARTICLE-INTEGRATION-20261109.md',
];
assert.equal(candidatePaths.length,46);
candidatePaths.push(...articleInputs.filter(path=>!candidatePaths.includes(path)));
const ciPaths=[
 '.github/workflows/ci.yml','scripts/prepare-ci-release-artifacts.py',
 'scripts/test_prepare_ci_release_artifacts.py','scripts/capture-item-publication-inputs.mjs',
 'backend/src/test/java/com/bobbuy/api/RecommendationPublicationRecoveryIntegrationTest.java',
 'docs/reports/ITEM-PUBLICATION-CI-20261109.md',
];
const protectedPaths=['scripts/local-test.ps1','docs/reports/REAL-PROJECTION-P2-20261107.md'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(args,input)=>{
 const r=spawnSync('git',args,{input,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
 assert.equal(r.status,0,r.stderr||String(r.error));return r.stdout.trim();
};
const canonical=file=>{
 const raw=fs.readFileSync(file);return raw.includes(0)?raw:Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n'));
};
const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
assert.equal(baseline.schemaBefore,27);assert.equal(baseline.schemaAfter,28);assert.equal(baseline.migrationChanges,true);
assert.equal(new Set(candidatePaths).size,candidatePaths.length);
const allowed=new Set([...candidatePaths,...ciPaths]);
for(const entry of baseline.sourceFiles)if(!allowed.has(entry.path)){
 assert.equal(sha(canonical(entry.path)),entry.gitLfSha256,'Unrelated inherited source drift: '+entry.path);
}
const paths=[...new Set([...baseline.sourceFiles.map(entry=>entry.path),...candidatePaths,...ciPaths])]
 .filter(file=>file!==target&&!protectedPaths.includes(file)).sort();
assert.ok(paths.every(file=>!file.startsWith('/')&&!file.startsWith('.task-tmp/')&&!file.split('/').includes('..')));
const oids=git(['hash-object','--stdin-paths'],paths.join('\n')+'\n').split('\n');
assert.equal(oids.length,paths.length);
const sourceFiles=paths.map((file,index)=>{
 const bytes=canonical(file);
 const blob=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(blob,oids[index],'Git canonical bytes differ: '+file);
 return {path:file,gitLfBytes:bytes.length,gitLfSha256:sha(bytes)};
});
const migrationRoot='backend/src/main/resources/db/migration/';
const migrations=sourceFiles.filter(entry=>entry.path.startsWith(migrationRoot))
 .map(entry=>({path:entry.path.slice(migrationRoot.length),bytes:entry.gitLfBytes,sha256:entry.gitLfSha256}));
assert.deepEqual(migrations.filter(entry=>entry.path!=='V31__recommendation_item_publication.sql'),baseline.migrations);
assert.equal(migrations.length,baseline.migrations.length+1);
assert.equal(migrations.find(entry=>entry.path==='V31__recommendation_item_publication.sql').sha256,
 'db1a7f96ea5017fabfadd5f52809fe0357816da6433ebb31d723deac900773a7');
assert.ok(!migrations.some(entry=>/^V(?:29|30)__/.test(entry.path)));
const required=new Set(baseline.requiredBackendClasses);
for(const file of candidatePaths.filter(file=>file.startsWith('backend/src/main/java/')&&file.endsWith('.java'))){
 const stem=file.slice('backend/src/main/java/'.length,-'.java'.length),name=stem.split('/').at(-1);
 required.add(stem+'.class');
 for(const match of fs.readFileSync(file,'utf8').matchAll(/public\s+(?:static\s+)?(?:final\s+)?(?:class|interface|record)\s+(\w+)/g))
  if(match[1]!==name)required.add(stem+'$'+match[1]+'.class');
}
const requiredBackendClasses=[...required].sort();
const baselineBytes=canonical(baselinePath);
assert.equal(crypto.createHash('sha1').update('blob '+baselineBytes.length+'\0').update(baselineBytes).digest('hex'),
 git(['hash-object','--path='+baselinePath,baselinePath]));
const manifest={
 candidate:'V31 individual publication plus live bf0 article revision and00e navigation; independent combined runtime pending',
 baseHead:git(['rev-parse','HEAD']),sourceDigestAlgorithm:'sha256-json-utf8-sourceFiles-v1',
 sourceDigest:sha(Buffer.from(JSON.stringify(sourceFiles))),
 lineEndingPolicy:'Exact canonical Git-filtered bytes, cross-checked by git hash-object; excludes self-referential accepted manifest and unrelated protected files.',
 sourceFiles,migrations,requiredBackendClasses,acceptedBackendClasses:null,
 compiledByteAcceptance:'PENDING_INDEPENDENT_ARTIFACT_QA',frontendFiles:null,
 previousProductionCoreJarSha256:'4475712c830410b082720df1085f18e7e9b14e3a19cb899aba72c8580693c7ec',
 productionBaselineObserved:{release:'20261109.4',schema:28,
  core:'bf0ca746f2612c797ad2427d6e204007e94fc04b',web:'00e60cd9d5df63e422156a1368508e6b07a757f5',
  evidenceSha256:'a41e3f608f661a3a807915a75540dc8f2553fd85746567b4a09565cad672849d',
  historicalObservationOnly:true,freshPreflightRequired:true,articleBaselineIntegrationRequired:false},
 retainedLiveArticle:{coreSource:'bf0ca746f2612c797ad2427d6e204007e94fc04b',
  webSource:'00e60cd9d5df63e422156a1368508e6b07a757f5',
  exactPriorAppAcceptance:'6fb8b9e635818810552a763afb877be995eadf0307b65c12485f674ef927f3af',
  integrationSourceOnly:true,combinedIndependentAcceptance:'PENDING',newDirectorySchema28_1Included:false},
 schemaBefore:28,schemaAfter:31,migrationChanges:true,
 migrationBaseline:{path:baselinePath,sha256:sha(baselineBytes)},
 recoveryGate:{status:'UNBOUND_EXACT_V31_AWARE_ARCHIVE_AND_PG_RUNTIME_REQUIRED',oldV28CoreAllowed:false,
  pendingCountZeroIsRuntimeProof:false,metadataIsRuntimeProof:false,packagedJarRecoveryRuntime:'NOT_RUN',
  requirement:'Recover only an exact tested PENDING-aware package; otherwise controlled maintenance and forward correction. Never restore an old database.'},
 qa:{status:'P2_SOURCE_QA_ACCEPTED_TEST_AND_CI_DELTA_RUNTIME_PENDING',
  acceptedForPreciseCommitAndNormalRemoteCi:true,sourceOnly:true,backendRuntimeAccepted:false,migrationRuntimeAccepted:false,
  receiptSha256:'23933dbf97087ed5513fe3b7ec8268c9bbeb797296f3cd638d53a36f0cf85600',
  receiptProvenance:'Parent-reported original independent late-response P2 source QA, 15/15; not extended to new Java/CI tests',
  postQaTestAndCiDeltaIndependentReview:'PENDING',artifactAndFormalBrowserAcceptance:'PENDING',
  packagedJarRecoveryAcceptance:'NOT_RUN',productionPublishAllowed:false,
  committedReport:'docs/reports/ITEM-PUBLICATION-CI-20261109.md'},
};
fs.mkdirSync('docs/reports/item-publication-20261109',{recursive:true});
const replacement=process.argv.find(arg=>arg.startsWith('--replace-expected='))?.slice('--replace-expected='.length);
if(replacement){
 assert.match(replacement,/^[0-9a-f]{64}$/);
 assert.equal(sha(fs.readFileSync(target)),replacement,'Previous accepted manifest changed; do not overwrite');
}
fs.writeFileSync(target,JSON.stringify(manifest,null,2)+'\n',{flag:replacement?'w':'wx'});
console.log(JSON.stringify({path:target,sha256:sha(fs.readFileSync(target)),sourceDigest:manifest.sourceDigest,
 sourceFiles:sourceFiles.length,requiredBackendClasses:requiredBackendClasses.length,migrations:migrations.length,
 schema:'28 -> 31',recovery:manifest.recoveryGate.status,productionPublishAllowed:false}));
