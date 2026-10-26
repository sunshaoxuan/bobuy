import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import StoreNavigation from '../components/StoreNavigation';
import PublicRecommendations,{RecommendationPreview} from './PublicRecommendations';
import {selectedNode,scopedPath} from '../storeNavigation';
const mocks=vi.hoisted(()=>({feed:vi.fn(),get:vi.fn()}));
vi.mock('../api',()=>({recommendationApi:mocks}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>({isCustomer:true})}));
// JSDOM's selector engine cannot parse AntD Select's adjacent :has selector.
// These tests exercise routing/races; the real Select is covered in Chromium.
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,Select:(props:{id:string;'aria-label':string;value:number;onChange:(value:number)=>void;options:{value:number;label:string;disabled?:boolean}[]})=><select id={props.id} aria-label={props['aria-label']} value={props.value} onChange={event=>props.onChange(Number(event.target.value))}>{props.options.map(option=><option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select>};});
const detail=(id:number,name:string)=>({post:{id,title:name,published:false,version:1,updatedAt:'',merchantId:id},body:'Synthetic preview',items:[
 {id:1,name:'Multi',itemNumber:'00123',imageUrl:'/fixture.png',categoryIds:['a','b'],categories:[{id:'a',name:{'en-US':'Food'}},{id:'b',name:{'en-US':'Home'}}],showSupplier:false,supplierName:{'en-US':'Hidden supplier'}},
 {id:2,name:'Unclassified',imageUrl:'/fixture.png',categoryIds:[]}]});
beforeEach(()=>{localStorage.setItem('bobbuy_locale','en-US');vi.clearAllMocks();});
it('keeps node context in links and exact active state without inventing valid nodes',()=>{
 expect(selectedNode('?node=1000')).toBe(1000);expect(selectedNode('?node=oops')).toBe(-1);expect(selectedNode('')).toBeUndefined();
 expect(scopedPath('/trips','?node=1000&category=a')).toBe('/trips?node=1000');
 render(<I18nProvider><MemoryRouter initialEntries={['/recommendations/1?node=1000']}><StoreNavigation nodes={[{id:1000,name:'Node A'}]} node={1000} open={false} onClose={vi.fn()} onNodeChange={vi.fn()} loading={false}/></MemoryRouter></I18nProvider>);
 expect(screen.getByRole('link',{name:'Product Picks'})).toHaveAttribute('aria-current','page');
 expect(screen.getByRole('link',{name:'Bookable trips'})).toHaveAttribute('href','/trips?node=1000');
 expect(screen.getByRole('link',{name:'Discover'})).not.toHaveAttribute('aria-current');
});
it('previews the same customer filters/cards without any public fetch or write',()=>{
 const {container}=render(<I18nProvider><MemoryRouter><RecommendationPreview detail={detail(1,'Draft preview')}/></MemoryRouter></I18nProvider>);
 expect(container.querySelectorAll('.rec-pin')).toHaveLength(2);expect(screen.queryByText('Hidden supplier')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Home (1)'}));expect(container.querySelectorAll('.rec-pin')).toHaveLength(1);
 expect(screen.queryByRole('heading',{name:'Unclassified'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'All (2)'}));expect(container.querySelectorAll('.rec-pin')).toHaveLength(2);
 expect(mocks.feed).not.toHaveBeenCalled();expect(mocks.get).not.toHaveBeenCalled();
});
function RaceHarness(){const navigate=useNavigate(),location=useLocation();return <><button onClick={()=>navigate('/recommendations?node=2')}>Node B</button><button onClick={()=>navigate(-1)}>Back</button><output>{location.search}</output><PublicRecommendations products={[]} quantities={{}} onDetail={vi.fn()} onAdd={vi.fn()} canBuy={()=>false}/></>;}
it('clears prior node immediately and ignores a stale response, then restores browser back',async()=>{
 let resolveA!:(value:unknown)=>void;const first=new Promise(resolve=>{resolveA=resolve;});
 mocks.feed.mockImplementation((_page,node)=>node===1?first:Promise.resolve([detail(2,'Node B issue')]));
 render(<I18nProvider><MemoryRouter initialEntries={['/recommendations?node=1']}><RaceHarness/></MemoryRouter></I18nProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Node B'}));await screen.findByRole('heading',{name:'Node B issue'});
 await act(async()=>resolveA([detail(1,'Stale A')]));expect(screen.queryByRole('heading',{name:'Stale A'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Back'}));await screen.findByRole('heading',{name:'Stale A'});
 expect(screen.queryByRole('heading',{name:'Node B issue'})).not.toBeInTheDocument();
 await waitFor(()=>expect(mocks.feed).toHaveBeenLastCalledWith(0,1));
});
