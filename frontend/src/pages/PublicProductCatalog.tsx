import CompactProductCard from '../components/CompactProductCard';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Alert,Button,Drawer,Empty,Modal,Spin,Tooltip} from 'antd';
import {ArrowDownOutlined,PlusOutlined,ReloadOutlined} from '@ant-design/icons';
import {Link,useLocation,useSearchParams} from 'react-router-dom';
import {storefrontApi,productMarkerApi,type ProductMarkerDefinition,type PublicCatalogEntry,type ProductBrowseCard,type StoreProduct} from '../api';
import {localizedContent,useI18n,type Locale} from '../i18n';
import {ProductBrand} from '../components/ProductMetadata';
import {RecommendationImageViewer} from '../components/RecommendationImageViewer';
import {ConsumerDetail,ProductDetailCode,ProductDetailSpecs} from '../components/ConsumerDetail';
import ReservationAdd from '../components/ReservationAdd';
import CatalogReferenceHistory from '../components/CatalogReferenceHistory';
import {productDetailContent} from '../productDetailContent';
import {selectReferenceOffers} from '../referencePriceDisplay';
import {recommendationText} from '../recommendationText';
import SellingPrice from '../components/SellingPrice';
import {selectedNode} from '../storeNavigation';
import {useBrowsePages,useSectionActivation,useNextBrowsePage,useBoundedSales} from '../browsePaging';
import {BrowseFilters,BrowseError} from '../components/BrowseSupport';
import ProductMarkerBadges from '../components/ProductMarkerBadges';

import ProductMarkerEditor from '../components/ProductMarkerEditor';
import {useUserRole} from '../context/UserRoleContext';
import {useJapaneseDay} from '../recommendationSchedule';

import '../recommendations.css';
import '../public-catalog.css';

type CatalogIdentity=Pick<PublicCatalogEntry,"productId"|"merchantId"|"name"|"itemNumber">;
type Props={query?:string;products:StoreProduct[];quantities:Record<string,number>;onAdd:(product:StoreProduct)=>void;canBuy:(product:StoreProduct)=>boolean;autoPaused?:boolean;purchasePending?:boolean;onSales?:(values:StoreProduct[])=>void;merchantId?:number};
export function catalogText(values:Record<string,string>,locale:Locale) {
  const value=localizedContent(values,locale);
  const language=values[locale]?locale:Object.keys(values).find(key=>values[key]===value);
  return {value,language,fallback:!!value&&language!==locale};
}

export default function PublicProductCatalog(props:Props) {
  const {t,locale}=useI18n(),{user,isMerchant,isAuthenticated,loading}=useUserRole();
  const location=useLocation();
  const day=useJapaneseDay();
  const [editing,setEditing]=useState<CatalogIdentity>(),[dirty,setDirty]=useState(false),[refresh,setRefresh]=useState(0);
  const busy=useRef(false),confirming=useRef(false);
  const [details,setDetails]=useState({marked:false,all:false});
  const [markedScope,setMarkedScope]=useState<{group:string;count:number}>();
  const onDetailChange=useCallback((kind:'marked'|'all',open:boolean)=>setDetails(previous=>previous[kind]===open?previous:{...previous,[kind]:open}),[]);
  const [datasetChanged,setDatasetChanged]=useState(false);
  const dataset=useRef<{group:string;tokens:Record<string,string>}>({group:"",tokens:{}});
  const authKey=JSON.stringify([user?.id,isMerchant,isAuthenticated,loading,day]);
  const group=JSON.stringify([props.merchantId??selectedNode(location.search),props.query??'',locale,refresh,authKey]);
  const markedCount=markedScope?.group===group?markedScope.count:undefined;
  const markedDetail=new URLSearchParams(location.search).get('productSection')==='marked';
  const acceptMarkedScope=useCallback((count:number)=>setMarkedScope(current=>current?.group===group&&current.count===count?current:{group,count}),[group]);
  if(dataset.current.group!==group)dataset.current={group,tokens:{}};
  useEffect(()=>{setDatasetChanged(false);},[group]);
  const checkDataset=(kind:string,token:string)=>{if(Object.entries(dataset.current.tokens).some(([key,value])=>key!==kind&&value!==token)){setDatasetChanged(true);return false;}dataset.current.tokens[kind]=token;return true;};
  function refreshCatalog(){setDatasetChanged(false);setRefresh(value=>value+1);}
  // Visibility alone is not a dataset change. Explicit refresh, identity and Japanese-day changes remain authoritative.
  const autoPaused=!!props.autoPaused||!!editing||details.marked||details.all||datasetChanged;
  const manager=!!isAuthenticated&&!loading&&isMerchant&&!!user;
  useEffect(()=>{setEditing(undefined);setDirty(false);busy.current=false;},[user?.id,isMerchant,isAuthenticated,loading]);
  const canEdit=(entry:CatalogIdentity)=>manager&&user?.id===entry.merchantId;
  const editable=editing&&canEdit(editing)?editing:undefined;
  function openEditor(entry:CatalogIdentity){if(editing||busy.current||!canEdit(entry))return;setDirty(false);setEditing(entry);}
  function closeEditor(){
    if(busy.current||confirming.current)return;
    if(!dirty){setEditing(undefined);return;}
    confirming.current=true;
    Modal.confirm({title:t('marker.discard'),onOk:()=>{if(!busy.current)setEditing(undefined);},afterClose:()=>{confirming.current=false;}});
  }
  return <>{datasetChanged&&<BrowseError error="browse.changed" changed retry={refreshCatalog} refresh={refreshCatalog}/>} {manager&&<aside className="marker-management-scope" aria-label={t('marker.context_title')}><strong>{t('marker.context_owner',{name:user.name||user.username||String(user.id)})}</strong><p>{t('marker.context_hint')}</p></aside>}{(markedCount!==0||markedDetail)&&<CatalogSection {...props} enabled={markedCount!==undefined||markedDetail} autoPaused={autoPaused} kind="marked" refresh={refresh} authKey={authKey} acceptDataset={token=>checkDataset("marked",token)} onRefresh={refreshCatalog} onEdit={openEditor} canEdit={canEdit} onDetailChange={onDetailChange}/>}<CatalogSection {...props} onMarkedScope={acceptMarkedScope} autoPaused={autoPaused} kind="all" refresh={refresh} authKey={authKey} acceptDataset={token=>checkDataset("all",token)} onRefresh={refreshCatalog} onEdit={openEditor} canEdit={canEdit} onDetailChange={onDetailChange}/>
    <Drawer className="marker-drawer" title={t('marker.assigned')} width="min(100vw,620px)" open={!!editable} onClose={closeEditor} maskClosable={false} destroyOnClose>
      {editable&&<><div className="marker-product-context"><strong lang={catalogText(editable.name,locale).language}>{localizedContent(editable.name,locale)||t('rec.not_stated')}</strong><span>{t('rec.code')}: {editable.itemNumber||t('rec.not_stated')}</span></div><ProductMarkerEditor key={String(user?.id)+':'+editable.productId} productId={editable.productId} onDirtyChange={setDirty} onBusyChange={value=>{busy.current=value;}} onSaved={refreshCatalog}/></>}
    </Drawer></>;
}
export function CatalogSection({query='',quantities,onAdd,canBuy,kind='all',refresh=0,onEdit,canEdit,autoPaused=false,onDetailChange,authKey='',acceptDataset,onRefresh,purchasePending=false,onSales,merchantId,enabled=true,onMarkedScope}:Props & {enabled?:boolean;onMarkedScope?:(count:number)=>void;kind?:'all'|'marked';refresh?:number;authKey?:string;acceptDataset?:(token:string)=>boolean;onRefresh?:()=>void;onEdit?:(entry:CatalogIdentity)=>void;canEdit?:(entry:CatalogIdentity)=>boolean;onDetailChange?:(kind:'all'|'marked',open:boolean)=>void}) {
  const {t,locale}=useI18n(),location=useLocation();
  const [params,setParams]=useSearchParams();
  const node=merchantId??selectedNode(location.search),scope=kind+':'+String(node??'all');
  const categoryKey=kind==='marked'?'markedCategory':'category',category=params.get(categoryKey)??'';
  const [attempt,setAttempt]=useState(0),[detailAttempt,setDetailAttempt]=useState(0);
  const identity=JSON.stringify([location.pathname,scope,query,category,locale,refresh,attempt,authKey]);
  const activation=useSectionActivation(identity);
  const browse=useBrowsePages<ProductBrowseCard>(identity,(page,revision)=>storefrontApi.productBrowse({page,revision,merchantId:node,query,category,locale,marked:kind==='marked'}),entry=>entry.productId,enabled&&activation.active&&node!==-1,acceptDataset,24,autoPaused||!!params.get('product'));
  useEffect(()=>{if(kind==="all"&&typeof browse.page?.markedScopeTotal==="number")onMarkedScope?.(browse.page.markedScopeTotal);},[kind,browse.page?.markedScopeTotal,onMarkedScope]);
  const filtered=browse.items;
  const markers=Object.fromEntries(browse.items.map(entry=>[entry.productId,entry.markers]));
  const state={markers};
  const ready=!!browse.page,detailId=(params.get('productSection')??'all')===kind?params.get('product')??undefined:undefined;
  const detailKey=JSON.stringify([identity,detailId,detailAttempt]);
  const [detail,setDetail]=useState<{key:string;item?:PublicCatalogEntry;markers?:ProductMarkerDefinition[];error:string}>({key:'',error:''});
  useEffect(()=>{if(!detailId||node===-1)return;let active=true;setDetail({key:detailKey,error:''});void storefrontApi.productDetail(detailId,node).then(result=>{if(active){if(result.item.productId!==detailId)throw Error('browse.invalid');setDetail({key:detailKey,item:result.item,markers:result.markers,error:''});}}).catch(error=>{if(active)setDetail({key:detailKey,error:error.message});});return()=>{active=false;};},[detailKey]);
  const opened=detail.key===detailKey?detail.item:undefined;
  useEffect(()=>{onDetailChange?.(kind,!!detailId);return()=>onDetailChange?.(kind,false);},[kind,!!detailId,onDetailChange]);
  const revealPaused=autoPaused||!!detailId;
  const sentinel=useNextBrowsePage(identity,!!browse.page?.hasNext&&!browse.busy&&!browse.error,revealPaused,browse.next);
  const ids=[...new Set([...browse.items.map(entry=>entry.productId),...(opened?[opened.productId]:[])])];
  const sales=useBoundedSales(ids,identity,onSales);
  const sale=opened?sales.quotes[opened.productId]:undefined;
  const pricePending=(id:string)=>!sales.done.has(id)||purchasePending;
  function reload(){if(onRefresh)onRefresh();else setAttempt(value=>value+1);}
  function openDetail(productId:string){onDetailChange?.(kind,true);const next=new URLSearchParams(params);next.set('product',productId);next.set('productSection',kind);setParams(next);}
  function closeDetail(){onDetailChange?.(kind,false);const next=new URLSearchParams(params);next.delete('product');next.delete('productSection');setParams(next);}
  function choose(value:string) {
    if(value===category)return;
    const next=new URLSearchParams(params);next.delete('item');next.delete('product');next.delete('productSection');
    if(value)next.set(categoryKey,value);else next.delete(categoryKey);setParams(next);
  }
  function sourceNote(text:ReturnType<typeof catalogText>) {
    return text.fallback?<small className="catalog-source">{t('catalog.source_language',{language:text.language??''})}</small>:null;
  }
  function management(entry:CatalogIdentity){return canEdit?.(entry)?<div className="marker-product-actions" data-card-action role="group" aria-label={t('marker.actions')+': '+catalogText(entry.name,locale).value}><span>{t('marker.actions')}</span><Button className="marker-product-trigger" onClick={()=>onEdit?.(entry)} aria-label={t('marker.set')+': '+catalogText(entry.name,locale).value}>{t('marker.set')}</Button></div>:null;}
  const detailName=opened?catalogText(opened.name,locale):undefined;
  const content=useMemo(()=>opened?productDetailContent(opened,locale):undefined,[opened,locale]);
  const originalDescription=opened?catalogText(opened.description,locale):undefined;
  const mainReference=opened?selectReferenceOffers(opened).main:undefined;
  const descriptionValue=content?.description||(mainReference?recommendationText(mainReference.facts,locale).description:'')||'';
  const description=content&&originalDescription?{...originalDescription,value:descriptionValue,language:descriptionValue===originalDescription.value?originalDescription.language:undefined,fallback:descriptionValue===originalDescription.value&&originalDescription.fallback}:undefined;
  const hideMarked=kind==='marked'&&ready&&!browse.error&&browse.page?.markedScopeTotal===0;
  return <>{!hideMarked&&<section ref={activation.element} className="recommendations rec-public public-product-catalog" aria-label={t(kind==='marked'?'marker.featured':'store.catalog')} aria-busy={browse.busy}>
    <header className="catalog-master-heading">{kind==='marked'?<h2>{t('marker.featured')}</h2>:<h1>{t('store.catalog')}</h1>}{ready&&<span role="status">{t('catalog.result_count',{shown:filtered.length,total:browse.page!.matchedTotal})}</span>}</header>
    <BrowseError error={node===-1?'browse.invalid':browse.error} changed={browse.changed} retry={browse.retry} refresh={reload}/>
    {sales.error&&<BrowseError error={sales.error} retry={sales.retry} refresh={sales.retry}/>}
    {!ready?(browse.error||node===-1?null:<div className="catalog-progress" role="status"><Spin/><span>{t('browse.loading')}</span></div>):<>
      <BrowseFilters page={browse.page} category={category} onChoose={choose}/>
      {filtered.length?<div className="catalog-master-grid">{filtered.map((entry,index)=>{
        const name=catalogText(entry.name,locale);
        const product=sales.quotes[entry.productId],pending=pricePending(entry.productId),buyable=!pending&&!!product&&canBuy(product);
        return <CompactProductCard key={entry.productId} productId={entry.productId} name={name.value} originalName={entry.name['ja-JP']} language={name.language} brand={entry.brand} itemNumber={entry.itemNumber} image={entry.image?.url} rating={entry.rating} quote={product} reference={entry.reference} pending={pending} eager={index<2} onOpen={()=>openDetail(entry.productId)} overlay={<><ProductMarkerBadges markers={state.markers[entry.productId]??[]} overlay/><ReservationAdd allowed={buyable} quote={product} name={name.value} count={quantities[entry.productId]} onAdd={()=>{if(product&&buyable)onAdd(product);}}/></>} actions={management(entry)}/>;
      })}</div>:kind==='marked'?<div className="catalog-marked-empty" role="status"><p>{t(query||category?'store.no_matches':'marker.empty')}</p>{(query||category)&&<Button onClick={()=>{const next=new URLSearchParams(params);next.delete(categoryKey);next.delete('query');setParams(next);}}>{t('class.all')}</Button>}</div>:<Empty description={t(query||category?'store.no_matches':'catalog.empty')}>{category&&<Button onClick={()=>choose('')}>{t('class.all')}</Button>}</Empty>}
      {browse.page?.hasNext&&<div className="feed-loader" ref={sentinel}><Button loading={browse.busy} disabled={revealPaused||browse.changed||!!browse.error} icon={<ArrowDownOutlined aria-hidden/>} onClick={browse.next}>{t('store.load_more')} ({filtered.length}/{browse.page.matchedTotal})</Button></div>}
    </>}
    </section>}
    <Drawer className="rec-product-detail catalog-master-detail consumer-detail-drawer" title={opened?<ProductDetailCode value={opened.itemNumber}/>:t('store.details')} width="min(1120px,100vw)" open={!!detailId} onClose={closeDetail}>
      {detailId&&!opened&&(detail.error?<BrowseError error={detail.error} retry={()=>setDetailAttempt(value=>value+1)} refresh={reload}/>:<Spin/>)}
      {opened&&detailName&&description&&<ConsumerDetail media={<RecommendationImageViewer consumer key={opened.productId} pictures={opened.gallery} name={detailName.value}/>}>
        <ProductMarkerBadges markers={detail.markers??[]}/>
        {management(opened)}
        <ProductBrand brand={opened.brand}/><h1 lang={detailName.language}><span className="rec-name-local">{detailName.value||t('rec.not_stated')}</span>{locale!=='ja-JP'&&opened.name['ja-JP']&&opened.name['ja-JP']!==detailName.value&&<span className="rec-name-original" lang="ja">（{opened.name['ja-JP']}）</span>}</h1>{sourceNote(detailName)}
        <ProductDetailSpecs model={content?.model} packaging={content?.packaging} specification={!mainReference?catalogText(opened.specification,locale).value:undefined} specificationLanguage={!mainReference?catalogText(opened.specification,locale).language:undefined}/>
        {sale&&!pricePending(opened.productId)&&<SellingPrice product={sale}/>}
        {content&&<CatalogReferenceHistory entry={opened}/> }
        {description.value&&<section><h2>{t('detail.description')}</h2>{sourceNote(description)}<div lang={description.language}>{description.value.split('\n').map((line,index)=><p key={index}>{line}</p>)}</div></section>}
        <Button type="primary" size="large" block icon={<PlusOutlined aria-hidden/>} disabled={pricePending(opened.productId)||!sale||!canBuy(sale)} onClick={()=>{if(sale&&!pricePending(opened.productId)&&canBuy(sale))onAdd(sale);}}>{t(pricePending(opened.productId)?'browse.sales_pending':sale&&canBuy(sale)?'store.add_cart':'catalog.not_available')}</Button>
      </ConsumerDetail>}
    </Drawer>
  </>;
}
