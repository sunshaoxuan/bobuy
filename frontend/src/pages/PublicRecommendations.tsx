import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Empty, Image, Input, Segmented, Spin, Tooltip } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CalendarOutlined, DownOutlined, ExpandOutlined, PlusOutlined, UpOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { recommendationApi, type RecommendationDetail, type StoreProduct } from '../api';
import { localizedContent, useI18n } from '../i18n';
import { OfferInfo } from '../components/RecommendationFacts';
import '../recommendations.css';
import {categoryChoices,filterRecommendations,UNCLASSIFIED} from '../recommendationFilters';
import {scopedPath,selectedNode} from '../storeNavigation';

type ShoppingProps = {
  query?: string;
  products: StoreProduct[];
  quantities: Record<string, number>;
  onDetail: (product: StoreProduct) => void;
  onAdd: (product: StoreProduct) => void;
  canBuy: (product: StoreProduct) => boolean;
};
const EXCERPT_LENGTH = 80;

export function RecommendationIssue({ detail, number, single, catalog, quantities, onDetail, onAdd, canBuy }: ShoppingProps & {
  detail: RecommendationDetail; number: number; single: boolean; catalog: Map<string, StoreProduct>;
}) {
  const { t, locale } = useI18n();
  const {search}=useLocation();
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<number>();
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
      <div><Heading id={'rec-title-' + detail.post.id}>{single ? detail.post.title : <Link to={'/recommendations/' + detail.post.id+search}>{detail.post.title}</Link>}</Heading>
        {(detail.post.publisherName||detail.post.publishedAt)&&<div className="rec-publication">{detail.post.publisherName&&<span><UserOutlined /> {detail.post.publisherName}</span>}{detail.post.publishedAt&&<time dateTime={detail.post.publishedAt}><CalendarOutlined /> {new Date(detail.post.publishedAt).toLocaleDateString(locale)}</time>}</div>}
      </div>
    </header>
    <div className="rec-public-body" id={'rec-body-' + detail.post.id}>{shown.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    {truncated && <Button type="text" className="rec-expand" aria-expanded={expanded} aria-controls={'rec-body-' + detail.post.id} icon={expanded ? <UpOutlined /> : <DownOutlined />} onClick={() => setExpanded(value => !value)}>{t(expanded ? 'rec.collapse' : 'rec.read_more')}</Button>}
    <div className="rec-products-heading"><h3>{t('rec.products')} <span>{detail.items.length}</span></h3>{!single && <Link to={'/recommendations/' + detail.post.id+search}>{t('rec.view')} <ArrowRightOutlined /></Link>}</div>
    <div className="product-masonry rec-public-products" ref={grid}>{detail.items.map((item, index) => {
      const product = item.productId ? catalog.get(item.productId) : undefined;
      const buyable = !!product && canBuy(product);
      return <article className="store-product rec-pin" key={item.id}>
        <div className={'product-tile product-shape-' + index % 4}>
          <button className="product-photo" aria-label={t('store.detail_label', {name:item.name})} onClick={() => product ? onDetail(product) : setPreview(index)}><img src={item.imageUrl} alt={item.name} loading={index < 2 && number === 1 ? 'eager' : 'lazy'} /></button>
          <Tooltip title={buyable ? t('store.set_quantity') : t('store.unavailable')}><button className="product-add" aria-label={t('store.add_label', {name:item.name})} disabled={!buyable} onClick={() => product && onAdd(product)}><PlusOutlined />{!!(item.productId && quantities[item.productId]) && <span className="product-count">{quantities[item.productId!]}</span>}</button></Tooltip>
          <Tooltip title={t('rec.original_image')}><button className="rec-pin-preview" aria-label={t('rec.original_image') + ': ' + item.name} onClick={() => setPreview(index)}><ExpandOutlined /></button></Tooltip>
          <div className="product-body"><h3 title={item.name}>{item.name}</h3><strong className="product-price">{item.referencePrice == null ? t('rec.not_stated') : item.referencePrice.toLocaleString(locale)+' JPY'}</strong></div>
        </div>
        <small className="rec-pin-code">{t('rec.code')}: {item.itemNumber || t('rec.not_stated')}</small>
        {!!item.categories?.length&&<div className="rec-item-categories">{item.categories.map(category=><span key={category.id}>{localizedContent(category.name,locale)}</span>)}</div>}
        {item.showSupplier&&item.supplierName&&<small className="rec-supplier">{t('class.supplier')}: {localizedContent(item.supplierName,locale)}</small>}
        <OfferInfo facts={item} />
        {!buyable && <small className="rec-pin-status">{t(item.productId ? 'catalog.not_available' : 'rec.reference_only')}</small>}
      </article>;
    })}</div>
    <Image.PreviewGroup items={detail.items.map(item => ({src:item.imageUrl,alt:item.name}))} preview={{rootClassName:'rec-image-preview',visible:preview !== undefined,current:preview ?? 0,onChange:setPreview,onVisibleChange:visible => { if (!visible) setPreview(undefined); }}} />
  </article>;
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
  const posts=[{...detail,items:detail.items.filter(item=>(item.name+' '+(item.itemNumber??'')).toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()))}];
  const visible=filterRecommendations(posts,category),catalog=new Map<string,StoreProduct>();
  return <section className="rec-draft-preview"><p>{t('browse.preview_hint')}</p><Segmented aria-label={t('browse.preview_size')} value={device} onChange={value=>setDevice(String(value))} options={[{value:'full',label:t('browse.desktop')},{value:'mobile',label:t('browse.mobile')}]}/>
    <div className="storefront browse-preview" data-device={device}><section className="recommendations rec-public">
      <Input className="browse-search" aria-label={t('store.search')} placeholder={t('store.search')} value={query} onChange={event=>setQuery(event.target.value)} allowClear/>
      <CategoryFilters posts={posts} category={category} onChoose={setCategory}/>
      {visible.length?<RecommendationIssue detail={visible[0]} number={1} single catalog={catalog} products={[]} quantities={{}} onDetail={()=>{}} onAdd={()=>{}} canBuy={()=>false}/>:<Empty description={t('class.empty')}><Button onClick={()=>setCategory('')}>{t('class.all')}</Button></Empty>}
    </section></div>
  </section>;
}

export default function PublicRecommendations(props: ShoppingProps) {
  const { id } = useParams();
  const { t } = useI18n();
  const [params,setParams]=useSearchParams();
  const category=params.get('category')??'';
  const node=selectedNode('?'+params.toString());
  const [pagination,setPagination]=useState({node,page:0});
  const page=pagination.node===node?pagination.page:0;
  const setPage=(value:number)=>setPagination({node,page:value});
  const [mode, setMode] = useState<'all' | 'latest'>('all');
  const [posts, setPosts] = useState<RecommendationDetail[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [loadedKey,setLoadedKey]=useState('');
  const requestKey=JSON.stringify([node,id,page]);
  const pending=busy||loadedKey!==requestKey;
  const catalog = useMemo(() => new Map(props.products.map(product => [product.id, product])), [props.products]);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(''); setPosts([]);
    const request = node===-1 ? Promise.resolve([]) : id ? recommendationApi.get(Number(id), true, node).then(value => [value]) : recommendationApi.feed(page,node);
    void request.then(value => { if (active) setPosts(value); }).catch(e => { if (active) setError((e as Error).message); }).finally(() => { if (active) {setLoadedKey(requestKey);setBusy(false);} });
    return () => { active = false; };
  }, [id, page, node]);
  const selected=pending?[]:mode==='latest'&&!id?posts.slice(0,1):posts;
  const query=props.query?.trim().toLocaleLowerCase()??'';
  const scope=query?selected.map(post=>({...post,items:post.items.filter(item=>(item.name+' '+(item.itemNumber??'')).toLocaleLowerCase().includes(query))})).filter(post=>post.items.length):selected;
  const visible=filterRecommendations(scope,category);
  function choose(value:string){if(value===category)return;const next=new URLSearchParams(params);if(value)next.set('category',value);else next.delete('category');setParams(next);}

  return <section className="recommendations rec-public">
    <Link className="rec-back" to={id ? '/recommendations'+(params.size?'?'+params.toString():'') : scopedPath('/', '?'+params.toString())}><ArrowLeftOutlined /> {t(id ? 'rec.title' : 'store.catalog')}</Link>
    {!id && <header className="rec-feed-heading"><h1>{t('rec.title')}</h1><Segmented aria-label={t('rec.display_mode')} value={mode} options={[{value:'latest',label:t('rec.latest')},{value:'all',label:t('rec.multiple')}]} onChange={value => { setMode(value as 'all' | 'latest'); if (value === 'latest') setPage(0); }} /></header>}
    {!pending&&!error&&<CategoryFilters posts={scope} category={category} onChoose={choose}/>}
    {pending ? <div className="rec-loading"><Spin /></div> : error ? <Alert type="error" message={error} /> : <>
      {visible.length > 1 && <nav className="rec-issue-directory" aria-label={t('rec.contents')}>{visible.map((entry, index) => <a key={entry.post.id} href={'#recommendation-' + entry.post.id} title={entry.post.title}><span>{String(page * 20 + index + 1).padStart(2, '0')}</span><span>{entry.post.title}</span></a>)}</nav>}
      {visible.length ? visible.map((entry, index) => <div className="rec-issue-section" key={entry.post.id}>
        <RecommendationIssue {...props} catalog={catalog} detail={entry} number={page * 20 + index + 1} single={!!id} />
        {visible.length > 1 && <nav className="rec-issue-navigation" aria-label={t('rec.issue_navigation')}><a href="#" onClick={event => { event.preventDefault(); window.scrollTo(0, 0); }}><UpOutlined /> {t('rec.contents')}</a><div>{index > 0 && <a href={'#recommendation-' + visible[index - 1].post.id}><ArrowLeftOutlined /> {t('rec.previous_issue')}</a>}{index < visible.length - 1 && <a href={'#recommendation-' + visible[index + 1].post.id}>{t('rec.next_issue')} <ArrowRightOutlined /></a>}</div></nav>}
      </div>) : <Empty description={t(category?'class.empty':query?'store.no_matches':'rec.empty_public')}>{category&&<Button onClick={()=>choose('')}>{t('class.all')}</Button>}</Empty>}
      {!id && mode === 'all' && <div className="rec-pagination"><Button disabled={!page} icon={<ArrowLeftOutlined />} onClick={() => { setPage(page - 1); window.scrollTo(0,0); }}>{t('rec.previous')}</Button><span>{page + 1}</span><Button disabled={posts.length < 20} icon={<ArrowRightOutlined />} onClick={() => { setPage(page + 1); window.scrollTo(0,0); }}>{t('rec.next')}</Button></div>}
    </>}
  </section>;
}
