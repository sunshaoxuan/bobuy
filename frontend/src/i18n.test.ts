import { describe, it, expect, afterEach, vi } from 'vitest';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';
import jaJP from './locales/ja-JP';
import zhTW from './locales/zh-TW';
import { getStoredLocale, localizedContent, supportedLocales, translate, type Locale } from './i18n';

const dictionaries = { 'zh-CN':zhCN, 'en-US':enUS, 'ja-JP':jaJP, 'zh-TW':zhTW };
const placeholders = (value:string) => [...value.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
afterEach(()=>{ vi.restoreAllMocks(); localStorage.clear(); });
describe('four-language UI resource contract',()=>{
  it('exposes exactly the four requested locales and brand names',()=>{
    expect(supportedLocales).toEqual(['zh-CN','en-US','ja-JP','zh-TW']);
    expect(supportedLocales.map(locale=>translate(locale,'app.brand'))).toEqual(['宝宝败','BoBuy','ボボバイ','寶寶敗']);
  });
  for(const locale of supportedLocales) {
    it(`${locale} has the exact complete key set, values and interpolation contract`,()=>{
      const dictionary=dictionaries[locale];
      expect(Object.keys(dictionary).sort()).toEqual(Object.keys(zhCN).sort());
      for(const key of Object.keys(zhCN)) {
        expect(dictionary[key]?.trim(),key).toBeTruthy();
        expect(placeholders(dictionary[key]),key).toEqual(placeholders(zhCN[key]));
        expect(translate(locale,key),key).toBe(dictionary[key]);
      }
    });
  }
  it('interpolates parameters literally, preserving zero and special characters',()=>{
    expect(translate('en-US','store.item_count',{count:0})).toBe('0 items');
    expect(translate('ja-JP','store.view_label',{name:'$& <product>'})).toBe('$& <product> を表示');
  });
  it('uses Japanese prose for core merchant navigation and trip resources',()=>{
    const keys=Object.keys(jaJP).filter(key=>/^(nav|dashboard|trips)\./.test(key));
    const hasJapanese=(value:string)=>/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(value);
    for(const key of keys) expect(hasJapanese(jaJP[key]),key).toBe(true);
    expect(hasJapanese('Trip Publishing and Pricing')).toBe(false);
  });
  it('surfaces missing keys instead of silently substituting Chinese',()=>{
    expect(translate('en-US','missing.resource')).toBe('missing.resource');
    const broken={...enUS}; delete broken['store.cart'];
    expect(Object.keys(broken).sort()).not.toEqual(Object.keys(zhCN).sort());
  });
  it('accepts stored locales and rejects invalid storage values',()=>{
    for(const locale of supportedLocales) { localStorage.setItem('bobbuy_locale',locale); expect(getStoredLocale()).toBe(locale); }
    localStorage.setItem('bobbuy_locale','fr-FR'); expect(getStoredLocale()).toBe('zh-CN');
  });
  it('keeps working when persistent storage is denied',()=>{
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('denied');});
    expect(getStoredLocale()).toBe('zh-CN');
  });
  it('selects merchant content in the current language with documented source-language behavior',()=>{
    const content={'zh-CN':'中文商品','en-US':'Product','ja-JP':'商品','zh-TW':'繁中商品'};
    for(const locale of supportedLocales) expect(localizedContent(content,locale)).toBe(content[locale]);
    expect(localizedContent({'zh-CN':'原文'},'ja-JP')).toBe('原文');
    expect(localizedContent({},'en-US')).toBe('');
  });
});
