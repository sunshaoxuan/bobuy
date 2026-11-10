/** Exact source-only input capture. Root alone runs the final Git-filtered capture; no stage/build/DB/network. */
import fs from'node:fs';import crypto from'node:crypto';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';import{resolve}from'node:path';import{pathToFileURL}from'node:url';
export const BASELINE='docs/reports/c2-cart-20261109/accepted-inputs.json',BASELINE_SHA='48bbcc808d0a0761e112b720c276592afe52f9979031a9975247065efeb277ba';
export const MIGRATION='V28_1__recommendation_issue_date.sql',MIGRATION_SHA='d742bea25cb8ef3d205c9e2a4992d25024a372b5ab9dc38dc915f0ebbb91224e';
export const TARGET='docs/reports/recommendation-menu-20261109/accepted-inputs.json';
export const PARENT_HEAD='d0895bcdd8d9f2c60cad889e0c625565f1ec348c';
const BACKEND='.task-tmp/menu-data-contract-20261109/r2/MANIFEST.json',BACKEND_SHA='7390d68d1b025cea1627f75e435f81330fa03fa30198d7fb1c7296d3699c1acd';
export const FRONTEND='docs/reports/recommendation-menu-20261109/wired-frontend-inputs-v1.json',FRONTEND_SHA='db0214f16824a851c585f336ff9a4e9a237417ef20f1c4033c5cdf82504c793e';
export const WIRED_PATHS=['docs/reports/RECOMMENDATION-ISSUE-DATE-WIRING-20261109.md','frontend/src/api.issueDate.test.ts','frontend/src/api.ts','frontend/src/components/RecommendationIssueDatePanel.test.tsx','frontend/src/components/RecommendationIssueDatePanel.tsx','frontend/src/locales/en-US.ts','frontend/src/locales/ja-JP.ts','frontend/src/locales/zh-CN.ts','frontend/src/locales/zh-TW.ts','frontend/src/pages/Recommendations.tsx','frontend/src/pages/RecommendationsIssueDate.test.tsx'].sort();
export const R7_OVERRIDES=['frontend/src/api.ts','frontend/src/locales/en-US.ts','frontend/src/locales/ja-JP.ts','frontend/src/locales/zh-CN.ts','frontend/src/locales/zh-TW.ts'].sort();
export const CI_PATHS=['scripts/prepare-ci-release-artifacts.py','scripts/test_prepare_ci_release_artifacts.py','scripts/verify-issue-date-upgrade.py','scripts/test_verify_issue_date_upgrade.py','scripts/capture-issue-date-inputs.mjs','scripts/test_capture_issue_date_inputs.mjs','.github/workflows/ci.yml','backend/src/test/java/com/bobbuy/compat/PreviousRecommendationPost.java','backend/src/test/java/com/bobbuy/repository/RecommendationIssueDateMigrationIntegrationTest.java','docs/reports/ISSUE-DATE-CI-20261109.md',FRONTEND,'docs/reports/ISSUE-DATE-WIRED-CI-20261109.md'];
export const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export const canonicalBytes=b=>b.includes(0)?b:Buffer.from(b.toString('utf8').replaceAll('\r\n','\n'));
export function sourcePaths(base,backend,frontend,extra=CI_PATHS){
 const paths=[...new Set([...base.sourceFiles.map(f=>f.path),...backend.files.map(f=>f.path),...frontend.files.map(f=>f.path),...extra])].filter(p=>p!==TARGET).sort();
 for(const p of paths)assert(typeof p==='string'&&p.length>0&&!p.startsWith('/')&&!p.includes('\\')&&!p.split('/').includes('..')&&!/^[A-Za-z]:/.test(p)&&!/(^|\/)(?:\.git|\.aws|\.task-tmp|\.task-state|node_modules|target|test-results)(\/|$)/.test(p)&&!/(^|\/)\.env(?:$|\.)/.test(p)&&!['scripts/local-test.ps1','docs/reports/REAL-PROJECTION-P2-20261107.md'].includes(p),'Unsafe source input: '+p);
 return paths;
}
export function requiredClasses(base,backend){
 const main=backend.files.filter(f=>f.path.startsWith('backend/src/main/java/')&&f.path.endsWith('.java')).map(f=>f.path.slice('backend/src/main/java/'.length,-5)+'.class');
 const rows=[...new Set([...base.requiredBackendClasses,...main,...backend.requiredNewBackendClasses,'com/bobbuy/service/PublicRecommendationBrowseService$Issue.class','com/bobbuy/service/PublicRecommendationBrowseService$SupplierLabel.class','com/bobbuy/service/RecommendationService$Summary.class'])].sort();
 assert(rows.every(p=>/^com\/bobbuy\/[A-Za-z0-9_/$]+\.class$/.test(p)));return rows;
}
export function validateMigrations(base,migrations){
 assert.deepEqual(migrations.filter(f=>f.path!==MIGRATION),base.migrations,'Old migration prefix changed');const added=migrations.filter(f=>f.path===MIGRATION);assert.equal(added.length,1);assert.equal(added[0].sha256,MIGRATION_SHA);assert.equal(migrations.length,base.migrations.length+1);
}
function frozen(path,expected){const raw=fs.readFileSync(path);assert.equal(sha(raw),expected,path);const value=JSON.parse(raw);for(const f of value.files)assert.equal(sha(fs.readFileSync(f.path)),f.sha256,'Frozen input drift: '+f.path);return value;}
export function validateWiredFrontend(frontend){
 assert.equal(frontend.format,'BOBUY_ISSUE_DATE_WIRED_FRONTEND_V1');assert.equal(frontend.parentHead,PARENT_HEAD);
 assert.equal(frontend.fileCount,frontend.files.length);assert.equal(frontend.files.length,new Set(frontend.files.map(f=>f.path)).size);
 assert.deepEqual(frontend.wiringPaths,WIRED_PATHS);assert.deepEqual(frontend.overriddenR7Paths,R7_OVERRIDES);
 assert.deepEqual(frontend.files.filter(f=>f.origin==='WIRING').map(f=>f.path).sort(),WIRED_PATHS);
 assert(frontend.files.every(f=>['R7','EDITOR','WIRING'].includes(f.origin)&&/^[0-9a-f]{64}$/.test(f.canonicalSha256)&&Number.isSafeInteger(f.gitLfBytes)&&f.gitLfBytes>0&&(f.parentBlobSha1===null||/^[0-9a-f]{40}$/.test(f.parentBlobSha1))));
 assert.equal(frontend.acceptance.productionPublishAllowed,false,'Source capture is not production acceptance');
}
export function validateBasePrefix(base,sourceFiles,changed){
 const actual=new Map(sourceFiles.map(f=>[f.path,f]));assert.equal(actual.size,sourceFiles.length);
 for(const old of base.sourceFiles){assert(actual.has(old.path),'Missing C2 source: '+old.path);if(!changed.has(old.path))assert.deepEqual(actual.get(old.path),old,'Unexpected unchanged-source drift: '+old.path);}
}
export function validateParentBindings(base,frontend,parentTree,changed){
 for(const f of frontend.files)assert.equal(parentTree.get(f.path)??null,f.parentBlobSha1,'Fixed parent front preimage drift: '+f.path);
 for(const f of base.sourceFiles.filter(f=>!changed.has(f.path)))assert(parentTree.has(f.path),'Unchanged C2 source absent from fixed parent: '+f.path);
}
export function collectSourcePreview(){
 const raw=canonicalBytes(fs.readFileSync(BASELINE));assert.equal(sha(raw),BASELINE_SHA);const base=JSON.parse(raw);assert.equal(base.schemaAfter,28);assert.equal(base.sourceFiles.length,675);assert.equal(base.sourceFiles.length,new Set(base.sourceFiles.map(f=>f.path)).size);
 const backend=frozen(BACKEND,BACKEND_SHA),frontend=frozen(FRONTEND,FRONTEND_SHA),paths=sourcePaths(base,backend,frontend),changed=new Set([...backend.files,...frontend.files].map(f=>f.path).concat(CI_PATHS));
 validateWiredFrontend(frontend);
 const sourceFiles=paths.map(path=>{const b=canonicalBytes(fs.readFileSync(path));return{path,gitLfBytes:b.length,gitLfSha256:sha(b)};});validateBasePrefix(base,sourceFiles,changed);
 for(const f of frontend.files)assert.deepEqual(sourceFiles.find(x=>x.path===f.path),{path:f.path,gitLfBytes:f.gitLfBytes,gitLfSha256:f.canonicalSha256},'Wired canonical source drift: '+f.path);
 const migrationRoot='backend/src/main/resources/db/migration/',migrations=sourceFiles.filter(f=>f.path.startsWith(migrationRoot)).map(f=>({path:f.path.slice(migrationRoot.length),bytes:f.gitLfBytes,sha256:f.gitLfSha256}));validateMigrations(base,migrations);
 const requiredBackendClasses=requiredClasses(base,backend);assert.equal(requiredBackendClasses.length,45);
 return{kind:'READ_ONLY_CANONICAL_SOURCE_PREVIEW_NOT_FINAL_GIT_CAPTURE',base,backend,frontend,approvedChangedPaths:[...changed].sort(),sourceFiles,migrations,requiredBackendClasses,bindings:{parentHead:PARENT_HEAD,backendManifestSha256:BACKEND_SHA,wiredFrontendManifestPath:FRONTEND,wiredFrontendManifestSha256:FRONTEND_SHA,migrationBaselineSha256:BASELINE_SHA},sourceDigest:sha(Buffer.from(JSON.stringify(sourceFiles)))};
}
export function makeManifest(preview,baseHead){
 assert.equal(baseHead,PARENT_HEAD);return{candidate:'Issue-date backend and normal owner editor wiring on fixed menu R7; source QA, exact CI and combined artifact acceptance pending',baseHead,sourceDigestAlgorithm:'sha256-json-utf8-sourceFiles-v1',sourceDigest:preview.sourceDigest,lineEndingPolicy:'Canonical Git-filtered bytes, batch SHA1 checked; all 675 C2 paths retained and unchanged paths checked, fixed d089 parent checked; this self-referential input file excluded.',sourceFiles:preview.sourceFiles,sourceFileCount:preview.sourceFiles.length,migrations:preview.migrations,requiredBackendClasses:preview.requiredBackendClasses,requiredBackendClassCount:preview.requiredBackendClasses.length,acceptedBackendClasses:null,compiledByteAcceptance:'PENDING_INDEPENDENT_ARTIFACT_QA',frontendFiles:null,previousProductionCoreJarSha256:'00642cb993516e072e4e416e1d579f8f6d2ef55ae668715828475b808aec276c',previousCoreSource:'82b8daf7fe275d6dd623b36621f1cf2596dc0e98',qa:{status:'PENDING_WIRED_SOURCE_QA_AND_EXACT_REMOTE_CI',sourceOnly:true,wiredIndependentSourceQa:'NOT_RUN',backendRuntimeAccepted:false,migrationRuntimeAccepted:false,formalBuildAndNonProductionBrowserAcceptance:'PENDING_COMBINED_CORE_WEB',productionPublishAllowed:false,frozenInputs:preview.bindings,committedReport:'docs/reports/ISSUE-DATE-WIRED-CI-20261109.md',old82ApplicationBoot:'NOT_RUN'},schemaBefore:28,schemaAfter:'28.1',migrationChanges:true,migrationBaseline:{path:BASELINE,sha256:BASELINE_SHA},followup:'A later C3/R13 candidate must explicitly include 28.1 before V29/V30 and obtain a new strict accepted migration branch and CI; no old artifact reuse.'};
}
export function main(){
 assert.equal(process.argv.length,2,'No flags that bypass exact source binding');assert(!fs.existsSync(TARGET),'Preserve and reconcile the existing candidate');
 const git=(args,input)=>{const r=spawnSync('git',args,{input,encoding:'utf8',windowsHide:true,maxBuffer:4e6,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 const baseHead=git(['rev-parse','HEAD']);assert.equal(baseHead,PARENT_HEAD);assert.equal(git(['diff','--cached','--name-only']),'');
 const preview=collectSourcePreview(),parentTree=new Map(git(['ls-tree','-r',PARENT_HEAD]).split(/\r?\n/).map(line=>{const[info,path]=line.split('\t');return[path,info.split(' ')[2]];})),changed=new Set(preview.approvedChangedPaths);validateParentBindings(preview.base,preview.frontend,parentTree,changed);
 const oids=git(['hash-object','--stdin-paths'],preview.sourceFiles.map(f=>f.path).join('\n')+'\n').split(/\r?\n/);assert.equal(oids.length,preview.sourceFiles.length);
 preview.sourceFiles.forEach((row,n)=>{const b=canonicalBytes(fs.readFileSync(row.path));assert.equal(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),oids[n],'Git filter mismatch: '+row.path);});
 preview.sourceFiles.filter(f=>preview.base.sourceFiles.some(old=>old.path===f.path)&&!changed.has(f.path)).forEach(row=>{const b=canonicalBytes(fs.readFileSync(row.path));assert.equal(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),parentTree.get(row.path),'Fixed parent unchanged C2 byte drift: '+row.path);});
 const manifest=makeManifest(preview,baseHead);fs.mkdirSync(resolve(TARGET,'..'),{recursive:true});fs.writeFileSync(TARGET,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({path:TARGET,sha256:sha(fs.readFileSync(TARGET)),sourceDigest:manifest.sourceDigest,sourceFiles:manifest.sourceFileCount,requiredClasses:manifest.requiredBackendClassCount,migrations:manifest.migrations.length,schemaBefore:28,schemaAfter:'28.1',qa:manifest.qa.status}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main();
