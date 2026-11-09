import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {I18nProvider,translate} from '../i18n';
import Recommendations from './Recommendations';
const m=vi.hoisted(()=>({get:vi.fn(),list:vi.fn(),publishItem:vi.fn(),publish:vi.fn(),save:vi.fn(),products:vi.fn(),fromProduct:vi.fn(),newer:undefined as any}));
vi.mock('../api',()=>({api:{products:m.products},recommendationApi:m,storefrontApi:{products:vi.fn().mockResolvedValue([])}}));
vi.mock('../components/RecommendationList',()=>({default:()=>null}));
vi.mock('../components/RecommendationClassification',()=>({default:({detail,onChanged}:any)=><><output data-testid="parent-version">{detail.post.version}</output><button onClick={()=>onChanged(structuredClone(m.newer))}>Receive newer same issue</button></>}));
vi.mock('../components/RecommendationCatalog',()=>({default:()=>null}));
vi.mock('../components/RecommendationLocalization',()=>({default:()=>null}));
vi.mock('../components/RecommendationGallery',()=>({default:()=>null}));
vi.mock('../components/ReferenceQuoteHistory',()=>({default:()=>null}));
vi.mock('../components/RecommendationServiceEditor',()=>({default:()=>null}));
vi.mock('../components/ArticleLanguages',()=>({default:({title,body,disabled,onTitle,onBody}:any)=><><input aria-label="Local title" value={title} disabled={disabled} onChange={e=>onTitle(e.target.value)}/><textarea aria-label="Local body" value={body} disabled={disabled} onChange={e=>onBody(e.target.value)}/></>}));
// Keep the actual parent, FromProduct and FactsForm; only the unsupported JSDOM Select is substituted.
vi.mock('antd',async importOriginal=>{const a=await importOriginal<typeof import('antd')>();return {...a,Select:({options,onChange,value,disabled,...p}:any)=><select aria-label={p['aria-label']} value={value??''} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value=""/>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>};});
const initial={post:{id:9,title:'Original article',version:4,published:false},body:'Saved body',items:[{id:82,name:'Unrelated pending item',itemNumber:'UNRELATED',imageUrl:'/synthetic.png',publicationState:'PENDING'}]} as any;
const product={product:{id:'qa-master',name:{'ja-JP':'Synthetic Master','en-US':'Synthetic Master'},itemNumber:'QA-123',recordVersion:7,catalogData:{}}};
const snapshot=(version:number)=>({...structuredClone(initial),post:{...initial.post,version,published:true},items:[...initial.items,{id:80,name:version===5?'Earlier pending addition':version===6?'Current public revision6':'Accepted legal revision7',imageUrl:'/synthetic.png',publicationState:version===5?'PENDING':'PUBLISHED'}]});
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');m.get.mockResolvedValue(structuredClone(initial));m.products.mockResolvedValue([structuredClone(product)]);m.newer=snapshot(6);});
async function selectDraft(){
 const router=createMemoryRouter([{path:'*',element:<Recommendations/>}],{initialEntries:['/admin/recommendations?post=9']});render(<I18nProvider><RouterProvider router={router}/></I18nProvider>);
 await screen.findByRole('option',{name:/QA-123.*Synthetic Master/});
 fireEvent.change(screen.getByRole('combobox',{name:translate('en-US','catalog.select_profile')}),{target:{value:'qa-master'}});
 fireEvent.change(screen.getByLabelText('Local title'),{target:{value:'Keep my article draft'}});
 fireEvent.change(screen.getByLabelText(translate('en-US','rec.fact.offerNotes')),{target:{value:'Keep my offer draft'}});
 fireEvent.click(screen.getByRole('checkbox',{name:translate('en-US','catalog.from_product_review')}));
 fireEvent.click(screen.getByRole('button',{name:translate('en-US','catalog.from_product_add')}));
}
for(const version of [5,7]){
 it(`keeps real parent revision6 against late append v${version} and accepts a legal newer result`,async()=>{
  let finish!:(value:any)=>void;m.fromProduct.mockImplementation(()=>new Promise(resolve=>finish=resolve));
  await selectDraft();expect(m.fromProduct).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'Receive newer same issue'}));expect(screen.getByTestId('parent-version')).toHaveTextContent('6');
  await act(async()=>finish(snapshot(version)));
  expect(screen.getByTestId('parent-version')).toHaveTextContent(String(version===5?6:7));
  expect(screen.getByDisplayValue('Keep my article draft')).toBeInTheDocument();
  expect(screen.queryByRole('heading',{name:'Earlier pending addition'})).toBeNull();
  expect(screen.getByRole('heading',{name:version===5?'Current public revision6':'Accepted legal revision7'})).toBeInTheDocument();
  if(version===5){expect(screen.getByDisplayValue('Keep my offer draft')).toBeInTheDocument();expect(screen.getByRole('combobox',{name:translate('en-US','catalog.select_profile')})).toHaveValue('qa-master');expect(screen.getByRole('button',{name:'Reload'})).toBeEnabled();}
 });
 it(`keeps real parent revision6 against conflict reread v${version} while preserving drafts`,async()=>{
  m.fromProduct.mockRejectedValue(Object.assign(new Error('Synthetic conflict'),{status:409}));await selectDraft();await screen.findByText('Synthetic conflict');
  let finish!:(value:any)=>void;m.get.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));m.products.mockResolvedValue([{product:{...product.product,recordVersion:8,name:{'ja-JP':'Updated Master','en-US':'Updated Master'}}}]);
  fireEvent.click(screen.getByRole('button',{name:'Reload'}));await waitFor(()=>expect(m.get).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button',{name:'Receive newer same issue'}));expect(screen.getByTestId('parent-version')).toHaveTextContent('6');
  await act(async()=>finish(snapshot(version)));
  expect(screen.getByTestId('parent-version')).toHaveTextContent(String(version===5?6:7));
  expect(screen.getByDisplayValue('Keep my article draft')).toBeInTheDocument();expect(screen.getByDisplayValue('Keep my offer draft')).toBeInTheDocument();
  expect(screen.getByDisplayValue(version===5?'Synthetic Master':'Updated Master')).toBeDisabled();
  expect(screen.getByRole('checkbox',{name:translate('en-US','catalog.from_product_review')})).not.toBeChecked();
  expect(screen.queryByRole('heading',{name:'Earlier pending addition'})).toBeNull();
 });
}
