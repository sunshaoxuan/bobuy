import {fireEvent,render,screen} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import CategoryTreePicker,{categoryTreeData,storefrontCategoryName} from './CategoryTreePicker';
vi.mock('antd',async()=>({...await vi.importActual<typeof import('antd')>('antd'),TreeSelect:(await import('../test/CategoryTreeSelectMock')).CategoryTreeSelectMock}));
const nodes=[
 {id:'rec-cat-internal',parentId:null,name:{'ja-JP':'食品','en-US':'Food'},fullPath:['rec-cat-internal'],sortOrder:0,productCount:0},
 {id:'leaf-private',parentId:'rec-cat-internal',name:{'ja-JP':'飲料','en-US':'Drinks'},fullPath:['rec-cat-internal','leaf-private'],sortOrder:0,productCount:1}
];
it('shows the full primary path and clears it explicitly',()=>{
 localStorage.setItem('bobbuy_locale','en-US');const onChange=vi.fn();
 render(<I18nProvider><CategoryTreePicker nodes={nodes} value="leaf-private" onChange={onChange}/></I18nProvider>);
 expect(screen.getAllByText('Food › Drinks').length).toBeGreaterThan(0);
 expect(document.body.textContent).not.toMatch(/rec-cat-|leaf-private|system_key/);
 fireEvent.click(screen.getByRole('button',{name:'Clear to Uncategorized'}));expect(onChange).toHaveBeenCalledWith(null);
});
it('allows only leaves and retains Japanese reference names in admin',()=>{
 const japanese=nodes.map(n=>({...n,name:{'ja-JP':n.name['ja-JP']}}));
 for(const locale of ['zh-CN','zh-TW','en-US','ja-JP'] as const){
  const data=categoryTreeData(japanese,locale,true);
  expect(data[0].selectable).toBe(false);expect(data[0].children[0].selectable).toBe(true);
  expect(data[0].children[0].label).toBe('食品 › 飲料');
 }
});
it('uses reviewed Simplified Chinese for storefront and original Japanese for ja-JP without guessing',()=>{
 const node={...nodes[0],name:{'ja-JP':'例親','zh-CN':'示例父','zh-TW':'範例父','en-US':'Example parent'}};
 for(const locale of ['zh-CN','zh-TW','en-US'] as const) expect(storefrontCategoryName(node,locale)).toBe('示例父');
 expect(storefrontCategoryName(node,'ja-JP')).toBe('例親');
 expect(storefrontCategoryName(nodes[0],'zh-CN')).toBe('');
});
it('never renders an unknown selected ID as a label',()=>{
 render(<I18nProvider><CategoryTreePicker nodes={nodes} value="rec-cat-missing" onChange={vi.fn()}/></I18nProvider>);
 expect(document.body.textContent).not.toContain('rec-cat-missing');
});
it('builds one complete localized path while keeping internal keys out of labels',()=>{const tree=categoryTreeData(nodes,'en-US');expect(tree[0].children[0].label).toBe('Food › Drinks');expect(JSON.stringify(tree.map((node:any)=>node.label))).not.toContain('rec-cat-');});
it('allows an uncategorized product to stay empty',()=>{localStorage.setItem('bobbuy_locale','en-US');render(<I18nProvider><CategoryTreePicker nodes={nodes} value={null} onChange={()=>{}}/></I18nProvider>);expect(screen.getByText('Uncategorized')).toBeInTheDocument();});
