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
