import {describe,it,expect} from 'vitest';
import {recommendationText} from './recommendationText';
import {formatMoney} from './currency';
import type {RecommendationItem} from './api';
const item:RecommendationItem={id:1,name:'日本語商品 MODEL-1',imageUrl:'/source.png',itemNumber:'000123',priceUnit:'100g',translationStatus:'REVIEWED',translations:{'zh-CN':{name:'中文商品 MODEL-1',description:'介绍'},'zh-TW':{name:'繁體商品 MODEL-1'},'en-US':{name:'English item MODEL-1'}}};
describe('source-bound product language and stable currency',()=>{
 it('shows translated name followed by Japanese while Japanese remains unduplicated',()=>{expect(recommendationText(item,'zh-CN').name).toBe('中文商品 MODEL-1（日本語商品 MODEL-1）');expect(recommendationText(item,'zh-TW').name).toContain('繁體');expect(recommendationText(item,'en-US').name).toContain('English item');expect(recommendationText(item,'ja-JP').name).toBe(item.name);});
 it('falls back without displaying stale or absent translations',()=>{expect(recommendationText({...item,translationStatus:'STALE'},'zh-CN')).toMatchObject({name:item.name,missing:true,description:''});expect(recommendationText({...item,translations:{}},'en-US').name).toBe(item.name);expect(item.itemNumber).toBe('000123');expect(item.priceUnit).toBe('100g');});
 it('never changes the selling currency when language changes',()=>{for(const locale of ['ja-JP','zh-CN','zh-TW','en-US']){expect(formatMoney(858,'JPY',locale)).toMatch(/^JPY ¥858$/);expect(formatMoney(12.5,'USD',locale)).toContain('USD $12.50');expect(formatMoney(12.5,'TWD',locale)).toContain('TWD NT$12.50');}});
});
