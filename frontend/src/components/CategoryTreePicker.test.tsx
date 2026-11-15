import {render,screen} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import CategoryTreePicker,{categoryTreeData} from './CategoryTreePicker';
const nodes=[
 {id:'rec-cat-internal',parentId:null,name:{'ja-JP':'食品','en-US':'Food'},fullPath:['rec-cat-internal'],sortOrder:0,productCount:0},
 {id:'leaf-private',parentId:'rec-cat-internal',name:{'ja-JP':'飲料','en-US':'Drinks'},fullPath:['rec-cat-internal','leaf-private'],sortOrder:0,productCount:1}
];
it('builds one complete localized path while keeping internal keys out of labels',()=>{const tree=categoryTreeData(nodes,'en-US');expect(tree[0].children[0].label).toBe('Food › Drinks');expect(JSON.stringify(tree.map((node:any)=>node.label))).not.toContain('rec-cat-');});
it('allows an uncategorized product to stay empty',()=>{localStorage.setItem('bobbuy_locale','en-US');render(<I18nProvider><CategoryTreePicker nodes={nodes} value={null} onChange={()=>{}}/></I18nProvider>);expect(screen.getByText('Uncategorized')).toBeInTheDocument();});
