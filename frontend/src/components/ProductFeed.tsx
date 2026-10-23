import { useEffect, useRef, useState } from 'react';
import { PlusOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { StoreProduct } from '../api';
import { localizedContent, useI18n } from '../i18n';

const BATCH_SIZE = 6;

export default function ProductFeed({ products, quantities, onAdd, onDetail }: {
  products: StoreProduct[];
  quantities: Record<string, number>;
  onAdd: (product: StoreProduct) => void;
  onDetail: (product: StoreProduct) => void;
}) {
  const { t, locale } = useI18n();
  const label = (value: Record<string,string>) => localizedContent(value,locale);
  const [limit, setLimit] = useState(BATCH_SIZE);
  const grid = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const signature = products.map(product => product.id).join('|');
  useEffect(() => { setLimit(BATCH_SIZE); }, [signature]);
  useEffect(() => {
    const cards = grid.current?.querySelectorAll<HTMLElement>('.product-tile');
    if (!cards || typeof ResizeObserver === 'undefined') return;
    // Match the 1px grid row and 12px gap without moving previously loaded cards.
    const observer = new ResizeObserver(entries => entries.forEach(entry => {
      const tile = entry.target as HTMLElement;
      tile.parentElement!.style.gridRowEnd = `span ${Math.ceil((tile.getBoundingClientRect().height + 12) / 13)}`;
    }));
    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [signature, limit]);
  useEffect(() => {
    if (!sentinel.current || limit >= products.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setLimit(value => Math.min(value + BATCH_SIZE, products.length));
    }, { rootMargin:'0px 0px 160px 0px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [signature, limit, products.length]);
  return <section className="product-feed" aria-label={t('store.product_browse')}>
    <div className="product-masonry" ref={grid}>
      {products.slice(0, limit).map((product, index) => <article className="store-product" key={product.id}>
        <div className={`product-tile product-shape-${index % 4}`}>
          <button className="product-photo" aria-label={t('store.detail_label',{name:label(product.name)})} onClick={() => onDetail(product)}>
            <img src={product.images[0]} alt={label(product.name)} loading={index < 2 ? 'eager' : 'lazy'} />
          </button>
          <button className="product-add" title={t('store.set_quantity')} aria-label={t('store.add_label',{name:label(product.name)})} onClick={() => onAdd(product)}><PlusOutlined />{quantities[product.id] > 0 && <span className="product-count">{quantities[product.id]}</span>}</button>
          <div className="product-body">
            <button className="product-name" aria-label={t('store.view_label',{name:label(product.name)})} onClick={() => onDetail(product)}><h2>{label(product.name)}</h2></button>
            <strong className="product-price"><small>¥</small>{new Intl.NumberFormat(locale).format(product.price)}</strong>
          </div>
        </div>
      </article>)}
    </div>
    {limit < products.length && <div className="feed-loader" ref={sentinel}><button aria-label={t('store.load_more')} onClick={() => setLimit(value => Math.min(value + BATCH_SIZE, products.length))}><ArrowDownOutlined />  {t('store.load_more')}</button></div>}
  </section>;
}
