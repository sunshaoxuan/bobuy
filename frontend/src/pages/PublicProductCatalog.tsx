import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Alert,Button,Drawer,Empty,Modal,Spin,Tooltip} from 'antd';
import {ArrowDownOutlined,PlusOutlined,ReloadOutlined} from '@ant-design/icons';
import {Link,useLocation,useSearchParams} from 'react-router-dom';
import {storefrontApi,productMarkerApi,type ProductMarkerDefinition,type PublicCatalogEntry,type ProductBrowseCard,type StoreProduct} from '../api';
import {localizedContent,useI18n,type Locale} from '../i18n';
import {ProductBrand,ProductVariant} from '../components/ProductMetadata';
import {RecommendationImageViewer} from '../components/RecommendationImageViewer';
import {OfferInfo} from '../components/RecommendationFacts';
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
  const [editing,setEditing]=useState<PublicCatalogEntry>(),[dirty,setDirty]=useState(false),[refresh,setRefresh]=useState(0);
  const busy=useRef(false),confirming=useRef(false);
  const [details,setDetails]=useState({marked:false,all:false});
  const onDetailChange=useCallback((kind:'marked'|'all',open:boolean)=>setDetails(previous=>previous[kind]===open?previous:{...previous,[kind]:open}),[]);
  const [datasetChanged,setDatasetChanged]=useState(false);
  const dataset=useRef<{group:string;tokens:Record<string,string>}>({group:"",tokens:{}});
  const authKey=JSON.stringify([user?.id,isMerchant,isAuthenticated,loading,day]);
  const group=JSON.stringify([props.merchantId??selectedNode(location.search),props.query??'',locale,refresh,authKey]);
  if(dataset.current.group!==group)dataset.current={group,tokens:{}};
  useEffect(()=>{setDatasetChanged(false);},[group]);
  const checkDataset=(kind:string,token:string)=>{if(Object.entries(dataset.current.tokens).some(([key,value])=>key!==kind&&value!==token)){setDatasetChanged(true);return false;}dataset.current.tokens[kind]=token;return true;};
  function refreshCatalog(){setDatasetChanged(false);setRefresh(value=>value+1);}
  useEffect(()=>{const update=()=>{if(document.visibilityState==='visible')refreshCatalog();};document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  const autoPaused=!!props.autoPaused||!!editing||details.marked||details.all||datasetChanged;
  const manager=!!isAuthenticated&&!loading&&isMerchant&&!!user;
  useEffect(()=>{setEditing(undefined);setDirty(false);busy.current=false;},[user?.id,isMerchant,isAuthenticated,loading]);
  const canEdit=(entry:PublicCatalogEntry)=>manager&&user?.id===entry.merchantId;
  const editable=editing&&canEdit(editing)?editing:undefined;
  function openEditor(entry:PublicCatalogEntry){if(editing||busy.current||!canEdit(entry))return;setDirty(false);setEditing(entry);}
  function closeEditor(){
    if(busy.current||confirming.current)return;
    if(!dirty){setEditing(undefined);return;}
    confirming.current=true;
    Modal.confirm({title:t('marker.discard'),onOk:()=>{if(!busy.current)setEditing(undefined);},afterClose:()=>{confirming.current=false;}});
  }
  return <>{datasetChanged&&<BrowseError error="browse.changed" changed retry={refreshCatalog} refresh={refreshCatalog}/>} {manager&&<aside className="marker-management-scope" aria-label={t('marker.context_title')}><strong>{t('marker.context_owner',{name:user.name||user.username||String(user.id)})}</strong><p>{t('marker.context_hint')}</p></aside>}<CatalogSection {...props} autoPaused={autoPaused} kind="marked" refresh={refresh} authKey={authKey} acceptDataset={token=>checkDataset("marked",token)} onRefresh={refreshCatalog} onEdit={openEditor} canEdit={canEdit} onDetailChange={onDetailChange}/><CatalogSection {...props} autoPaused={autoPaused} kind="all" refresh={refresh} authKey={authKey} acceptDataset={token=>checkDataset("all",token)} onRefresh={refreshCatalog} onEdit={openEditor} canEdit={canEdit} onDetailChange={onDetailChange}/>
    <Drawer className="marker-drawer" title={t('marker.assigned')} width="min(100vw,620px)" open={!!editable} onClose={closeEditor} maskClosable={false} destroyOnClose>
      {editable&&<><div className="marker-product-context"><strong lang={catalogText(editable.name,locale).language}>{localizedContent(editable.name,locale)||t('rec.not_stated')}</strong><span>{t('rec.code')}: {editable.itemNumber||t('rec.not_stated')}</span></div><ProductMarkerEditor key={String(user?.id)+':'+editable.productId} productId={editable.productId} onDirtyChange={setDirty} onBusyChange={value=>{busy.current=value;}} onSaved={refreshCatalog}/></>}
    </Drawer></>;
}
export function CatalogSection({query='',quantities,onAdd,canBuy,kind='all',refresh=0,onEdit,canEdit,autoPaused=false,onDetailChange,authKey='',acceptDataset,onRefresh,purchasePending=false,onSales,merchantId}:Props & {kind?:'all'|'marked';refresh?:number;authKey?:string;acceptDataset?:(token:string)=>boolean;onRefresh?:()=>void;onEdit?:(entry:PublicCatalogEntry)=>void;canEdit?:(entry:PublicCatalogEntry)=>boolean;onDetailChange?:(kind:'all'|'marked',open:boolean)=>void}) {
  const {t,locale}=useI18n(),location=useLocation();
  const [params,setParams]=useSearchParams();
  const node=merchantId??selectedNode(location.search),scope=kind+':'+String(node??'all');
  const categoryKey=kind==='marked'?'markedCategory':'category',category=params.get(categoryKey)??'';
  const [attempt,setAttempt]=useState(0),[detailAttempt,setDetailAttempt]=useState(0);
  const identity=JSON.stringify([location.pathname,scope,query,category,locale,refresh,attempt,authKey]);
  const activation=useSectionActivation(identity);
  const browse=useBrowsePages<ProductBrowseCard>(identity,(page,revision)=>storefrontApi.productBrowse({page,revision,merchantId:node,query,category,locale,marked:kind==='marked'}),entry=>entry.productId,activation.active&&node!==-1,acceptDataset,24,autoPaused||!!params.get('product'));
  const filtered=useMemo(()=>browse.items.map(entry=>({...entry,description:{},gallery:entry.image?[entry.image]:[],referenceOffers:[]} as PublicCatalogEntry)),[browse.items]);
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
  function management(entry:PublicCatalogEntry){return canEdit?.(entry)?<div className="marker-product-actions" role="group" aria-label={t('marker.actions')+': '+catalogText(entry.name,locale).value}><span>{t('marker.actions')}</span><Button className="marker-product-trigger" onClick={()=>onEdit?.(entry)} aria-label={t('marker.set')+': '+catalogText(entry.name,locale).value}>{t('marker.set')}</Button></div>:null;}
  const detailName=opened?catalogText(opened.name,locale):undefined;
  const detailSpec=opened?catalogText(opened.specification,locale):undefined;
  const description=opened?catalogText(opened.description,locale):undefined;
  return <section ref={activation.element} className="recommendations rec-public public-product-catalog" aria-label={t(kind==='marked'?'marker.featured':'store.catalog')} aria-busy={browse.busy}>
    <header className="catalog-master-heading">{kind==='marked'?<h2>{t('marker.featured')}</h2>:<h1>{t('store.catalog')}</h1>}{ready&&<span role="status">{t('catalog.result_count',{shown:filtered.length,total:browse.page!.matchedTotal})}</span>}</header>
    <BrowseError error={node===-1?'browse.invalid':browse.error} changed={browse.changed} retry={browse.retry} refresh={reload}/>
    {sales.error&&<BrowseError error={sales.error} retry={sales.retry} refresh={sales.retry}/>}
    {!ready?(browse.error||node===-1?null:<div className="catalog-progress" role="status"><Spin/><span>{t('browse.loading')}</span></div>):<>
      <BrowseFilters page={browse.page} category={category} onChoose={choose}/>
      {filtered.length?<div className="catalog-master-grid">{filtered.map((entry,index)=>{
        const name=catalogText(entry.name,locale),spec=catalogText(entry.specification,locale);
        const product=sales.quotes[entry.productId],pending=pricePending(entry.productId),buyable=!pending&&!!product&&canBuy(product);
        return <article className="store-product rec-pin catalog-master-card" key={entry.productId} data-product-id={entry.productId}>
          <div className="product-tile">
            <button type="button" className="product-photo" aria-label={t('store.detail_label',{name:name.value})} onClick={()=>openDetail(entry.productId)}>
              {entry.gallery[0]?.url?<img src={entry.gallery[0].url} alt={name.value} loading={index<2?'eager':'lazy'} onError={event=>{event.currentTarget.style.display='none';}}/>:<span className="rec-no-product-image">{t('gallery.pending')}</span>}
            </button>
            <ProductMarkerBadges markers={state.markers[entry.productId]??[]} overlay/>
            <Tooltip title={t(pending?'browse.sales_pending':buyable?'store.add_cart':'catalog.not_available')}><button type="button" className="product-add" disabled={!buyable} aria-label={t('store.add_label',{name:name.value})} onClick={()=>{if(product&&buyable)onAdd(product);}}><PlusOutlined aria-hidden/>{!!quantities[entry.productId]&&<span className="product-count">{quantities[entry.productId]}</span>}</button></Tooltip>
            <div className="product-body"><ProductBrand brand={entry.brand}/><button type="button" className="product-name" onClick={()=>openDetail(entry.productId)}><h2 lang={name.language}>{name.value||t('rec.not_stated')}</h2></button>{spec.value&&<p className="catalog-card-spec" lang={spec.language}>{spec.value}</p>}</div>
          </div>
          {(name.fallback||spec.fallback)&&sourceNote(name.fallback?name:spec)}
          <small className="rec-pin-code">{t('rec.code')}: {entry.itemNumber||t('rec.not_stated')}</small>
          {!pending&&product&&<SellingPrice product={product}/>}
          {!!entry.referenceOffers.length&&<button type="button" className="catalog-offer-link" onClick={()=>openDetail(entry.productId)}>{t('catalog.reference_count',{count:entry.referenceOffers.length})}</button>}
          {!buyable&&<small className="rec-pin-status">{t(pending?'browse.sales_pending':'catalog.not_available')}</small>}
          {management(entry)}
        </article>;
      })}</div>:<Empty description={t(query||category?'store.no_matches':kind==='marked'?'marker.empty':'catalog.empty')}>{category&&<Button onClick={()=>choose('')}>{t('class.all')}</Button>}</Empty>}
      {browse.page?.hasNext&&<div className="feed-loader" ref={sentinel}><Button loading={browse.busy} disabled={revealPaused||browse.changed||!!browse.error} icon={<ArrowDownOutlined aria-hidden/>} onClick={browse.next}>{t('store.load_more')} ({filtered.length}/{browse.page.matchedTotal})</Button></div>}
    </>}
    <Drawer className="rec-product-detail catalog-master-detail" title={t('store.details')} width="min(100vw,760px)" open={!!detailId} onClose={closeDetail}>
      {detailId&&!opened&&(detail.error?<BrowseError error={detail.error} retry={()=>setDetailAttempt(value=>value+1)} refresh={reload}/>:<Spin/>)}
      {opened&&detailName&&detailSpec&&description&&<>
        <RecommendationImageViewer key={opened.productId} pictures={opened.gallery} name={detailName.value}/>
        <ProductMarkerBadges markers={detail.markers??[]}/>
        {management(opened)}
        <ProductBrand brand={opened.brand}/><h1 lang={detailName.language}>{detailName.value||t('rec.not_stated')}</h1>{sourceNote(detailName)}
        <ProductVariant model={opened.model} packaging={opened.packaging}/><p>{t('rec.code')}: {opened.itemNumber||t('rec.not_stated')}</p>
        {detailSpec.value&&<><p lang={detailSpec.language}>{detailSpec.value}</p>{sourceNote(detailSpec)}</>}
        {sale&&!pricePending(opened.productId)?<SellingPrice product={sale}/>:<p>{t(pricePending(opened.productId)?'browse.sales_pending':'catalog.not_available')}</p>}
        {description.value&&<section><h2>{t('store.details')}</h2>{sourceNote(description)}<div lang={description.language}>{description.value.split('\n').map((line,index)=><p key={index}>{line}</p>)}</div></section>}
        {!!opened.referenceOffers.length&&<section className="catalog-reference-history"><h2>{t('catalog.reference_count',{count:opened.referenceOffers.length})}</h2>{opened.referenceOffers.map(offer=>{
          const next=new URLSearchParams(location.search);next.set('item',String(offer.facts.id));
          return <section key={offer.postId+':'+offer.facts.id}><Link to={'/recommendations/'+offer.postId+'?'+next.toString()}>{t('catalog.source_issue',{id:offer.postId})}</Link>{offer.facts.referenceContext?.channel&&<p>{t('ref.channel')}: {t('ref.'+offer.facts.referenceContext.channel)}</p>}<OfferInfo facts={{...offer.facts,offerNotes:undefined}}/></section>;
        })}</section>}
        <Button type="primary" size="large" block icon={<PlusOutlined aria-hidden/>} disabled={pricePending(opened.productId)||!sale||!canBuy(sale)} onClick={()=>{if(sale&&!pricePending(opened.productId)&&canBuy(sale))onAdd(sale);}}>{t(pricePending(opened.productId)?'browse.sales_pending':sale&&canBuy(sale)?'store.add_cart':'catalog.not_available')}</Button>
      </>}
    </Drawer>
  </section>;
}
