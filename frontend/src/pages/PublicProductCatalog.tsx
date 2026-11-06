import {useEffect,useMemo,useState} from 'react';
import {Alert,Button,Drawer,Empty,Spin,Tooltip} from 'antd';
import {ArrowDownOutlined,PlusOutlined,ReloadOutlined} from '@ant-design/icons';
import {Link,useLocation,useSearchParams} from 'react-router-dom';
import {storefrontApi,type PublicCatalogEntry,type StoreProduct} from '../api';
import {localizedContent,useI18n,type Locale} from '../i18n';
import {ProductBrand,ProductVariant} from '../components/ProductMetadata';
import {RecommendationImageViewer} from '../components/RecommendationImageViewer';
import {OfferInfo} from '../components/RecommendationFacts';
import SellingPrice from '../components/SellingPrice';
import {selectedNode} from '../storeNavigation';
import {catalogCategories,catalogSale,CATALOG_BATCH,CATALOG_UNCLASSIFIED,filterPublicCatalog,readPublicCatalog,searchPublicCatalog} from '../publicCatalog';
import '../recommendations.css';
import '../public-catalog.css';

type Props={query?:string;products:StoreProduct[];quantities:Record<string,number>;onAdd:(product:StoreProduct)=>void;canBuy:(product:StoreProduct)=>boolean};
export function catalogText(values:Record<string,string>,locale:Locale) {
  const value=localizedContent(values,locale);
  const language=values[locale]?locale:Object.keys(values).find(key=>values[key]===value);
  return {value,language,fallback:!!value&&language!==locale};
}

export default function PublicProductCatalog({query='',products,quantities,onAdd,canBuy}:Props) {
  const {t,locale}=useI18n(),location=useLocation();
  const [params,setParams]=useSearchParams();
  const node=selectedNode(location.search),scope=String(node??'all');
  const category=params.get('category')??'';
  const [state,setState]=useState<{scope:string;entries:PublicCatalogEntry[];complete:boolean;error:string;loaded:number;total?:number}>({scope:'',entries:[],complete:false,error:'',loaded:0});
  const [attempt,setAttempt]=useState(0),[limit,setLimit]=useState(CATALOG_BATCH),[detailId,setDetailId]=useState<string>();
  useEffect(()=>{
    let active=true;
    setState({scope,entries:[],complete:false,error:'',loaded:0});setDetailId(undefined);setLimit(CATALOG_BATCH);
    const request=node===-1?Promise.resolve([]):readPublicCatalog(page=>storefrontApi.productCatalog(page,node),()=>active,(loaded,total)=>{
      if(active)setState(previous=>({...previous,loaded,total}));
    });
    void request.then(entries=>{if(active)setState({scope,entries,complete:true,error:'',loaded:entries.length,total:entries.length});})
      .catch(error=>{if(active)setState(previous=>({...previous,error:(error as Error).message}));});
    return()=>{active=false;};
  },[node,scope,attempt]);
  useEffect(()=>{setLimit(CATALOG_BATCH);},[query,category,scope]);
  const current=state.scope===scope;
  const ready=current&&state.complete&&!state.error;
  const searched=useMemo(()=>searchPublicCatalog(ready?state.entries:[],query),[ready,state.entries,query]);
  const choices=useMemo(()=>catalogCategories(searched),[searched]);
  const filtered=useMemo(()=>filterPublicCatalog(searched,category),[searched,category]);
  const opened=ready?state.entries.find(entry=>entry.productId===detailId):undefined;
  const sale=opened?catalogSale(opened,products):undefined;
  function choose(value:string) {
    if(value===category)return;
    const next=new URLSearchParams(params);next.delete('item');
    if(value)next.set('category',value);else next.delete('category');setParams(next);
  }
  function sourceNote(text:ReturnType<typeof catalogText>) {
    return text.fallback?<small className="catalog-source">{t('catalog.source_language',{language:text.language??''})}</small>:null;
  }
  const detailName=opened?catalogText(opened.name,locale):undefined;
  const detailSpec=opened?catalogText(opened.specification,locale):undefined;
  const description=opened?catalogText(opened.description,locale):undefined;
  return <section className="recommendations rec-public public-product-catalog" aria-label={t('store.catalog')} aria-busy={!ready&&(!current||!state.error)}>
    <header className="catalog-master-heading"><h1>{t('store.catalog')}</h1>{ready&&<span role="status">{t('catalog.result_count',{shown:filtered.length,total:state.total??0})}</span>}</header>
    {!current||(!state.complete&&!state.error)?<div className="catalog-progress" role="status"><Spin/><span>{t('catalog.loading',{loaded:current?state.loaded:0,total:current?(state.total??'?'):'?'})}</span></div>:state.error?<Alert type="error" showIcon message={t('catalog.load_error')} description={t(state.error)} action={<Button icon={<ReloadOutlined aria-hidden/>} onClick={()=>setAttempt(value=>value+1)}>{t('catalog.retry')}</Button>}/>:<>
      <nav className="rec-category-filters" aria-label={t('class.filters')}>
        <button type="button" aria-pressed={!category} onClick={()=>choose('')}>{t('class.all')} ({choices.total})</button>
        {choices.categories.map(value=><button type="button" key={value.id} aria-pressed={category===value.id} onClick={()=>choose(value.id)}>{localizedContent(value.name,locale)} ({value.count})</button>)}
        {!!choices.unclassified&&<button type="button" aria-pressed={category===CATALOG_UNCLASSIFIED} onClick={()=>choose(CATALOG_UNCLASSIFIED)}>{t('class.unclassified')} ({choices.unclassified})</button>}
        {category&&category!==CATALOG_UNCLASSIFIED&&!choices.categories.some(value=>value.id===category)&&<button type="button" aria-pressed="true" onClick={()=>choose('')}>{t('class.selected_filter')}</button>}
      </nav>
      {filtered.length?<div className="catalog-master-grid">{filtered.slice(0,limit).map((entry,index)=>{
        const name=catalogText(entry.name,locale),spec=catalogText(entry.specification,locale);
        const product=catalogSale(entry,products),buyable=!!product&&canBuy(product);
        return <article className="store-product rec-pin catalog-master-card" key={entry.productId} data-product-id={entry.productId}>
          <div className="product-tile">
            <button type="button" className="product-photo" aria-label={t('store.detail_label',{name:name.value})} onClick={()=>setDetailId(entry.productId)}>
              {entry.gallery[0]?.url?<img src={entry.gallery[0].url} alt={name.value} loading={index<2?'eager':'lazy'}/>:<span className="rec-no-product-image">{t('gallery.pending')}</span>}
            </button>
            <Tooltip title={t(buyable?'store.add_cart':'catalog.not_available')}><button type="button" className="product-add" disabled={!buyable} aria-label={t('store.add_label',{name:name.value})} onClick={()=>{if(product&&buyable)onAdd(product);}}><PlusOutlined aria-hidden/>{!!quantities[entry.productId]&&<span className="product-count">{quantities[entry.productId]}</span>}</button></Tooltip>
            <div className="product-body"><ProductBrand brand={entry.brand}/><button type="button" className="product-name" onClick={()=>setDetailId(entry.productId)}><h2 lang={name.language}>{name.value||t('rec.not_stated')}</h2></button>{spec.value&&<p className="catalog-card-spec" lang={spec.language}>{spec.value}</p>}</div>
          </div>
          {(name.fallback||spec.fallback)&&sourceNote(name.fallback?name:spec)}
          <small className="rec-pin-code">{t('rec.code')}: {entry.itemNumber||t('rec.not_stated')}</small>
          {product&&<SellingPrice product={product}/>}
          {!!entry.referenceOffers.length&&<button type="button" className="catalog-offer-link" onClick={()=>setDetailId(entry.productId)}>{t('catalog.reference_count',{count:entry.referenceOffers.length})}</button>}
          {!buyable&&<small className="rec-pin-status">{t('catalog.not_available')}</small>}
        </article>;
      })}</div>:<Empty description={t(query||category?'store.no_matches':'catalog.empty')}>{category&&<Button onClick={()=>choose('')}>{t('class.all')}</Button>}</Empty>}
      {limit<filtered.length&&<div className="feed-loader"><Button icon={<ArrowDownOutlined aria-hidden/>} onClick={()=>setLimit(value=>Math.min(value+CATALOG_BATCH,filtered.length))}>{t('store.load_more')} ({Math.min(limit,filtered.length)}/{filtered.length})</Button></div>}
    </>}
    <Drawer className="rec-product-detail catalog-master-detail" title={t('store.details')} width="min(100vw,760px)" open={!!opened} onClose={()=>setDetailId(undefined)}>
      {opened&&detailName&&detailSpec&&description&&<>
        <RecommendationImageViewer key={opened.productId} pictures={opened.gallery} name={detailName.value}/>
        <ProductBrand brand={opened.brand}/><h1 lang={detailName.language}>{detailName.value||t('rec.not_stated')}</h1>{sourceNote(detailName)}
        <ProductVariant model={opened.model} packaging={opened.packaging}/><p>{t('rec.code')}: {opened.itemNumber||t('rec.not_stated')}</p>
        {detailSpec.value&&<><p lang={detailSpec.language}>{detailSpec.value}</p>{sourceNote(detailSpec)}</>}
        {sale&&<SellingPrice product={sale}/>}
        {description.value&&<section><h2>{t('store.details')}</h2>{sourceNote(description)}<div lang={description.language}>{description.value.split('\n').map((line,index)=><p key={index}>{line}</p>)}</div></section>}
        {!!opened.referenceOffers.length&&<section className="catalog-reference-history"><h2>{t('catalog.reference_count',{count:opened.referenceOffers.length})}</h2>{opened.referenceOffers.map(offer=>{
          const next=new URLSearchParams(location.search);next.set('item',String(offer.facts.id));
          return <section key={offer.postId+':'+offer.facts.id}><Link to={'/recommendations/'+offer.postId+'?'+next.toString()}>{t('catalog.source_issue',{id:offer.postId})}</Link>{offer.facts.referenceContext?.channel&&<p>{t('ref.channel')}: {t('ref.'+offer.facts.referenceContext.channel)}</p>}<OfferInfo facts={{...offer.facts,offerNotes:undefined}}/></section>;
        })}</section>}
        <Button type="primary" size="large" block icon={<PlusOutlined aria-hidden/>} disabled={!sale||!canBuy(sale)} onClick={()=>{if(sale&&canBuy(sale))onAdd(sale);}}>{t(sale&&canBuy(sale)?'store.add_cart':'catalog.not_available')}</Button>
      </>}
    </Drawer>
  </section>;
}
