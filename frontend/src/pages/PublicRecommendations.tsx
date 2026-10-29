import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Drawer, Empty, Input, Segmented, Spin, Tooltip } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CalendarOutlined, DownOutlined, ExpandOutlined, PlusOutlined, UpOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { storefrontApi,recommendationApi, type RecommendationDetail, type StoreProduct } from '../api';
import { localizedContent, useI18n } from '../i18n';
import { OfferInfo } from '../components/RecommendationFacts';
import '../recommendations.css';
import {availableCategory,categoryChoices,filterRecommendations,issueScope,readAllIssues,UNCLASSIFIED} from '../recommendationFilters';
import {scopedPath,selectedNode} from '../storeNavigation';
import {recommendationText} from '../recommendationText';
import SellingPrice from '../components/SellingPrice';
import {RecommendationImageViewer} from '../components/RecommendationImageViewer';
import {RecommendationName} from '../components/RecommendationName';
import type {RecommendationItem} from '../api';
import {arrangeIssues,useJapaneseDay} from '../recommendationSchedule';

type ShoppingProps = {
  query?: string;
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
  function openItem(item:RecommendationItem){if(privatePreview)setLocalItem(item.id);else{const next=new URLSearchParams(params);next.set('item',String(item.id));setParams(next);}}
  function closeItem(){if(privatePreview)setLocalItem(undefined);else{const next=new URLSearchParams(params);next.delete('item');setParams(next,{replace:true});}}

  const grid = useRef<HTMLDivElement>(null);
  const body = Array.from(detail.body);
  const truncated = body.length > EXCERPT_LENGTH;
  const shown = !expanded && truncated ? body.slice(0, EXCERPT_LENGTH).join('').replace(/\s+/g, ' ').trimEnd() + '…' : detail.body;
  const Heading = single ? 'h1' : 'h2';
  useEffect(() => {
    if (!grid.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => entries.forEach(entry => {
      (entry.target as HTMLElement).style.gridRowEnd = 'span ' + Math.ceil((entry.target.getBoundingClientRect().height + 12) / 13);
    }));
    Array.from(grid.current.children).forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [detail]);
  return <article className="rec-issue" id={'recommendation-' + detail.post.id} aria-labelledby={'rec-title-' + detail.post.id}>
    <header className="rec-issue-heading">
      {!single && <span className="rec-issue-number">{String(number).padStart(2, '0')}</span>}
      <div><Heading id={'rec-title-' + detail.post.id}>{single ? detail.post.title : <Link to={'/recommendations?'+new URLSearchParams({...Object.fromEntries(new URLSearchParams(search)),topic:String(detail.post.id)})}>{detail.post.title}</Link>}</Heading>
        {(detail.post.publisherName||detail.post.publishedAt)&&<div className="rec-publication">{detail.post.publisherName&&<span><UserOutlined /> {detail.post.publisherName}</span>}{detail.post.publishedAt&&<time dateTime={detail.post.publishedAt}><CalendarOutlined /> {new Date(detail.post.publishedAt).toLocaleDateString(locale)}</time>}</div>}
      </div>
    </header>
    <div className="rec-public-body" id={'rec-body-' + detail.post.id}>{shown.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    {truncated && <Button type="text" className="rec-expand" aria-expanded={expanded} aria-controls={'rec-body-' + detail.post.id} icon={expanded ? <UpOutlined /> : <DownOutlined />} onClick={() => setExpanded(value => !value)}>{t(expanded ? 'rec.collapse' : 'rec.read_more')}</Button>}
    <div className="rec-products-heading"><h3>{t('rec.products')} <span>{detail.items.length}</span></h3>{!single && <Link to={'/recommendations/' + detail.post.id+search}>{t('rec.view')} <ArrowRightOutlined /></Link>}</div>
    <div className="product-masonry rec-public-products" ref={grid}>{detail.items.map((item, index) => {
      const text=recommendationText(item,locale);
      const product = item.productId ? catalog.get(item.productId) : undefined;
      const buyable = !!product && canBuy(product);
      return <article className="store-product rec-pin" key={item.id} data-pressed={pressedItem===item.id||undefined}
        onPointerDown={event=>{if(event.pointerType!=='mouse')setPressedItem(item.id);}}
        onPointerUp={()=>setPressedItem(undefined)} onPointerCancel={()=>setPressedItem(undefined)}
        onPointerLeave={()=>setPressedItem(undefined)} onLostPointerCapture={()=>setPressedItem(undefined)}>
        <div className={'product-tile product-shape-' + index % 4}>
          <button className="product-photo" aria-label={t('store.detail_label', {name:item.name})} onClick={() => openItem(item)}>{item.gallery?.[0]?.url?<img src={item.gallery[0].url} alt={text.name} loading={index < 2 && number === 1 ? 'eager' : 'lazy'} />:<span className="rec-no-product-image">{t('gallery.pending')}</span>}</button>
          <Tooltip title={buyable ? t('store.add_cart') : t('store.unavailable')}><button className="product-add" aria-label={t('store.add_label', {name:item.name})} disabled={!buyable} onClick={() => product && onAdd(product)}><PlusOutlined />{!!(item.productId && quantities[item.productId]) && <span className="product-count">{quantities[item.productId!]}</span>}</button></Tooltip>
          <Tooltip title={t('store.details')}><button className="rec-pin-preview" aria-label={t('store.details') + ': ' + text.name} onClick={() => openItem(item)}><ExpandOutlined /></button></Tooltip>
          <div className="product-body"><button className="product-name" onClick={()=>openItem(item)}><h3 title={text.name}><RecommendationName text={text}/></h3></button>{text.specification&&<p className="rec-compact-spec">{text.specification}</p>}{text.missing&&<small>{t('translation.fallback')}</small>}</div>
        </div>
        <small className="rec-pin-code">{t('rec.code')}: {item.itemNumber || t('rec.not_stated')}</small>
        {!!item.categories?.length&&<div className="rec-item-categories">{item.categories.map(category=><span key={category.id}>{localizedContent(category.name,locale)}</span>)}</div>}
        {item.showSupplier&&item.supplierName&&<small className="rec-supplier">{t('class.supplier')}: {localizedContent(item.supplierName,locale)}</small>}
        <OfferInfo facts={{...item,offerNotes:text.offerNotes}} compact/>
        {!!(text.offerNotes||text.description)&&<button className="rec-condition-link" onClick={()=>openItem(item)}>{t('rec.conditions_detail')}</button>}
        {product&&<SellingPrice product={product}/>}
        {!buyable && <small className="rec-pin-status">{t(readOnlyPreview?'rec.preview_only':item.productId ? 'catalog.not_available' : 'rec.reference_only')}</small>}
      </article>;
    })}</div>
    <RecommendationProductDetail item={opened} onClose={closeItem} product={opened?.productId?catalog.get(opened.productId):undefined} onAdd={onAdd} canBuy={canBuy}/>

  </article>;
}

function RecommendationProductDetail({item,product,onClose,onAdd,canBuy}:{item?:RecommendationItem;product?:StoreProduct;onClose:()=>void;onAdd:(p:StoreProduct)=>void;canBuy:(p:StoreProduct)=>boolean}){
 const {t,locale}=useI18n();
 if(!item)return null;const text=recommendationText(item,locale),gallery=item.gallery??[];
 return <Drawer className="rec-product-detail" title={t('store.details')} width="min(100vw,760px)" open={!!item} onClose={onClose}>
  <RecommendationImageViewer key={item.id} pictures={gallery} name={text.name}/>
  <h1><RecommendationName text={text}/></h1><p>{t('rec.code')}: {item.itemNumber||t('rec.not_stated')}</p>{text.missing&&<Alert type="info" message={t('translation.fallback')}/>}
  {text.specification&&<p className="rec-detail-spec">{text.specification}</p>}
  {product&&<SellingPrice product={product}/>}
  <OfferInfo facts={{...item,offerNotes:text.offerNotes}}/>
  {text.description&&<section className="rec-detail-description"><h2>{t('store.details')}</h2>{text.description.split('\n').map((line,i)=><p key={i}>{line}</p>)}</section>}
  {item.showSupplier&&item.supplierName&&<p>{t('class.supplier')}: {localizedContent(item.supplierName,locale)}</p>}
  {gallery.length>0&&<details><summary>{t('gallery.sources')}</summary>{gallery.map(picture=><p key={picture.id}><a href={picture.sourceUrl} target="_blank" rel="noopener noreferrer">{picture.label||new URL(picture.sourceUrl).hostname}</a></p>)}</details>}
  <Button type="primary" size="large" block disabled={!product||!canBuy(product)} onClick={()=>product&&onAdd(product)}>{t(product&&canBuy(product)?'store.add_cart':'catalog.not_available')}</Button>
 </Drawer>;
}

export function CategoryFilters({posts,category,onChoose}:{posts:RecommendationDetail[];category:string;onChoose:(value:string)=>void}) {
  const {t,locale}=useI18n(),choices=categoryChoices(posts);
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
  const {t}=useI18n();const [category,setCategory]=useState(''),[device,setDevice]=useState('full'),[query,setQuery]=useState('');
  const [products,setProducts]=useState<StoreProduct[]>([]);useEffect(()=>{let active=true;void storefrontApi.products().then(values=>{if(active)setProducts(values);}).catch(()=>{});return()=>{active=false;};},[detail.post.id]);
  const posts=[{...detail,items:detail.items.filter(item=>(item.name+' '+(item.itemNumber??'')).toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()))}];
  const visible=filterRecommendations(posts,category),catalog=new Map(products.map(product=>[product.id,product]));
  return <section className="rec-draft-preview"><p>{t('browse.preview_hint')}</p><Segmented aria-label={t('browse.preview_size')} value={device} onChange={value=>setDevice(String(value))} options={[{value:'full',label:t('browse.desktop')},{value:'mobile',label:t('browse.mobile')}]}/>
    <div className="storefront browse-preview" data-device={device}><section className="recommendations rec-public">
      <Input className="browse-search" aria-label={t('store.search')} placeholder={t('store.search')} value={query} onChange={event=>setQuery(event.target.value)} allowClear/>
      <CategoryFilters posts={posts} category={category} onChoose={setCategory}/>
      {visible.length?<RecommendationIssue readOnlyPreview detail={visible[0]} number={1} single catalog={catalog} products={products} quantities={{}} onDetail={()=>{}} onAdd={()=>{}} canBuy={()=>false}/>:<Empty description={t('class.empty')}><Button onClick={()=>setCategory('')}>{t('class.all')}</Button></Empty>}
    </section></div>
  </section>;
}

export default function PublicRecommendations(props: ShoppingProps) {
  const { id } = useParams();
  const { t,locale } = useI18n();
  const [params,setParams]=useSearchParams();
  const category=params.get('category')??'';
  const topic=id??params.get('topic')??'';
  const node=selectedNode('?'+params.toString());
  const [posts, setPosts] = useState<RecommendationDetail[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [loadedKey,setLoadedKey]=useState('');
  const requestKey=JSON.stringify([node]);
  const pending=busy||loadedKey!==requestKey;
  const catalog = useMemo(() => new Map(props.products.map(product => [product.id, product])), [props.products]);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(''); setPosts([]);
    const request = node===-1 ? Promise.resolve([]) : readAllIssues(page=>recommendationApi.feed(page,node),()=>active);
    void request.then(value => { if (active) setPosts(value); }).catch(e => { if (active) setError((e as Error).message); }).finally(() => { if (active) {setLoadedKey(requestKey);setBusy(false);} });
    return () => { active = false; };
  }, [node]);
  const today=useJapaneseDay();
  const arranged=useMemo(()=>arrangeIssues(posts,today),[posts,today]);
  const ordered=useMemo(()=>[...arranged.current,...arranged.history],[arranged]);
  const historyIds=useMemo(()=>new Set(arranged.history.map(entry=>entry.post.id)),[arranged]);
  const selected=pending?[]:issueScope(ordered,topic);
  const query=props.query?.trim().toLocaleLowerCase()??'';
  const scope=query?selected.map(post=>({...post,items:post.items.filter(item=>(recommendationText(item,locale).name+' '+(item.itemNumber??'')).toLocaleLowerCase().includes(query))})).filter(post=>post.items.length):selected;
  const activeCategory=availableCategory(scope,category);
  const visible=filterRecommendations(scope,activeCategory);
  useEffect(()=>{if(pending||error||!category||activeCategory===category)return;const next=new URLSearchParams(params);next.delete('category');setParams(next,{replace:true});},[pending,error,category,activeCategory,params,setParams]);
  function choose(value:string){if(value===activeCategory)return;const next=new URLSearchParams(params);next.delete('item');if(value)next.set('category',value);else next.delete('category');setParams(next);}
  function topicPath(value:string){const next=new URLSearchParams(params);next.delete('item');if(value)next.set('topic',value);else next.delete('topic');const target=issueScope(ordered,value),searched=query?target.map(post=>({...post,items:post.items.filter(item=>(recommendationText(item,locale).name+' '+(item.itemNumber??'')).toLocaleLowerCase().includes(query))})):target;if(!availableCategory(searched,category))next.delete('category');return '/recommendations'+(next.size?'?'+next.toString():'');}
  const currentVisible=topic?visible:visible.filter(entry=>!historyIds.has(entry.post.id));
  const historyVisible=topic?[]:visible.filter(entry=>historyIds.has(entry.post.id));
  const selectedHistory=!!topic&&historyIds.has(Number(topic));
  const issue=(entry:RecommendationDetail,index:number)=><div className="rec-issue-section" key={entry.post.id}><RecommendationIssue {...props} catalog={catalog} detail={entry} number={index+1} single={!!topic}/></div>;

  return <section className="recommendations rec-public">
    <Link className="rec-back" to={id ? topicPath('') : scopedPath('/products', '?'+params.toString())}><ArrowLeftOutlined /> {t(id ? 'rec.title' : 'store.catalog')}</Link>
    {!id && <header className="rec-feed-heading"><h1>{t('rec.title')}</h1></header>}
    {!pending&&!error&&<><nav className="rec-issue-directory" aria-label={t('rec.contents')}><Link aria-current={!topic?'page':undefined} to={topicPath('')}>{t('class.all')}</Link>{arranged.current.map(entry=><Link key={entry.post.id} aria-current={String(entry.post.id)===topic?'page':undefined} to={topicPath(String(entry.post.id))}>{entry.post.title}</Link>)}</nav>
      {!!arranged.history.length&&<details className="rec-history-topics" open={selectedHistory||undefined}><summary>{t('rec.history_topics')} ({arranged.history.length})</summary><nav className="rec-history-directory" aria-label={t('rec.history_topics')}>{arranged.history.map(entry=><Link key={entry.post.id} aria-current={String(entry.post.id)===topic?'page':undefined} to={topicPath(String(entry.post.id))}>{entry.post.title}</Link>)}</nav></details>}
      <CategoryFilters posts={scope} category={activeCategory} onChoose={choose}/></>}
    {pending ? <div className="rec-loading"><Spin /></div> : error ? <Alert type="error" message={error} /> : <>
      {selectedHistory&&<p className="rec-history-note">{t('rec.past_issue')}</p>}
      {visible.length ? <>{currentVisible.map(issue)}{!!historyVisible.length&&<details className="rec-history-content" open={!!(query||activeCategory)||undefined}><summary>{t('rec.history')} ({historyVisible.length})</summary>{historyVisible.map((entry,index)=>issue(entry,currentVisible.length+index))}</details>}</> : <Empty description={t(query?'store.no_matches':'rec.empty_public')}/>}
    </>}
  </section>;
}
