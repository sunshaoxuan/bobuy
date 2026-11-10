import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider, translate, useI18n } from '../i18n';
import type { RecommendationChoice } from '../api';
import CatalogCategorySelect from './CatalogCategorySelect';
import postcss from 'postcss';

// jsdom cannot parse one of Ant Design's nested :has/:not style selectors.
// Omit only :has rules from injected test CSS; real Select behavior is unchanged.
const innerHTML=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML')!;
beforeAll(()=>{
  Object.defineProperty(Element.prototype,'innerHTML',{...innerHTML,set(value:string){
    if(this instanceof HTMLStyleElement&&String(value).includes(':has(')){
      const stylesheet=postcss.parse(value);
      stylesheet.walkRules(rule=>{if(rule.selector.includes(':has('))rule.remove();});
      innerHTML.set!.call(this,stylesheet.toString());
    }else innerHTML.set!.call(this,value);
  }});
});
afterAll(()=>{Object.defineProperty(Element.prototype,'innerHTML',innerHTML);});

const choices: RecommendationChoice[] = [
  {id:'rec-cat-clothing',editable:true,name:{'zh-CN':'服饰配件','zh-TW':'服飾配件','ja-JP':'ファッション小物','en-US':'Fashion accessories'}},
  {id:'rec-cat-home',editable:true,name:{'zh-CN':'家居用品','zh-TW':'居家用品','ja-JP':'生活用品','en-US':'Home essentials'}},
];
const changed=vi.fn();
function Harness({options=choices,initial=[]}:{options?:RecommendationChoice[];initial?:string[]}){
  const [ids,setIds]=useState(initial);
  const {setLocale}=useI18n();
  return <><CatalogCategorySelect choices={options} value={ids} onChange={next=>{setIds(next);changed(next);}} />
    <button onClick={()=>setLocale('zh-CN')}>CN</button><button onClick={()=>setLocale('zh-TW')}>TW</button><button onClick={()=>setLocale('ja-JP')}>JA</button><button onClick={()=>setLocale('en-US')}>EN</button></>;
}
function show(options=choices,initial:string[]=[]){return render(<I18nProvider><Harness options={options} initial={initial}/></I18nProvider>);}
function input(){return screen.getByRole('combobox');}
function open(){fireEvent.mouseDown(input().closest('.ant-select-selector')!);}
function pick(label:string){fireEvent.click(screen.getByText(label,{selector:'.ant-select-item-option-content'}));}
function tags(container:HTMLElement){return [...container.querySelectorAll('.ant-select-selection-item-content')].map(node=>node.textContent);}
beforeEach(()=>{localStorage.setItem('bobbuy_locale','zh-CN');changed.mockClear();});

it('searches localized labels, keeps multiple IDs as values and clears the query on close/reopen',async()=>{
  const view=show();open();fireEvent.change(input(),{target:{value:'服饰'}});
  expect(input()).toHaveValue('服饰');
  expect(screen.queryByText('家居用品',{selector:'.ant-select-item-option-content'})).toBeNull();
  pick('服饰配件');expect(changed).toHaveBeenLastCalledWith(['rec-cat-clothing']);
  expect(tags(view.container)).toEqual(['服饰配件']);expect(input()).toHaveValue('');
  fireEvent.change(input(),{target:{value:'家居'}});pick('家居用品');
  expect(changed).toHaveBeenLastCalledWith(['rec-cat-clothing','rec-cat-home']);
  fireEvent.change(input(),{target:{value:'未完成查询'}});
  fireEvent.keyDown(input(),{key:'Escape',code:'Escape',keyCode:27});
  await waitFor(()=>expect(input()).toHaveValue(''));
  open();expect(input()).toHaveValue('');expect(tags(view.container)).toEqual(['服饰配件','家居用品']);
  fireEvent.click(view.container.querySelector('.ant-select-selection-item-remove')!);
  expect(changed).toHaveBeenLastCalledWith(['rec-cat-home']);
});
it('relabels asynchronous options and missing selections without rewriting the stored IDs',()=>{
  const view=show([],['rec-cat-clothing']);
  expect(tags(view.container)).toEqual([translate('zh-CN','master.category_unavailable')]);
  expect(view.container.textContent).not.toContain('rec-cat-clothing');
  view.rerender(<I18nProvider><Harness options={choices} initial={['rec-cat-clothing']}/></I18nProvider>);
  expect(tags(view.container)).toEqual(['服饰配件']);expect(changed).not.toHaveBeenCalled();
  view.rerender(<I18nProvider><Harness options={[]} initial={['rec-cat-clothing']}/></I18nProvider>);
  expect(tags(view.container)).toEqual([translate('zh-CN','master.category_unavailable')]);
  fireEvent.click(view.container.querySelector('.ant-select-selection-item-remove')!);
  expect(changed).toHaveBeenLastCalledWith([]);
});
it('relabels existing selections in all four UI languages without changing the value',()=>{
  const view=show(choices,['rec-cat-clothing']);
  for(const [button,label]of [['EN','Fashion accessories'],['JA','ファッション小物'],['TW','服飾配件'],['CN','服饰配件']]){
    fireEvent.click(screen.getByRole('button',{name:button}));expect(tags(view.container)).toEqual([label]);
  }
  expect(changed).not.toHaveBeenCalled();
});
it('keeps arbitrary typed query text separate from selected IDs and clears it on blur',async()=>{
  const view=show(choices,['rec-cat-home']);open();
  fireEvent.change(input(),{target:{value:'rec-cat-clothing'}});
  expect(input()).toHaveValue('rec-cat-clothing');expect(tags(view.container)).toEqual(['家居用品']);
  expect(changed).not.toHaveBeenCalled();
  expect(screen.queryByText('服饰配件',{selector:'.ant-select-item-option-content'})).toBeNull();
  fireEvent.blur(input());await waitFor(()=>expect(input()).toHaveValue(''));
  expect(tags(view.container)).toEqual(['家居用品']);expect(changed).not.toHaveBeenCalled();
});
it('uses a localized fallback for nameless choices and preserves IDs on edit reopen',()=>{
  const nameless=[{id:'rec-cat-empty',editable:true,name:{}}];
  const first=show(nameless,['rec-cat-empty']);
  expect(tags(first.container)).toEqual([translate('zh-CN','master.category_unavailable')]);
  first.unmount();
  const reopened=show(choices,['rec-cat-clothing','rec-cat-home']);
  expect(tags(reopened.container)).toEqual(['服饰配件','家居用品']);
  expect(input()).toHaveValue('');expect(changed).not.toHaveBeenCalled();
});
