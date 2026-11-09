import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import {MemoryRouter} from 'react-router-dom';
import RecommendationClassification from './RecommendationClassification';
const mocks=vi.hoisted(()=>({options:vi.fn(),assign:vi.fn()}));
vi.mock('../api',()=>({api:{},recommendationTaxonomyApi:mocks}));
vi.mock('antd',async original=>{const actual=await original<typeof import('antd')>();return {...actual,
 Select:({options=[],onChange,value,mode,...props}:any)=><select aria-label={props['aria-label']} disabled={props.disabled} value={mode==='multiple'?(value??[]):value??''} multiple={mode==='multiple'} onChange={e=>onChange(mode==='multiple'?Array.from(e.target.selectedOptions).map(x=>x.value):e.target.value)}>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
 Table:({dataSource,rowSelection}:any)=><div>{dataSource.map((item:any)=><label key={item.id}><input type="checkbox" aria-label={'Select '+item.name} disabled={rowSelection.getCheckboxProps(item).disabled} checked={rowSelection.selectedRowKeys.includes(item.id)} onChange={e=>rowSelection.onChange(e.target.checked?[...rowSelection.selectedRowKeys,item.id]:rowSelection.selectedRowKeys.filter((id:number)=>id!==item.id))}/>{item.name}</label>)}</div>,
 Popconfirm:({children,onConfirm}:any)=><span onClick={()=>void onConfirm?.()}>{children}</span>
 };});
const detail={post:{id:9,version:5,published:true},body:'',items:[{id:1,name:'Existing public',publicationState:'PUBLISHED'},{id:2,name:'Pending eighth',publicationState:'PENDING'}]} as any;
beforeEach(()=>{localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');vi.resetAllMocks();mocks.options.mockResolvedValue({categories:[{id:'food',name:{'en-US':'Food'}}],suppliers:[]});mocks.assign.mockResolvedValue(detail);});
it('allows only the pending item in an already public issue to be selected and classified',async()=>{
 const changed=vi.fn();render(<I18nProvider><MemoryRouter><RecommendationClassification detail={detail} onChanged={changed} onPendingChange={vi.fn()}/></MemoryRouter></I18nProvider>);
 await screen.findByRole('option',{name:'Food'});expect(screen.getByRole('checkbox',{name:'Select Existing public'})).toBeDisabled();expect(screen.getByRole('checkbox',{name:'Select Pending eighth'})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'Select all results (2)'}));expect(screen.getByRole('checkbox',{name:'Select Pending eighth'})).toBeChecked();expect(screen.getByRole('checkbox',{name:'Select Existing public'})).not.toBeChecked();
 fireEvent.click(screen.getByRole('checkbox',{name:'Update categories'}));fireEvent.change(screen.getByLabelText('Category tags'),{target:{value:'food'}});fireEvent.click(screen.getByRole('button',{name:'Apply to selected items'}));
 await waitFor(()=>expect(mocks.assign).toHaveBeenCalledWith(9,expect.objectContaining({itemIds:[2],version:5,categoryIds:['food']})));expect(changed).toHaveBeenCalled();
});
it('clears a stale selection when the pending item becomes public without unlocking legacy public rows',async()=>{
 const view=render(<I18nProvider><MemoryRouter><RecommendationClassification detail={detail} onChanged={vi.fn()} onPendingChange={vi.fn()}/></MemoryRouter></I18nProvider>);await screen.findByRole('option',{name:'Food'});
 fireEvent.click(screen.getByRole('checkbox',{name:'Select Pending eighth'}));
 view.rerender(<I18nProvider><MemoryRouter><RecommendationClassification detail={{...detail,items:[{id:1,name:'Legacy public'},{...detail.items[1],publicationState:'PUBLISHED'}]}} onChanged={vi.fn()} onPendingChange={vi.fn()}/></MemoryRouter></I18nProvider>);
 await waitFor(()=>expect(screen.getByRole('checkbox',{name:'Select Pending eighth'})).not.toBeChecked());expect(screen.getByRole('checkbox',{name:'Select Legacy public'})).toBeDisabled();expect(screen.queryByRole('button',{name:'Apply to selected items'})).toBeNull();expect(mocks.assign).not.toHaveBeenCalled();
});
