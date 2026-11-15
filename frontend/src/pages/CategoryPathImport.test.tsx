import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import CategoryPathImport from './CategoryPathImport';

const api=vi.hoisted(()=>({preview:vi.fn(),confirm:vi.fn(),download:vi.fn()}));
vi.mock('../api',()=>({authenticatedFormPost:api.preview,authenticatedPost:api.confirm,authenticatedDownload:api.download}));
const result=(id:string)=>({importId:id,status:'PREVIEWED',productCountBefore:1,matched:1,newNodes:2,unmatched:0,rows:[{rowNumber:2,sku:id,breadcrumb:'食品・飲料＞野菜・果物',outcome:'MATCHED'}]});
function deferred(){let resolve!:(value:ReturnType<typeof result>)=>void;let reject!:(error:Error)=>void;const promise=new Promise<ReturnType<typeof result>>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function select(container:HTMLElement,name:string){fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[new File(['SKU,Costco breadcrumb'],name,{type:'text/csv'})]}});}
beforeEach(()=>{vi.clearAllMocks();localStorage.setItem('bobbuy_locale','en-US');});

it('offers the Chinese-header template before choosing a file',async()=>{
 render(<I18nProvider><CategoryPathImport/></I18nProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Download CSV template'}));
 await waitFor(()=>expect(api.download).toHaveBeenCalledWith('/api/category-path-import/template.csv','category-path-template.csv'));
 expect(screen.getByText(/Chinese headers are supported/)).toBeInTheDocument();
 expect(api.preview).not.toHaveBeenCalled();expect(api.confirm).not.toHaveBeenCalled();
});

it('shows all three raw flags in preview and confirmation and exports pending rows',async()=>{
 const flagged={...result('flags'),matched:2,unmatched:1,rows:[
  {rowNumber:2,sku:'INFERRED',breadcrumb:'食品＞水',flag:'推定',outcome:'MATCHED'},
  {rowNumber:3,sku:'WAREHOUSE',breadcrumb:'食品＞水',flag:'最接近路径 / closest path',outcome:'MATCHED'},
  {rowNumber:4,sku:'PENDING',breadcrumb:'食品＞水',flag:'待核',outcome:'UNMATCHED',reason:'Identity unverified (待核)'}
 ]};
 api.preview.mockResolvedValue(flagged);api.confirm.mockResolvedValue({...flagged,status:'CONFIRMED',productCountAfter:1});
 const {container}=render(<I18nProvider><CategoryPathImport/></I18nProvider>);
 select(container,'flags.csv');await waitFor(()=>expect(screen.getByRole('button',{name:/preview/i})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:/preview/i}));
 expect(await screen.findByRole('columnheader',{name:'Note / flag'})).toBeInTheDocument();
 for(const flag of ['推定','最接近路径 / closest path','待核']) expect(screen.getByRole('cell',{name:flag})).toBeInTheDocument();
 const pending=screen.getByText('PENDING').closest('tr')!;
 expect(pending.textContent).toContain('Unmatched / unknown SKU');expect(pending.textContent).not.toContain('Matched');
 expect(screen.getByRole('button',{name:'Confirm import'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Export unmatched list'}));
 await waitFor(()=>expect(api.download).toHaveBeenCalledWith('/api/category-path-import/flags/unmatched.csv','unmatched.csv'));
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Confirm import'}));
 expect(await screen.findByText('Import confirmed and audited.')).toBeInTheDocument();
 for(const flag of ['推定','最接近路径 / closest path','待核']) expect(screen.getByRole('cell',{name:flag})).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Confirm import'})).not.toBeInTheDocument();
 expect(screen.getByText('Product count before: 1; after: 1')).toBeInTheDocument();
});

it('submits the default nine and invalidates preview after editing the defer list',async()=>{
 api.preview.mockResolvedValue({...result('ops'),deferred:1,rows:[
  {rowNumber:2,sku:'29267',breadcrumb:'例親>例子',sourceTier:'推定（官网无页面）',outcome:'DEFERRED'}]});
 const {container}=render(<I18nProvider><CategoryPathImport/></I18nProvider>);
 select(container,'ops.csv');await waitFor(()=>expect(screen.getByRole('button',{name:/preview/i})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:/preview/i}));
 expect(await screen.findByText('29267')).toBeInTheDocument();
 expect(screen.getByText('Inferred (no official page)')).toBeInTheDocument();
 expect(screen.getByRole('cell',{name:'Deferred'})).toBeInTheDocument();
 expect(api.preview.mock.calls[0][1].get('deferredSkus')).toBe('29267, 1012891, 55719, 535557, 553363, 14116, 14110, 76838, 517611');
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.change(screen.getByRole('textbox',{name:'Defer or exclude product numbers'}),{target:{value:''}});
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/preview/i}));
 await waitFor(()=>expect(api.preview).toHaveBeenCalledTimes(2));
 expect(api.preview.mock.calls[1][1].get('deferredSkus')).toBe('');
});

it.each(['resolve','reject'] as const)('ignores stale preview %s after selecting another file',async outcome=>{
 const old=deferred(),current=deferred();api.preview.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
 const {container}=render(<I18nProvider><CategoryPathImport/></I18nProvider>);
 select(container,'a.csv');await waitFor(()=>expect(screen.getByRole('button',{name:/preview/i})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:/preview/i}));await waitFor(()=>expect(api.preview).toHaveBeenCalledTimes(1));
 select(container,'b.csv');await waitFor(()=>expect(screen.getByText('b.csv')).toBeInTheDocument());
 fireEvent.click(screen.getByRole('button',{name:/preview/i}));await waitFor(()=>expect(api.preview).toHaveBeenCalledTimes(2));
 await act(async()=>{if(outcome==='resolve')old.resolve(result('old'));else old.reject(new Error('stale failure'));});
 expect(screen.queryByText('old')).not.toBeInTheDocument();expect(screen.queryByText('stale failure')).not.toBeInTheDocument();
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(api.confirm).not.toHaveBeenCalled();
 await act(async()=>current.resolve(result('current')));
 expect(await screen.findByText('current')).toBeInTheDocument();
 expect(screen.getByRole('checkbox')).not.toBeChecked();
 fireEvent.click(screen.getByRole('checkbox'));
 api.confirm.mockResolvedValue({...result('current'),status:'CONFIRMED'});
 fireEvent.click(screen.getByRole('button',{name:/^Confirm import$/i}));
 await waitFor(()=>expect(api.confirm).toHaveBeenCalledWith('/api/category-path-import/current/confirm'));
});

it('invalidates a pending preview when the selected file is removed',async()=>{
 const pending=deferred();api.preview.mockReturnValue(pending.promise);
 const {container}=render(<I18nProvider><CategoryPathImport/></I18nProvider>);
 select(container,'a.csv');await waitFor(()=>expect(screen.getByRole('button',{name:/preview/i})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:/preview/i}));await waitFor(()=>expect(api.preview).toHaveBeenCalledTimes(1));
 fireEvent.click(screen.getByTitle('Remove file'));
 await waitFor(()=>expect(screen.getByRole('button',{name:/preview/i})).toBeDisabled());
 await act(async()=>pending.resolve(result('removed')));
 expect(screen.queryByText('removed')).not.toBeInTheDocument();expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:/preview/i})).toBeDisabled();
});
