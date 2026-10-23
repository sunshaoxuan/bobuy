import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root=new URL('../src/',import.meta.url);
const parse=url=>ts.createSourceFile(fileURLToPath(url),readFileSync(url,'utf8'),ts.ScriptTarget.Latest,true);
const keys=new Set(Object.keys(JSON.parse(readFileSync(new URL('locales/experience.zh-CN.json',root),'utf8'))));
function collect(node) {
  if(ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name)) keys.add(node.name.text);
  ts.forEachChild(node,collect);
}
collect(parse(new URL('locales/zh-CN.ts',root)));
function missingIn(source) {
  const missing=[];
  const visit=node=>{
    if(ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text==='t' && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && !keys.has(node.arguments[0].text)) missing.push(node.arguments[0].text);
    ts.forEachChild(node,visit);
  };
  visit(source);return missing;
}
const failures=[];
function scan(directory) {
  for(const entry of readdirSync(directory,{withFileTypes:true})) {
    const url=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
    if(entry.isDirectory() && entry.name!=='locales') scan(url);
    else if(/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) failures.push(...missingIn(parse(url)).map(key=>({file:entry.name,key})));
  }
}
scan(root);
assert.deepEqual(failures,[],'All literal application translation keys must exist');
assert.deepEqual(missingIn(ts.createSourceFile('negative.ts',"t('missing.negative_fixture')",ts.ScriptTarget.Latest,true)),['missing.negative_fixture']);
console.log(`PASS: ${keys.size} resource keys, application references and missing-key negative fixture`);
