import RecommendationBrowse from './RecommendationBrowse';
import {ConsumerDetail,DetailOffer} from '../components/ConsumerDetail';
import ReservationAdd from '../components/ReservationAdd';
import {useDetailReturnFocus} from '../components/useDetailReturnFocus';
import {ProductBrand,ProductVariant} from '../components/ProductMetadata';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Drawer, Empty, Input, Segmented, Spin, Tooltip } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CalendarOutlined, DownOutlined, ExpandOutlined, PlusOutlined, UpOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { storefrontApi,recommendationApi, type RecommendationDetail, type StoreProduct } from '../api';
import { localizedContent, useI18n } from '../i18n';
import { OfferInfo } from '../components/RecommendationFacts';
import '../recommendations.css';
import {categoryChoices,filterRecommendations,searchRecommendations,UNCLASSIFIED} from '../recommendationFilters';
import {scopedPath,selectedNode} from '../storeNavigation';
import {recommendationText} from '../recommendationText';
import SellingPrice from '../components/SellingPrice';
import {RecommendationImageViewer} from '../components/RecommendationImageViewer';
import {RecommendationName} from '../components/RecommendationName';
import type {RecommendationItem} from '../api';

import {articleText,articleTitle} from '../recommendationArticle';

export type ShoppingProps = {
  query?: string;
  autoPaused?:boolean;purchasePending?:boolean;authKey?:string;onSales?:(values:StoreProduct[])=>void;
  readOnlyPreview?:boolean;
  products: StoreProduct[];
  quantities: Record<string, number>;
  onDetail: (product: StoreProduct) => void;
  onAdd: (product: StoreProduct) => void;
  canBuy: (product: StoreProduct) => boolean;
};
const EXCERPT_LENGTH = 80;

export function RecommendationIssue({ detail, number, single, catalog, quantities, onAdd, canBuy,readOnlyPreview }: ShoppingProps & {
  detail: RecommendationDetail; number: number; single: boolean; catalog: Map<string, StoreProduct>;
}) {
  const { t, locale } = useI18n();
  const {search}=useLocation();
  const [expanded, setExpanded] = useState(false);
  const [pressedItem,setPressedItem]=useState<number>();
  useEffect(()=>{const clear=()=>setPressedItem(undefined);window.addEventListener('blur',clear);return()=>window.removeEventListener('blur',clear);},[]);
  const [localItem,setLocalItem]=useState<number>();
  const [params,setParams]=useSearchParams();
  const privatePreview=useLocation().pathname.startsWith('/admin');
  const opened=detail.items.find(item=>item.id===(privatePreview?localItem:Number(params.get('item'))));
  const focusRoot=useRef<HTMLElement>(null),rememberFocus=useDetailReturnFocus(focusRoot,opened?`${detail.post.id}:${opened.id}`:undefined,JSON.stringify([detail.post.id,search.replace(/([?&])item=[^&]*/,'')]));
  function openItem(item:RecommendationItem,trigger:HTMLElement){rememberFocus(trigger,`${detail.post.id}:${item.id}`);if(privatePreview)setLocalItem(item.id);else{const next=new URLSearchParams(params);next.set('item',String(item.id));setParams(next);}}
  function closeItem(){if(privatePreview)setLocalItem(undefined);else{const next=new URLSearchParams(params);next.delete('item');setParams(next,{replace:true});}}

  const grid = useRef<HTMLDivElement>(null);
  const article=articleText(detail,locale);
  const body = Array.from(article.body);
  const truncated = body.length > EXCERPT_LENGTH;
  const shown = !expanded && truncated ? body.slice(0, EXCERPT_LENGTH).join('').replace(/\s+/g, ' ').trimEnd() + '…' : article.body;
  const Heading = single ? 'h1' : 'h2';
  useEffect(() => {
    if (!grid.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => entries.forEach(entry => {
      (entry.target as HTMLElement).style.gridRowEnd = 'span ' + Math.ceil((entry.target.getBoundingClientRect().height + 12) / 13);
    }));
    Array.from(grid.current.children).forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [detail]);
  return <article ref={focusRoot} className="rec-issue" id={'recommendation-' + detail.post.id} aria-labelledby={'rec-title-' + detail.post.id}>
    <header className="rec-issue-heading">
      {!single && <span className="rec-issue-number">{String(number).padStart(2, '0')}</span>}
      <div><Heading tabIndex={-1} data-detail-focus-fallback id={'rec-title-' + detail.post.id}>{single ? article.title : <Link to={'/recommendations?'+new URLSearchParams({...Object.fromEntries(new URLSearchParams(search)),topic:String(detail.post.id)})}>{article.title}</Link>}</Heading>
        {(detail.post.publisherName||detail.post.publishedAt)&&<div className="rec-publication">{detail.post.publisherName&&<span><UserOutlined /> {t('detail.published_signature')}: {detail.post.publisherName}</span>}{detail.post.publishedAt&&<time dateTime={detail.post.publishedAt}><CalendarOutlined /> {new Date(detail.post.publishedAt).toLocaleDateString(locale)}</time>}</div>}
      </div>
    </header>
    {(article.missingTitle||article.missingBody)&&<Alert type="info" showIcon message={t(article.sourceKnown?'article.source_fallback':'article.legacy')} description={[article.missingTitle?t('rec.article_title'):'',article.missingBody?t('rec.body'):''].filter(Boolean).join(' · ')}/>}
    {detail.serviceOffer&&<span className="service-kind">{t('service.kind')}</span>}
    <div className="rec-public-body" id={'rec-body-' + detail.post.id}>{shown.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    {truncated && <Button type="text" className="rec-expand" aria-expanded={expanded} aria-controls={'rec-body-' + detail.post.id} icon={expanded ? <UpOutlined /> : <DownOutlined />} onClick={() => setExpanded(value => !value)}>{t(expanded ? 'rec.collapse' : 'rec.read_more')}</Button>}
    {!detail.serviceOffer&&<div className="rec-products-heading"><h3>{t('rec.products')} <span>{detail.items.length}</span></h3>{!single && <Link to={'/recommendations/' + detail.post.id+search}>{t('rec.view')} <ArrowRightOutlined /></Link>}</div>}
    {!detail.serviceOffer&&<div className="product-masonry rec-public-products" ref={grid}>{detail.items.map((item, index) => {
      const text=recommendationText(item,locale);
      const product = item.productId ? catalog.get(item.productId) : undefined;
      const buyable = !!product && canBuy(product);
      return <article className="store-product rec-pin" key={item.id} data-occurrence-key={`${detail.post.id}:${item.id}`} data-pressed={pressedItem===item.id||undefined}
        onPointerDown={event=>{if(event.pointerType!=='mouse')setPressedItem(item.id);}}
        onPointerUp={()=>setPressedItem(undefined)} onPointerCancel={()=>setPressedItem(undefined)}
        onPointerLeave={()=>setPressedItem(undefined)} onLostPointerCapture={()=>setPressedItem(undefined)}>
        <div className={'product-tile product-shape-' + index % 4}>
          <button className="product-photo" data-detail-trigger="photo" aria-label={t('store.detail_label', {name:item.name})} onClick={event => openItem(item,event.currentTarget)}>{item.gallery?.[0]?.url?<img src={item.gallery[0].url} alt={text.name} loading={index < 2 && number === 1 ? 'eager' : 'lazy'} />:<span className="rec-no-product-image">{t('gallery.pending')}</span>}</button>
          <ReservationAdd allowed={buyable} quote={product} name={text.name} count={item.productId?quantities[item.productId]:undefined} onAdd={()=>{if(product&&buyable)onAdd(product);}}/>
          <Tooltip title={t('store.details')}><button className="rec-pin-preview" data-detail-trigger="preview" aria-label={t('store.details') + ': ' + text.name} onClick={event => openItem(item,event.currentTarget)}><ExpandOutlined /></button></Tooltip>
          <div className="product-body"><ProductBrand brand={item.brand}/><button className="product-name" data-detail-trigger="name" onClick={event=>openItem(item,event.currentTarget)}><h3 title={text.name}><RecommendationName text={text}/></h3></button>{text.specification&&<p className="rec-compact-spec">{text.specification}</p>}{text.missing&&<small>{t('article.field_source',{fields:text.sourceFields.map(key=>t(key==='description'?'master.descriptions':key==='specification'?'master.specifications':'rec.fact.'+key)).join(' · ')})}</small>}</div>
        </div>
        <small className="rec-pin-code">{t('rec.code')}: {item.itemNumber || t('rec.not_stated')}</small>
        {!!item.categories?.length&&<div className="rec-item-categories">{item.categories.map(category=><span key={category.id}>{localizedContent(category.name,locale)}</span>)}</div>}
        {item.showSupplier&&item.supplierName&&<small className="rec-supplier">{t('class.supplier')}: {localizedContent(item.supplierName,locale)}</small>}
        <OfferInfo facts={{...item,offerNotes:text.offerNotes}} compact/>
        {!!(text.offerNotes||text.description)&&<button className="rec-condition-link" data-detail-trigger="conditions" onClick={event=>openItem(item,event.currentTarget)}>{t('rec.conditions_detail')}</button>}
        {product&&<SellingPrice product={product}/>}
      </article>;
    })}</div>}
    <RecommendationProductDetail item={opened} onClose={closeItem} product={opened?.productId?catalog.get(opened.productId):undefined} onAdd={onAdd} canBuy={canBuy}/>

  </article>;
}

function RecommendationProductDetail({item,product,onClose,onAdd,canBuy,purchasePending=false}:{item?:RecommendationItem;product?:StoreProduct;purchasePending?:boolean;onClose:()=>void;onAdd:(p:StoreProduct)=>void;canBuy:(p:StoreProduct)=>boolean}){
 const {t,locale}=useI18n();
 if(!item)return null;const text=recommendationText(item,locale),gallery=item.gallery??[];
 return <Drawer className="rec-product-detail consumer-detail-drawer" title={t('store.details')} width="min(1120px,100vw)" open={!!item} onClose={onClose}>
  <ConsumerDetail media={<RecommendationImageViewer consumer key={item.id} pictures={gallery} name={text.name}/>}>
  <ProductBrand brand={item.brand}/><h1><RecommendationName text={text}/></h1><ProductVariant model={item.model} packaging={item.packaging}/><p>{t('rec.code')}: {item.itemNumber||t('rec.not_stated')}</p>{text.missing&&<Alert type="info" message={t('article.field_source',{fields:text.sourceFields.map(key=>t(key==='description'?'master.descriptions':key==='specification'?'master.specifications':'rec.fact.'+key)).join(' · ')})}/>}
  {text.specification&&<p className="rec-detail-spec">{text.specification}</p>}
  {product&&<SellingPrice product={product}/>}
  <DetailOffer facts={{...item,offerNotes:text.offerNotes}}/>
  {text.description&&<section className="rec-detail-description"><h2>{t('detail.description')}</h2>{text.description.split('\n').map((line,i)=><p key={i}>{line}</p>)}</section>}
  {item.showSupplier&&item.supplierName&&<p>{t('class.supplier')}: {localizedContent(item.supplierName,locale)}</p>}
  <Button type="primary" size="large" block disabled={purchasePending||!product||!canBuy(product)} onClick={()=>product&&onAdd(product)}>{t(purchasePending?'browse.sales_pending':product&&canBuy(product)?'store.add_cart':'catalog.not_available')}</Button>
  </ConsumerDetail>
 </Drawer>;
}

export function CategoryFilters({posts,category,onChoose}:{posts:RecommendationDetail[];category:string;onChoose:(value:string)=>void}) {
  const {t,locale}=useI18n(),choices=categoryChoices(posts);
  if(choices.total===0)return null;
  return <nav className="rec-category-filters" aria-label={t('class.filters')}>
    <button type="button" aria-pressed={!category} onClick={()=>onChoose('')}>{t('class.all')} ({choices.total})</button>
    {choices.categories.map(value=><button type="button" key={value.id} aria-pressed={category===value.id} onClick={()=>onChoose(value.id)}>{localizedContent(value.name,locale)} ({value.count})</button>)}
    {!!choices.unclassified&&<button type="button" aria-pressed={category===UNCLASSIFIED} onClick={()=>onChoose(UNCLASSIFIED)}>{t('class.unclassified')} ({choices.unclassified})</button>}
    {category&&category!==UNCLASSIFIED&&!choices.categories.some(value=>value.id===category)&&<button type="button" aria-pressed="true">{t('class.selected_filter')}</button>}
  </nav>;
}

// The editor uses the same cards and filters as the public page, with local state
// and no publishing, save, purchase or public draft endpoint.
export function RecommendationPreview({detail}:{detail:RecommendationDetail}) {
  const {t,locale}=useI18n();const [category,setCategory]=useState(''),[device,setDevice]=useState('full'),[query,setQuery]=useState('');
  const [products,setProducts]=useState<StoreProduct[]>([]);useEffect(()=>{let active=true;void storefrontApi.products().then(values=>{if(active)setProducts(values);}).catch(()=>{});return()=>{active=false;};},[detail.post.id]);
  const posts=searchRecommendations([detail],query,locale);
  const visible=filterRecommendations(posts,category),catalog=new Map(products.map(product=>[product.id,product]));
  return <section className="rec-draft-preview"><p>{t('browse.preview_hint')}</p><Segmented aria-label={t('browse.preview_size')} value={device} onChange={value=>setDevice(String(value))} options={[{value:'full',label:t('browse.desktop')},{value:'mobile',label:t('browse.mobile')}]}/>
    <div className="storefront browse-preview" data-device={device}><section className="recommendations rec-public">
      <Input className="browse-search" aria-label={t('store.search')} placeholder={t('store.search')} value={query} onChange={event=>setQuery(event.target.value)} allowClear/>
      <CategoryFilters posts={posts} category={category} onChoose={setCategory}/>
      {visible.length?<RecommendationIssue readOnlyPreview detail={visible[0]} number={1} single catalog={catalog} products={products} quantities={{}} onDetail={()=>{}} onAdd={()=>{}} canBuy={()=>false}/>:<Empty description={t('class.empty')}><Button onClick={()=>setCategory('')}>{t('class.all')}</Button></Empty>}
    </section></div>
  </section>;
}

export default function PublicRecommendations(props:ShoppingProps){return <RecommendationBrowse {...props} renderProduct={(item,product,close,pending)=><RecommendationProductDetail item={item} product={product} onClose={close} onAdd={props.onAdd} canBuy={props.canBuy} purchasePending={pending}/>}/>;}
