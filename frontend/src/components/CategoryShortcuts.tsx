import {visibleCategoryIconCount} from '../categoryIconPriority';
import {AppstoreOutlined, LeftOutlined, RightOutlined} from '@ant-design/icons';
import {useLayoutEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import type {BrowseFacet} from '../api';
import {localizedContent, useI18n} from '../i18n';
import CategoryImage from './CategoryImage';

type Props = {
  categories: BrowseFacet[];
  toCategory: (id: string) => string;
  initialScroll?: number;
  selectedId?: string;
  overviewHref?: string;
  saveScroll: (offset: number) => void;
};

export default function CategoryShortcuts({categories, toCategory, initialScroll, saveScroll, selectedId, overviewHref}: Props) {
  const {t, locale} = useI18n();
  const nav = useRef<HTMLElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const save=useRef(saveScroll);save.current=saveScroll;
  const [edges, setEdges] = useState({overflow: false, previous: false, next: false});

  useLayoutEffect(() => {
    const element = track.current!;

    function updateEdges() {
      const previous = element.scrollLeft > 1;
      const next = element.scrollWidth - element.clientWidth - element.scrollLeft > 1;
      const overflow = element.scrollWidth - nav.current!.clientWidth > 1;
      setEdges(current => current.overflow === overflow && current.previous === previous && current.next === next
        ? current : {overflow, previous, next});
    }

    const resize = new ResizeObserver(updateEdges);
    resize.observe(element);
    resize.observe(nav.current!);
    const scrolled=()=>{updateEdges();save.current(element.scrollLeft);};
    element.addEventListener('scroll', scrolled, {passive: true});
    updateEdges();
    return () => {
      resize.disconnect();
      element.removeEventListener('scroll', scrolled);
    };
  }, [categories.length]);

  useLayoutEffect(() => {
    const element=track.current!;element.scrollLeft=initialScroll??0;
    if(initialScroll===undefined){
      const active=element.querySelector<HTMLElement>('[aria-current]');
      if(active){const box=element.getBoundingClientRect(),item=active.getBoundingClientRect();if(item.left<box.left)element.scrollLeft+=item.left-box.left-4;else if(item.right>box.right)element.scrollLeft+=item.right-box.right+4;}
    }
  }, [initialScroll, selectedId, categories.length, edges.overflow]);

  function move(direction: number) {
    if (direction < 0 ? !edges.previous : !edges.next) return;
    const element = track.current!;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({left: direction * element.clientWidth * 0.8, behavior: reduceMotion ? 'instant' : 'smooth'});
  }

  return <nav ref={nav} className="category-shortcuts" aria-label={t('shopping.directory')}>
    {edges.overflow && <button type="button" aria-disabled={!edges.previous} aria-label={t('shopping.previous_categories')} onClick={() => move(-1)}><LeftOutlined aria-hidden="true"/></button>}
    <ul ref={track} className="category-shortcuts-track">
      {overviewHref&&<li><Link to={overviewHref} aria-current={!selectedId?'page':undefined} onClick={()=>saveScroll(track.current!.scrollLeft)}><span className="category-shortcuts-image category-shortcuts-all" aria-hidden="true"><AppstoreOutlined/></span><span title={t('class.all')}>{t('class.all')}</span></Link></li>}
      {categories.map((category,index) => {
        const name = localizedContent(category.name, locale);
        return <li key={category.id}>
          <Link to={toCategory(category.id)} aria-current={selectedId===category.id?'true':undefined} onClick={() => saveScroll(track.current!.scrollLeft)}>
            <CategoryImage src={category.imageUrl} priority={index<Math.min(2,visibleCategoryIconCount(window.innerWidth))} className="category-shortcuts-image"/>
            <span title={name}>{name}</span>
          </Link>
        </li>;
      })}
    </ul>
    {edges.overflow && <button type="button" aria-disabled={!edges.next} aria-label={t('shopping.next_categories')} onClick={() => move(1)}><RightOutlined aria-hidden="true"/></button>}
  </nav>;
}
