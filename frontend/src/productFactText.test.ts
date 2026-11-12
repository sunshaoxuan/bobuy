import {describe,it,expect} from 'vitest';
import translations from './locales/product-facts.json';
import {productFactText} from './productFactText';
import currentLiterals from './test/product-fact-literals.json';

describe('reviewed product fact presentation',()=>{
 it('covers current public source history and all merchant model/packaging literals',()=>{
  for(const source of currentLiterals.filter(v=>/[ぁ-ゖァ-ヺ一-龯]/u.test(v)))
   for(const locale of ['ja-JP','zh-CN','zh-TW','en-US'])
    expect(Object.prototype.hasOwnProperty.call(translations,source)&&!!productFactText(source,locale),`${source}: ${locale}`).toBe(true);
 });
 it('keeps distinct historical pack combinations and exact model identity',()=>{
  expect(productFactText('18枚入り1パック','en-US')).toContain('18');
  expect(productFactText('18枚×4パック／合計72枚','en-US')).toMatch(/18.*4.*72/);
  expect(productFactText('GR-Y600FK EC・601L・1台','en-US')).toContain('GR-Y600FK EC');
  expect(productFactText('GR-Y600FK EC','zh-CN')).toBe('GR-Y600FK EC');
  expect(productFactText('100g','en-US')).toBe('100g');
 });
 it('does not guess from substrings, prototype properties, unknown locales or missing facts',()=>{
  expect(productFactText('UNKNOWN 18枚入り1パック','en-US')).toBe('UNKNOWN 18枚入り1パック');
  expect(productFactText('__proto__','en-US')).toBe('__proto__');
  expect(productFactText('constructor','en-US')).toBe('constructor');
  expect(productFactText('1台','xx')).toBe('1台');
  expect(productFactText(null,'en-US')).toBe('');
 });
 it('expresses a selected variant rather than adding every variant to the package',()=>{
  expect(productFactText('各種1点','en-US')).toBe('1 item, selected variant');
  expect(productFactText('各色1点','zh-CN')).toBe('所选颜色1件');
 });
 it('has complete four-language values and preserves every numeric token',()=>{
  const numbers=(s:string)=>(s.match(/\d+(?:\.\d+)?/g)||[]).sort();
  for(const [source,values] of Object.entries(translations)){
   for(const locale of ['ja-JP','zh-CN','zh-TW','en-US']){
    const text=productFactText(source,locale);
    expect(text,`${source}: ${locale}`).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(values,locale),`${source}: ${locale}`).toBe(true);
    expect(numbers(text),`${source}: ${locale}`).toEqual(numbers(source));
    if(locale!=='ja-JP')expect(text,`${source}: ${locale}`).not.toMatch(/[ぁ-ゖァ-ヺ]/u);
   }
  }
 });
});
