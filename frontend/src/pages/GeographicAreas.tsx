import {useEffect,useMemo,useState} from 'react';
import {Alert,Button,Empty,Select,Table} from 'antd';
import {masterDataApi,type GeographicArea} from '../api';
import {useI18n} from '../i18n';
import './geographicAreas.css';

// Data is tied to its parent on render, including the frame before effect cleanup.
// Late responses cannot repopulate a newer parent's controls or table.
function useAreas(parent:string|null|undefined,reload:number){
 const [state,setState]=useState<{parent:string|undefined;reload:number;rows:GeographicArea[];error:string;busy:boolean}>();
 useEffect(()=>{
  if(parent===null)return;
  let active=true;
  setState({parent,reload,rows:[],error:'',busy:true});
  void masterDataApi.geographicAreas(parent).then(rows=>{if(active)setState({parent,reload,rows,error:'',busy:false});})
   .catch((e:Error)=>{if(active)setState({parent,reload,rows:[],error:e.message,busy:false});});
  return()=>{active=false;};
 },[parent,reload]);
 if(parent===null)return{rows:[],error:'',busy:false};
 return state&&state.parent===parent&&state.reload===reload?state:{rows:[],error:'',busy:true};
}

export default function GeographicAreas(){
 const {t,locale}=useI18n();
 const [country,setCountry]=useState<string>('JP'),[prefecture,setPrefecture]=useState<string>(),[city,setCity]=useState<string>(),[reload,setReload]=useState(0);
 const countries=useAreas(undefined,reload),prefectures=useAreas(country,reload),cities=useAreas(prefecture??null,reload);
 const countryNames=useMemo(()=>new Intl.DisplayNames([locale],{type:'region'}),[locale]);
 const name=(row:GeographicArea)=>row.level===1?(countryNames.of(row.code)??row.name):row.name;
 const options=(rows:GeographicArea[])=>rows.map(row=>({value:row.code,label:`${name(row)} (${row.code})`,search:`${name(row)} ${row.name} ${row.code} ${row.reading??''}`}));
 const countryOptions=options(countries.rows).sort((a,b)=>a.label.localeCompare(b.label,locale));
 const current=countries.rows.find(row=>row.code===country);
 const province=prefectures.rows.find(row=>row.code===prefecture);
 const municipality=cities.rows.find(row=>row.code===city);
 const listing=prefecture?cities:prefectures;
 const error=countries.error||prefectures.error||cities.error;
 return <section className="geographic-master" lang={locale}>
  <header className="geo-heading"><div><h1>{t('geo.title')}</h1><p>{t('geo.hint')}</p></div><Button onClick={()=>setReload(value=>value+1)} loading={countries.busy||prefectures.busy||cities.busy}>{t('currency.reload')}</Button></header>
  {error&&<Alert type="error" showIcon message={error}/>}
  <div className="geo-selectors">
   <label><span>{t('geo.country')}</span><Select aria-label={t('geo.country')} value={country} showSearch optionFilterProp="search" options={countryOptions} loading={countries.busy} disabled={countries.busy||!!countries.error} onChange={value=>{setCountry(value);setPrefecture(undefined);setCity(undefined);}}/></label>
   <label><span>{t('geo.prefecture')}</span><Select aria-label={t('geo.prefecture')} value={prefecture} placeholder={t('geo.choose_prefecture')} allowClear showSearch optionFilterProp="search" options={options(prefectures.rows)} loading={prefectures.busy} disabled={prefectures.busy||!prefectures.rows.length} onChange={value=>{setPrefecture(value);setCity(undefined);}}/></label>
   <label><span>{t('geo.city')}</span><Select aria-label={t('geo.city')} value={city} placeholder={t('geo.choose_city')} allowClear showSearch optionFilterProp="search" options={options(cities.rows)} loading={cities.busy} disabled={!prefecture||cities.busy||!cities.rows.length} onChange={setCity}/></label>
  </div>
  <div className="geo-selection" aria-live="polite"><strong>{t('geo.selection')}</strong><span>{[current&&name(current),province?.name,municipality?.name].filter(Boolean).join(' / ')}</span></div>
  {country!=='JP'&&!prefectures.busy&&!prefectures.error&&prefectures.rows.length===0?<Empty description={t('geo.country_only')}/>:<>
   <h2>{t(prefecture?'geo.cities':'geo.prefectures')} <small>({listing.rows.length})</small></h2>
   <Table<GeographicArea> key={prefecture??country} rowKey="code" loading={listing.busy} dataSource={listing.rows} pagination={{pageSize:20,showSizeChanger:false,showLessItems:true,hideOnSinglePage:true}} columns={[
    {title:t('geo.code'),dataIndex:'code',width:110},
    {title:t('geo.name'),dataIndex:'name'},
    {title:t('geo.reading'),dataIndex:'reading',responsive:['md']}
   ]}/>
  </>}
  <p className="geo-source">{t('geo.source')}</p>
 </section>;
}
