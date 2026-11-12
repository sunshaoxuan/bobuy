import {act,fireEvent,render as mount,screen,waitFor} from '@testing-library/react';
import {StyleProvider} from '@ant-design/cssinjs';
import {I18nProvider} from '../i18n';
import GeographicAreas from './GeographicAreas';
import type {GeographicArea} from '../api';

const api=vi.hoisted(()=>({geographicAreas:vi.fn()}));
vi.mock('../api',()=>({masterDataApi:api}));
const area=(code:string,parentCode:string|null,level:1|2|3,name:string):GeographicArea=>({code,parentCode,level,name,reading:null});
const roots=[area('JP',null,1,'Japan'),area('US',null,1,'United States')];
const prefectures=[area('JP-13','JP',2,'東京都'),area('JP-01','JP',2,'北海道')];
const tokyo=[area('JP-13101','JP-13',3,'千代田区')];
function show(){localStorage.setItem('bobbuy_locale','en-US');return mount(<StyleProvider container={document.createElement('div')}><I18nProvider><GeographicAreas/></I18nProvider></StyleProvider>);}
async function select(field:string,label:string){fireEvent.mouseDown(screen.getByRole('combobox',{name:field}));await screen.findAllByText(label);fireEvent.click(document.querySelector(`.ant-select-dropdown:not(.ant-select-dropdown-hidden) [title="${label}"]`)!);}
beforeEach(()=>{vi.clearAllMocks();api.geographicAreas.mockImplementation((parent?:string)=>Promise.resolve(parent===undefined?roots:parent==='JP'?prefectures:parent==='JP-13'?tokyo:[]));});

it('loads Japan by default and selects a municipality by its stable code',async()=>{
 show();await screen.findByText('東京都');
 await select('Prefecture','東京都 (JP-13)');
 await screen.findByText('千代田区');
 await select('City/ward','千代田区 (JP-13101)');
 expect(document.querySelector('.geo-selection')).toHaveTextContent('Japan / 東京都 / 千代田区');
 expect(api.geographicAreas).toHaveBeenCalledWith('JP-13');
});

it('clears descendants and ignores a late result after changing country',async()=>{
 let resolveCities!:(rows:GeographicArea[])=>void;
 api.geographicAreas.mockImplementation((parent?:string)=>parent==='JP-13'?new Promise(resolve=>{resolveCities=resolve;}):Promise.resolve(parent===undefined?roots:parent==='JP'?prefectures:[]));
 show();await screen.findByText('東京都');await select('Prefecture','東京都 (JP-13)');
 await waitFor(()=>expect(resolveCities).toBeTypeOf('function'));
 await select('Country/region','United States (US)');
 await screen.findByText('Only country-level reference data is currently provided for this country/region.');
 await act(async()=>{resolveCities(tokyo);});
 expect(screen.queryByText('千代田区')).not.toBeInTheDocument();
 expect(screen.getByRole('combobox',{name:'City/ward'})).toBeDisabled();
 expect(document.querySelector('.geo-selection')).toHaveTextContent('United States');
 expect(document.querySelector('.geo-selection')).not.toHaveTextContent('東京都');
});

it('shows a failed read and retries it without mutating any records',async()=>{
 api.geographicAreas.mockRejectedValueOnce(new Error('Directory unavailable'));
 show();await screen.findByText('Directory unavailable');
 const button=await screen.findByRole('button',{name:'Reload'});
 await waitFor(()=>expect(button).not.toHaveClass('ant-btn-loading'));fireEvent.click(button);
 await waitFor(()=>expect(screen.queryByText('Directory unavailable')).not.toBeInTheDocument());
 expect(api.geographicAreas).toHaveBeenCalledTimes(4);
});
