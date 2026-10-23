import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const folder = new URL(`../../docs/reports/evidence/PLAN60/${process.env.BOBUY_VERIFY_ORIGIN === 'https://bobuy.cc' ? 'production' : 'local'}/`, import.meta.url);
const report = JSON.parse(readFileSync(new URL('browser-report.json',folder),'utf8'));
const failures=[];
let measured=0;
for(const view of report.views) {
  for(const language of view.languages) {
    for(const control of language.controls) {
      measured++;
      const prefix=`${view.width}/${language.locale}/${control.name}`;
      if(control.hitArea.height < 44 || control.hitArea.width < 44) failures.push(`${prefix}: small hit area`);
      if(!control.glyph) continue;
      if(Object.values(control.margins).some(value=>value<3)) failures.push(`${prefix}: glyph margin`);
      const tolerance=Math.min(2,control.glyph.height*.1);
      if(Math.abs(control.centerError.y)>tolerance+.01) failures.push(`${prefix}: vertical ink center ${control.centerError.y}`);
      if(control.alignment==='center' && Math.abs(control.centerError.x)>tolerance+.01) failures.push(`${prefix}: horizontal ink center ${control.centerError.x}`);
    }
  }
}
const result={measured,failures,budget:{hitArea:44,glyphMargin:3,center:'min(2px, ink height * 10%)'},status:failures.length?'FAIL':'PASS'};
writeFileSync(new URL('geometry-report.json',folder),JSON.stringify(result,null,2));
assert.deepEqual(failures,[]);
console.log(`PASS: ${measured} merchant controls meet the fixed ink and hit-area budgets`);
