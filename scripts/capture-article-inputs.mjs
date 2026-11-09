/** Explicit reviewed inputs only. No staging/build/network/database; run after source freeze. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
export const BASELINE='docs/reports/c2-cart-20261109/accepted-inputs.json';
export const BASELINE_SHA='48bbcc808d0a0761e112b720c276592afe52f9979031a9975247065efeb277ba';
export const TARGET='docs/reports/article-digest-editor-20261109/accepted-inputs.json';
const TOOLS=['.github/workflows/ci.yml','scripts/prepare-ci-release-artifacts.py','scripts/test_prepare_ci_release_artifacts.py','scripts/capture-article-inputs.mjs','scripts/test_capture_article_inputs.mjs',BASELINE];
const PROTECTED=new Set(['scripts/local-test.ps1','docs/reports/REAL-PROJECTION-P2-20261107.md']);
export const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export const canonical=b=>b.includes(0)?b:Buffer.from(b.toString('utf8').replaceAll('\r\n','\n'));
export function scopePath(p){
 assert.equal(typeof p,'string');assert(!p.includes('\\')&&!p.startsWith('/')&&!p.split('/').includes('..')&&!PROTECTED.has(p)&&p!==TARGET,'Unsafe/protected scope path: '+p);
 assert(/^(?:backend\/src\/(?:main|test)\/|frontend\/src\/|scripts\/|docs\/reports\/|\.github\/workflows\/)/.test(p),'Non-application scope path: '+p);
 assert(!/(?:^|\/)(?:\.env(?:\.[^/]*)?|credentials|secrets)(?:\/|$)/i.test(p),'Secret scope path');return p;
}
export function unionPaths(baseline,approved,extra=TOOLS){
 approved.forEach(scopePath);extra.forEach(scopePath);
 return [...new Set([...baseline.map(f=>f.path),...approved,...extra])].filter(p=>!PROTECTED.has(p)&&p!==TARGET).sort();
}
export function requireBothScopes(paths){assert(paths.some(p=>p.startsWith('backend/src/main/java/'))&&paths.some(p=>p.startsWith('frontend/src/')),'Both frozen backend and frontend source scopes are required');}
export function unchangedMigrations(actual,baseline){assert.deepEqual(actual,baseline,'Article cannot change/add/remove/reorder any C2 migration');assert.equal(actual.length,27);assert.equal(Math.max(...actual.map(m=>Number(/^V(\d+)__.+\.sql$/.exec(m.path)?.[1]))),28);}
export function actualMainClasses(mainPaths,classRoot,compiledEntries,sourceEntries,read=p=>fs.readFileSync(p)){
 const byPath=new Map(compiledEntries.map(f=>[path.resolve(f.path),f]));const result=[];
 const visit=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())visit(p);else if(entry.name.endsWith('.class')){const relative=path.relative(classRoot,p).replaceAll('\\','/');const matched=mainPaths.some(source=>{const body=read(source).toString('utf8'),pkg=/^package\s+([A-Za-z0-9_.]+)\s*;/m.exec(body)?.[1];assert(pkg,'Java package missing');const type=pkg.replaceAll('.','/')+'/'+path.basename(source,'.java');return relative===type+'.class'||relative.startsWith(type+'$');});if(!matched)continue;const accepted=byPath.get(path.resolve(p));assert(accepted,'Class missing from accepted compile evidence: '+relative);const bytes=read(p);assert.equal(sha(bytes),accepted.sha256,'Compiled class changed');assert.equal(bytes.readUInt32BE(0),0xcafebabe);assert.equal(bytes.readUInt16BE(6),61);result.push(relative);}}};
 for(const source of mainPaths){const entry=sourceEntries.find(f=>f.path===source);assert(entry,'Source missing from accepted compile inputs: '+source);assert.equal(sha(read(source)),entry.sha256,'Source changed since compile: '+source);}
 visit(classRoot);for(const source of mainPaths){const body=read(source).toString('utf8'),pkg=/^package\s+([A-Za-z0-9_.]+)\s*;/m.exec(body)?.[1];assert(result.includes(pkg.replaceAll('.','/')+'/'+path.basename(source,'.java')+'.class'),'Main class absent: '+source);}return result.sort();
}
export function main(argv=process.argv.slice(2)){
 const values={scope:[]};for(let i=0;i<argv.length;i++){const arg=argv[i];if(arg==='--capture-after-source-freeze'){values.confirmed=true;continue;}assert(['--scope','--class-root','--class-inputs','--report'].includes(arg),'Unknown capture argument: '+arg);const value=argv[++i];assert(value,'Missing '+arg);if(arg==='--scope')values.scope.push(value);else values[arg.slice(2)]=value;}
 assert(values.confirmed&&values.scope.length>=2&&values['class-root']&&values['class-inputs'],'STOP: reviewed backend/front manifests, exact compile inputs/classes and explicit source-freeze flag required');
 assert(!fs.existsSync(TARGET),'Accepted-inputs target exists; reconcile instead of overwriting');
 const baselineBytes=canonical(fs.readFileSync(BASELINE));assert.equal(sha(baselineBytes),BASELINE_SHA);const old=JSON.parse(baselineBytes);
 const approved=new Map(),scopeEvidence=[];
 for(const name of values.scope){const bytes=fs.readFileSync(name),manifest=JSON.parse(bytes);assert(Array.isArray(manifest.files),'Reviewed scope manifest requires files[]: '+name);scopeEvidence.push({path:name,sha256:sha(bytes)});for(const f of manifest.files){scopePath(f.path);const raw=fs.readFileSync(f.path);assert(f.sha256||f.gitLfSha256,'Reviewed file hash missing');if(f.sha256)assert.equal(sha(raw),f.sha256,'Reviewed file drift '+f.path);if(f.gitLfSha256)assert.equal(sha(canonical(raw)),f.gitLfSha256,'Reviewed canonical drift '+f.path);if(approved.has(f.path))assert.equal(approved.get(f.path),sha(raw),'Overlapping reviewed manifests disagree');approved.set(f.path,sha(raw));}}
 requireBothScopes([...approved.keys()]);
 const extras=[...TOOLS];if(values.report){scopePath(values.report);assert(fs.existsSync(values.report));extras.push(values.report);}
 const paths=unionPaths(old.sourceFiles,[...approved.keys()],extras),allowedChanges=new Set([...approved.keys(),...extras]);
 const git=(args,input)=>{const r=spawnSync('git',args,{input,encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});assert.equal(r.status,0,r.stderr);return r.stdout;};
 const oids=git(['hash-object','--stdin-paths'],paths.join('\n')+'\n').trim().split('\n');assert.equal(oids.length,paths.length);const previous=new Map(old.sourceFiles.map(f=>[f.path,f]));
 const sourceFiles=paths.map((p,i)=>{const bytes=canonical(fs.readFileSync(p));assert.equal(crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),oids[i],'Git-filter byte mismatch '+p);const f={path:p,gitLfBytes:bytes.length,gitLfSha256:sha(bytes)},before=previous.get(p);if(before&&!allowedChanges.has(p))assert.equal(f.gitLfSha256,before.gitLfSha256,'Unapproved baseline source drift: '+p);return f;});
 const migrationRoot='backend/src/main/resources/db/migration/';const migrationNames=fs.readdirSync(migrationRoot).filter(p=>p.endsWith('.sql')).sort();const migrations=migrationNames.map(p=>{const bytes=canonical(fs.readFileSync(migrationRoot+p));return {path:p,bytes:bytes.length,sha256:sha(bytes)};});unchangedMigrations(migrations,old.migrations);
 const compileBytes=fs.readFileSync(values['class-inputs']),compiled=JSON.parse(compileBytes);assert(Array.isArray(compiled.compiledClassFiles)&&Array.isArray(compiled.files),'Exact successful compiled input evidence required');
 const mainPaths=[...approved.keys()].filter(p=>/^backend\/src\/main\/java\/.+\.java$/.test(p));assert(mainPaths.length>0);
 const changedClasses=actualMainClasses(mainPaths,values['class-root'],compiled.compiledClassFiles,compiled.files);
 const requiredBackendClasses=[...new Set([...old.requiredBackendClasses,...changedClasses])].sort();
 const baseArtifactPath='.task-tmp/c2-ci-20261109/fix1/package/ci-artifact.json',baseArtifactBytes=fs.readFileSync(baseArtifactPath),baseArtifact=JSON.parse(baseArtifactBytes);assert.equal(baseArtifact.source,'82b8daf7fe275d6dd623b36621f1cf2596dc0e98');assert.match(baseArtifact.coreJarSha256,/^[a-f0-9]{64}$/);
 const manifest={candidateKind:'ARTICLE_DIGEST_EDITOR_V1',candidate:'Reviewed published four-language atomic revision; no schema migration',baseHead:git(['rev-parse','HEAD']).trim(),sourceDigestAlgorithm:'sha256-json-utf8-sourceFiles-v1',sourceDigest:sha(Buffer.from(JSON.stringify(sourceFiles))),sourceFileCount:sourceFiles.length,sourceFiles,lineEndingPolicy:'Canonical Git-filtered bytes cross-checked against git hash-object; explicit approved scopes only; protected dirty files excluded.',migrations,schemaBefore:28,schemaAfter:28,migrationChanges:false,migrationBaseline:{path:BASELINE,sha256:BASELINE_SHA},requiredBackendClasses,requiredBackendClassCount:requiredBackendClasses.length,acceptedBackendClasses:null,compiledByteAcceptance:'PENDING_INDEPENDENT_ARTIFACT_QA',frontendFiles:null,previousProductionCoreJarSha256:baseArtifact.coreJarSha256,captureEvidence:{reviewedScopes:scopeEvidence,compileInputs:{path:values['class-inputs'],sha256:sha(compileBytes)},actualChangedMainClasses:changedClasses,baseArtifact:{path:baseArtifactPath,sha256:sha(baseArtifactBytes)}},qa:{status:'SOURCE_FROZEN_REMOTE_CI_AND_INDEPENDENT_ARTIFACT_RUNTIME_PENDING',sourceOnly:true,backendRuntimeAccepted:false,migrationRuntimeAccepted:false,formalBuildAndNonProductionBrowserAcceptance:'PENDING_REQUIRED_BEFORE_PUBLISH',productionPublishAllowed:false,...(values.report?{committedReport:values.report}:{})}};
 fs.mkdirSync(path.dirname(TARGET),{recursive:true});fs.writeFileSync(TARGET,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({path:TARGET,sha256:sha(fs.readFileSync(TARGET)),sourceFiles:sourceFiles.length,requiredClasses:requiredBackendClasses.length,actualChangedMainClasses:changedClasses.length,migrations:migrations.length,schema:'28->28',productionAllowed:false}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();
