import {fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,useNavigate,useLocation} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import PublicRecommendations from './PublicRecommendations';
const mocks=vi.hoisted(()=>({feed:vi.fn()}));vi.mock('../api',()=>({recommendationApi:mocks}));
const detail={post:{id:1,title:'Synthetic categories',published:true,version:1,updatedAt:''},body:'Synthetic',items:[
 {id:1,name:'Multi',imageUrl:'/fixture.png',categoryIds:['a','b'],categories:[{id:'a',name:{'zh-CN':'食品'}},{id:'b',name:{'zh-CN':'日用'}}],supplierName:{'zh-CN':'Hidden warehouse'},showSupplier:false},
 {id:2,name:'Single',imageUrl:'/fixture.png',categoryIds:['a'],categories:[{id:'a',name:{'zh-CN':'食品'}}],supplierName:{'zh-CN':'Visible warehouse'},showSupplier:true},
 {id:3,name:'Unknown',imageUrl:'/fixture.png'}]};
function Harness(){const navigate=useNavigate(),location=useLocation();return <><button onClick={()=>navigate(-1)}>Fixture back</button><output>{location.search}</output><PublicRecommendations products={[]} quantities={{}} onDetail={vi.fn()} onAdd={vi.fn()} canBuy={()=>false}/></>;}
it('filters by URL, ignores repeated active click, restores back and keeps supplier hidden by default',async()=>{
 localStorage.clear();mocks.feed.mockResolvedValue([detail]);
 const view=render(<I18nProvider><MemoryRouter><Harness/></MemoryRouter></I18nProvider>);
 await screen.findByRole('heading',{name:'Synthetic categories'});
 expect(view.container.querySelectorAll('.rec-pin')).toHaveLength(3);
 expect(screen.queryByText(/Hidden warehouse/)).not.toBeInTheDocument();expect(screen.getByText(/Visible warehouse/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'食品 (2)'}));expect(view.container.querySelectorAll('.rec-pin')).toHaveLength(2);
 expect(view.container.querySelector('output')).toHaveTextContent('?category=a');
 fireEvent.click(screen.getByRole('button',{name:'食品 (2)'}));
 fireEvent.click(screen.getByRole('button',{name:'日用 (1)'}));expect(view.container.querySelectorAll('.rec-pin')).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'Fixture back'}));expect(view.container.querySelectorAll('.rec-pin')).toHaveLength(2);
 fireEvent.click(screen.getByRole('button',{name:'全部 (3)'}));expect(view.container.querySelectorAll('.rec-pin')).toHaveLength(3);
 fireEvent.click(screen.getByRole('button',{name:'未分类 (1)'}));expect(view.container.querySelectorAll('.rec-pin')).toHaveLength(1);
 expect(screen.getByRole('heading',{name:'Unknown'})).toBeInTheDocument();
});
