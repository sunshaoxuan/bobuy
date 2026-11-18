import {useShoppingScroll} from '../useShoppingScroll';
import CategoryShortcuts from '../components/CategoryShortcuts';
import ShoppingNavigation from '../components/ShoppingNavigation';

import {catalogBatch} from '../catalogBatch';
import ProductSort from '../components/ProductSort';
import CompactProductCard from '../components/CompactProductCard';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Alert,Button,Drawer,Empty,Modal,Spin,Tooltip} from 'antd';
import {PlusOutlined,ReloadOutlined} from '@ant-design/icons';
import {Link,useLocation,useSearchParams} from 'react-router-dom';
import {storefrontApi,productMarkerApi,type BrowseFacet,type ProductMarkerDefinition,type PublicCatalogEntry,type ProductBrowseCard,type StoreProduct} from '../api';
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
import {useReadRecovery} from '../hooks/useReadRecovery';
import {isRecoverableReadError} from '../readRecovery';
import {BrowseFilters,BrowseError} from '../components/BrowseSupport';
import ProductMarkerBadges from '../components/ProductMarkerBadges';
import {selectedOfferSource} from '../components/selectedOfferSource';

import ProductMarkerEditor from '../components/ProductMarkerEditor';
import {useUserRole} from '../context/UserRoleContext';
import {useJapaneseDay} from '../recommendationSchedule';

import '../recommendations.css';
import '../public-catalog.css';

type CatalogIdentity=Pick<PublicCatalogEntry,"productId"|"merchantId"|"name"|"itemNumber">;
type Props={onNavigation?:(categories:BrowseFacet[])=>void;query?:string;products:StoreProduct[];quantities:Record<string,number>;onAdd:(product:StoreProduct)=>void;canBuy:(product:StoreProduct)=>boolean;autoPaused?:boolean;purchasePending?:boolean;onSales?:(values:StoreProduct[])=>void;merchantId?:number};
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
  const [detailOpen,setDetailOpen]=useState(false);
  const onDetailChange=useCallback((_kind:'marked'|'all',open:boolean)=>setDetailOpen(open),[]);
  const [datasetChanged,setDatasetChanged]=useState(false);
  const dataset=useRef<{group:string;tokens:Record<string,string>}>({group:"",tokens:{}});
  const authKey=JSON.stringify([user?.id,isMerchant,isAuthenticated,loading,day]);
  const group=JSON.stringify([props.merchantId??selectedNode(location.search),props.query??'',locale,refresh,authKey]);
  if(dataset.current.group!==group)dataset.current={group,tokens:{}};
  useEffect(()=>{setDatasetChanged(false);},[group]);
  const checkDataset=(kind:string,token:string)=>{if(Object.entries(dataset.current.tokens).some(([key,value])=>key!==kind&&value!==token)){setDatasetChanged(true);return false;}dataset.current.tokens[kind]=token;return true;};
  function refreshCatalog(){setDatasetChanged(false);setRefresh(value=>value+1);}
  // Visibility alone is not a dataset change. Explicit refresh, identity and Japanese-day changes remain authoritative.
  const autoPaused=!!props.autoPaused||!!editing||detailOpen||datasetChanged;
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
  return <>{datasetChanged&&<BrowseError error="browse.changed" changed retry={refreshCatalog} refresh={refreshCatalog}/>} {manager&&<aside className="marker-management-scope" aria-label={t('marker.context_title')}><strong>{t('marker.context_owner',{name:user.name||user.username||String(user.id)})}</strong><p>{t('marker.context_hint')}</p></aside>}<CatalogSection {...props} autoPaused={autoPaused} kind="all" refresh={refresh} authKey={authKey} acceptDataset={token=>checkDataset("all",token)} onRefresh={refreshCatalog} onEdit={openEditor} canEdit={canEdit} onDetailChange={onDetailChange}/>
    <Drawer className="marker-drawer" title={t('marker.assigned')} width="min(100vw,620px)" open={!!editable} onClose={closeEditor} maskClosable={false} destroyOnClose>
      {editable&&<><div className="marker-product-context"><strong lang={catalogText(editable.name,locale).language}>{localizedContent(editable.name,locale)||t('rec.not_stated')}</strong><span>{t('rec.code')}: {editable.itemNumber||t('rec.not_stated')}</span></div><ProductMarkerEditor key={String(user?.id)+':'+editable.productId} productId={editable.productId} onDirtyChange={setDirty} onBusyChange={value=>{busy.current=value;}} onSaved={refreshCatalog}/></>}
    </Drawer></>;
}
export function CatalogSection({query='',quantities,onAdd,canBuy,kind='all',refresh=0,onEdit,canEdit,autoPaused=false,onDetailChange,authKey='',acceptDataset,onRefresh,purchasePending=false,onSales,merchantId,enabled=true,onMarkedScope,onNavigation}:Props & {enabled?:boolean;onMarkedScope?:(count:number)=>void;kind?:'all'|'marked';refresh?:number;authKey?:string;acceptDataset?:(token:string)=>boolean;onRefresh?:()=>void;onEdit?:(entry:CatalogIdentity)=>void;canEdit?:(entry:CatalogIdentity)=>boolean;onDetailChange?:(kind:'all'|'marked',open:boolean)=>void}) {
  const {t,locale}=useI18n(),location=useLocation();
  const [params,setParams]=useSearchParams();
  const node=merchantId??selectedNode(location.search),scope=kind+':'+String(node??'all');
  const categoryKey='category',category=params.get(categoryKey)??'';
  const sort=params.get('sort')??'default',markedFirst=params.get('markedFirst')!=='false';
  const [attempt,setAttempt]=useState(0),[detailAttempt,setDetailAttempt]=useState(0);
  // Keep offsets stable for the mounted session, including window resizes.
  const [batchSize]=useState<24|48>(()=>typeof window.matchMedia==='function'&&window.matchMedia('(min-width: 1920px)').matches?48:24);
  const identity=JSON.stringify([batchSize,location.pathname,scope,query,category,locale,refresh,attempt,authKey,sort,markedFirst]);
  const activation=useSectionActivation(identity);
  const browse=useBrowsePages<ProductBrowseCard>(identity,(page,revision)=>catalogBatch((serverPage,serverRevision)=>storefrontApi.productBrowse({page:serverPage,revision:serverRevision,merchantId:node,query,category,locale,marked:false,markedFirst,sort}),page,revision,batchSize),entry=>entry.productId,enabled&&activation.active&&node!==-1,acceptDataset,batchSize,autoPaused||!!params.get('product'));
  useEffect(()=>{if(kind==="all"&&typeof browse.page?.markedScopeTotal==="number")onMarkedScope?.(browse.page.markedScopeTotal);},[kind,browse.page?.markedScopeTotal,onMarkedScope]);
  const filtered=browse.items;
  const navigation=useRef<{scope:string;categories:NonNullable<typeof browse.page>['categories']}>({scope:'',categories:[]});
  if(navigation.current.scope!==scope)navigation.current={scope,categories:[]};
  if(browse.page)navigation.current.categories=browse.page.categories;
  const navigationCategories=navigation.current.categories;
  useEffect(()=>{onNavigation?.(navigationCategories);},[navigationCategories,onNavigation]);
  const shelves=browse.page?.shelves??[];
  const shelfMode=!query&&sort==='default'&&(!!shelves.length||!browse.page&&(!category||navigation.current.categories.some(c=>c.id===category&&!c.parentId)));
  useShoppingScroll(!!browse.page,browse.busy,!shelfMode&&!!browse.page?.hasNext,browse.next);
  const visibleCards=shelfMode?shelves.flatMap(s=>s.items):filtered;
  useEffect(()=>{const canonical=browse.page?.selectedCategory;if(canonical!==undefined&&canonical!==category){const next=new URLSearchParams(params);if(canonical)next.set('category',canonical);else next.delete('category');setParams(next,{replace:true});}},[browse.page?.selectedCategory,category]);
  const markers=Object.fromEntries(visibleCards.map(entry=>[entry.productId,entry.markers]));
  const state={markers};
  const ready=!!browse.page,detailId=kind==='all'?params.get('product')??undefined:undefined;
  const detailKey=JSON.stringify([identity,detailId,detailAttempt]);
  const [detail,setDetail]=useState<{key:string;item?:PublicCatalogEntry;markers?:ProductMarkerDefinition[];error:string;recoverable?:boolean}>({key:'',error:''});
  useEffect(()=>{if(!detailId||node===-1)return;let active=true;setDetail({key:detailKey,error:''});void storefrontApi.productDetail(detailId,node).then(result=>{if(active){if(result.item.productId!==detailId)throw Error('browse.invalid');setDetail({key:detailKey,item:result.item,markers:result.markers,error:''});}}).catch(error=>{if(active)setDetail({key:detailKey,error:error.message,recoverable:isRecoverableReadError(error)});});return()=>{active=false;};},[detailKey]);
  useReadRecovery(()=>setDetailAttempt(value=>value+1),detail.key===detailKey&&!!detail.recoverable,JSON.stringify([identity,detailId]));
  const opened=detail.key===detailKey?detail.item:undefined;
  useEffect(()=>{onDetailChange?.(kind,!!detailId);return()=>onDetailChange?.(kind,false);},[kind,!!detailId,onDetailChange]);
  const revealPaused=autoPaused||!!detailId||shelfMode;
  const sentinel=useNextBrowsePage(identity,!!browse.page?.hasNext&&!browse.busy&&!browse.error,revealPaused,browse.next);
  const ids=[...new Set([...visibleCards.map(entry=>entry.productId),...(opened?[opened.productId]:[])])];
  const sales=useBoundedSales(ids,identity,onSales);
  const sale=opened?sales.quotes[opened.productId]:undefined;
  const pricePending=(id:string)=>!sales.done.has(id)||purchasePending;
  function reload(){if(onRefresh)onRefresh();else setAttempt(value=>value+1);}
  function openDetail(productId:string){onDetailChange?.(kind,true);const next=new URLSearchParams(params);next.set('product',productId);next.set('productSection',kind);setParams(next);}
  function closeDetail(){onDetailChange?.(kind,false);const next=new URLSearchParams(params);next.delete('product');next.delete('productSection');setParams(next);}
  const shortcutScroll = useRef<{key: string; offset: number}>();
  const overview = location.pathname === '/products' && kind === 'all' && !category && !query.trim();
  const shortcutRoots = overview
    ? browse.page?.categories.filter(c => c.id.startsWith('shop-') && !c.parentId && c.count > 0)
    : undefined;
  function categoryParams(value:string) {
    const next=new URLSearchParams(params);next.delete('item');next.delete('product');next.delete('productSection');
    if(value)next.set(categoryKey,value);else next.delete(categoryKey);
    return next;
  }
  function choose(value:string) {
    if(value!==category)setParams(categoryParams(value));
  }
  function changeSort(value:string){const next=new URLSearchParams(params);if(value==='default')next.delete('sort');else next.set('sort',value);setParams(next);}
  function changeMarkedFirst(value:boolean){const next=new URLSearchParams(params);if(value)next.delete('markedFirst');else next.set('markedFirst','false');setParams(next);}
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
  function renderCard(entry:ProductBrowseCard,index:number){
        const name=catalogText(entry.name,locale);
        const product=sales.quotes[entry.productId],pending=pricePending(entry.productId),buyable=!pending&&!!product&&canBuy(product);
        return <CompactProductCard key={entry.productId} productId={entry.productId} name={name.value} originalName={entry.name['ja-JP']} language={name.language} brand={entry.brand} itemNumber={entry.itemNumber} image={entry.image?.url} rating={entry.rating} quote={product} reference={entry.reference} pending={pending} eager={index<2} onOpen={()=>openDetail(entry.productId)} overlay={<><ProductMarkerBadges markers={state.markers[entry.productId]??[]} promotionPrices={selectedOfferSource(product,pending,entry.reference?.priceChange)} overlay/><ReservationAdd allowed={buyable} quote={product} name={name.value} count={quantities[entry.productId]} onAdd={()=>{if(product&&buyable)onAdd(product);}}/></>} actions={management(entry)}/>;

  }
  const hideMarked=kind==='marked'&&ready&&!browse.error&&browse.page?.markedScopeTotal===0;
  return <>{!hideMarked&&<section ref={activation.element} className={`recommendations rec-public public-product-catalog ${shelfMode?"shopping-overview":"shopping-results"}${overview ? " catalog-home" : ""}`} aria-label={t(kind==='marked'?'marker.featured':'store.catalog')} aria-busy={browse.busy}>
    <header className="catalog-master-heading">{kind==='marked'?<h2>{t('marker.featured')}</h2>:<h1>{t('store.catalog')}</h1>}{ready&&<span role="status">{t('catalog.result_count',{shown:new Set(visibleCards.map(c=>c.productId)).size,total:browse.page!.matchedTotal})}</span>}<div className="catalog-sort-controls"><ProductSort value={sort} onChange={changeSort}/><button type="button" className="marked-first-toggle" aria-pressed={markedFirst} onClick={()=>changeMarkedFirst(!markedFirst)}>{t('marker.priority')}</button></div></header>
    <BrowseError error={node===-1?'browse.invalid':browse.error} changed={browse.changed} retry={browse.retry} refresh={reload}/>
    {sales.error&&<BrowseError error={sales.error} retry={sales.retry} refresh={sales.retry}/>}
    {(category || query.trim()) && <ShoppingNavigation categories={navigation.current.categories} category={category} onChoose={choose}/>}
    {!!shortcutRoots?.length && <CategoryShortcuts
      key={location.key}
      categories={shortcutRoots}
      toCategory={id => '/products?' + categoryParams(id).toString()}
      initialScroll={shortcutScroll.current?.key === location.key ? shortcutScroll.current.offset : 0}
      saveScroll={offset => {shortcutScroll.current = {key: location.key, offset};}}
    />}
    {!ready?(browse.error||node===-1?null:<div className="catalog-progress" role="status"><Spin/><span>{t('browse.loading')}</span></div>):<>
      {shelfMode?<div className="shopping-shelves">{shelves.map(shelf=><section className="shopping-shelf" key={shelf.category}>
       <header><h2>{shelf.category==='__unclassified'?t('class.unclassified'):localizedContent(browse.page!.categories.find(c=>c.id===shelf.category)?.name??{},locale)}</h2><button type="button" onClick={()=>choose(shelf.category)}>{t('shopping.view_all')} <span aria-hidden>→</span></button></header>
       <div className="catalog-master-grid shopping-shelf-track">{shelf.items.map(renderCard)}</div>
      </section>)}</div>:filtered.length?<div className="catalog-master-grid">{filtered.map(renderCard)}</div>:kind==='marked'?<div className="catalog-marked-empty" role="status"><p>{t(query||category?'store.no_matches':'marker.empty')}</p>{(query||category)&&<Button onClick={()=>{const next=new URLSearchParams(params);next.delete(categoryKey);next.delete('query');setParams(next);}}>{t('class.all')}</Button>}</div>:<Empty description={t(query||category?'store.no_matches':'catalog.empty')}>{category&&<Button onClick={()=>choose('')}>{t('class.all')}</Button>}</Empty>}
      {!shelfMode&&browse.page?.hasNext&&<div className="feed-loader" ref={sentinel}><Button loading={browse.busy} disabled={revealPaused||browse.changed||!!browse.error} onClick={browse.next}>{t('store.load_more')} ({filtered.length}/{browse.page.matchedTotal})</Button></div>}
    </>}
    </section>}
    <Drawer className="rec-product-detail catalog-master-detail consumer-detail-drawer" title={opened?<ProductDetailCode value={opened.itemNumber}/>:t('store.details')} width="min(1120px,100vw)" open={!!detailId} onClose={closeDetail}>
      {detailId&&!opened&&(detail.error?<BrowseError error={detail.error} retry={()=>setDetailAttempt(value=>value+1)} refresh={reload}/>:<Spin/>)}
      {opened&&detailName&&description&&<ConsumerDetail media={<RecommendationImageViewer consumer key={opened.productId} pictures={opened.gallery} name={detailName.value}/>}>
        <ProductMarkerBadges markers={detail.markers??[]} promotionPrices={selectedOfferSource(sale,pricePending(opened.productId),opened.referencePrices?.[0]??mainReference?.facts.priceChange)}/>
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
