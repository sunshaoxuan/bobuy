import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Empty, Image, Segmented, Spin, Tooltip } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, CalendarOutlined, DownOutlined, ExpandOutlined, PlusOutlined, UpOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
import { recommendationApi, type RecommendationDetail, type StoreProduct } from '../api';
import { useI18n } from '../i18n';
import { OfferInfo } from '../components/RecommendationFacts';
import '../recommendations.css';

type ShoppingProps = {
  products: StoreProduct[];
  quantities: Record<string, number>;
  onDetail: (product: StoreProduct) => void;
  onAdd: (product: StoreProduct) => void;
  canBuy: (product: StoreProduct) => boolean;
};
const EXCERPT_LENGTH = 80;

function RecommendationIssue({ detail, number, single, catalog, quantities, onDetail, onAdd, canBuy }: ShoppingProps & {
  detail: RecommendationDetail; number: number; single: boolean; catalog: Map<string, StoreProduct>;
}) {
  const { t, locale } = useI18n();
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
      <div><Heading id={'rec-title-' + detail.post.id}>{single ? detail.post.title : <Link to={'/recommendations/' + detail.post.id}>{detail.post.title}</Link>}</Heading>
        <div className="rec-publication"><span><UserOutlined /> {detail.post.publisherName}</span><time dateTime={detail.post.publishedAt}><CalendarOutlined /> {detail.post.publishedAt && new Date(detail.post.publishedAt).toLocaleDateString(locale)}</time></div>
      </div>
    </header>
    <div className="rec-public-body" id={'rec-body-' + detail.post.id}>{shown.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    {truncated && <Button type="text" className="rec-expand" aria-expanded={expanded} aria-controls={'rec-body-' + detail.post.id} icon={expanded ? <UpOutlined /> : <DownOutlined />} onClick={() => setExpanded(value => !value)}>{t(expanded ? 'rec.collapse' : 'rec.read_more')}</Button>}
    <div className="rec-products-heading"><h3>{t('rec.products')} <span>{detail.items.length}</span></h3>{!single && <Link to={'/recommendations/' + detail.post.id}>{t('rec.view')} <ArrowRightOutlined /></Link>}</div>
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
        <OfferInfo facts={item} />
        {!buyable && <small className="rec-pin-status">{t(product ? 'store.no_trips' : 'rec.reference_only')}</small>}
      </article>;
    })}</div>
    <Image.PreviewGroup items={detail.items.map(item => ({src:item.imageUrl,alt:item.name}))} preview={{rootClassName:'rec-image-preview',visible:preview !== undefined,current:preview ?? 0,onChange:setPreview,onVisibleChange:visible => { if (!visible) setPreview(undefined); }}} />
  </article>;
}

export default function PublicRecommendations(props: ShoppingProps) {
  const { id } = useParams();
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<'all' | 'latest'>('all');
  const [posts, setPosts] = useState<RecommendationDetail[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const catalog = useMemo(() => new Map(props.products.map(product => [product.id, product])), [props.products]);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(''); setPosts([]);
    const request = id ? recommendationApi.get(Number(id), true).then(value => [value]) : recommendationApi.feed(page);
    void request.then(value => { if (active) setPosts(value); }).catch(e => { if (active) setError((e as Error).message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [id, page]);
  const visible = mode === 'latest' && !id ? posts.slice(0, 1) : posts;
  return <section className="recommendations rec-public">
    <Link className="rec-back" to={id ? '/recommendations' : '/'}><ArrowLeftOutlined /> {t(id ? 'rec.title' : 'store.catalog')}</Link>
    {!id && <header className="rec-feed-heading"><h1>{t('rec.title')}</h1><Segmented aria-label={t('rec.display_mode')} value={mode} options={[{value:'latest',label:t('rec.latest')},{value:'all',label:t('rec.multiple')}]} onChange={value => { setMode(value as 'all' | 'latest'); if (value === 'latest') setPage(0); }} /></header>}
    {busy ? <div className="rec-loading"><Spin /></div> : error ? <Alert type="error" message={error} /> : <>
      {visible.length > 1 && <nav className="rec-issue-directory" aria-label={t('rec.contents')}>{visible.map((entry, index) => <a key={entry.post.id} href={'#recommendation-' + entry.post.id} title={entry.post.title}><span>{String(page * 20 + index + 1).padStart(2, '0')}</span><span>{entry.post.title}</span></a>)}</nav>}
      {visible.length ? visible.map((entry, index) => <div className="rec-issue-section" key={entry.post.id}>
        <RecommendationIssue {...props} catalog={catalog} detail={entry} number={page * 20 + index + 1} single={!!id} />
        {visible.length > 1 && <nav className="rec-issue-navigation" aria-label={t('rec.issue_navigation')}><a href="#" onClick={event => { event.preventDefault(); window.scrollTo(0, 0); }}><UpOutlined /> {t('rec.contents')}</a><div>{index > 0 && <a href={'#recommendation-' + visible[index - 1].post.id}><ArrowLeftOutlined /> {t('rec.previous_issue')}</a>}{index < visible.length - 1 && <a href={'#recommendation-' + visible[index + 1].post.id}>{t('rec.next_issue')} <ArrowRightOutlined /></a>}</div></nav>}
      </div>) : <Empty description={t('rec.empty_public')} />}
      {!id && mode === 'all' && <div className="rec-pagination"><Button disabled={!page} icon={<ArrowLeftOutlined />} onClick={() => { setPage(page - 1); window.scrollTo(0,0); }}>{t('rec.previous')}</Button><span>{page + 1}</span><Button disabled={posts.length < 20} icon={<ArrowRightOutlined />} onClick={() => { setPage(page + 1); window.scrollTo(0,0); }}>{t('rec.next')}</Button></div>}
    </>}
  </section>;
}
