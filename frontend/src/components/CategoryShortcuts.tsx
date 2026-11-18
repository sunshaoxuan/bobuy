import {LeftOutlined, RightOutlined} from '@ant-design/icons';
import {useLayoutEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import type {BrowseFacet} from '../api';
import {localizedContent, useI18n} from '../i18n';
import CategoryImage from './CategoryImage';

type Props = {
  categories: BrowseFacet[];
  toCategory: (id: string) => string;
  initialScroll: number;
  saveScroll: (offset: number) => void;
};

export default function CategoryShortcuts({categories, toCategory, initialScroll, saveScroll}: Props) {
  const {t, locale} = useI18n();
  const nav = useRef<HTMLElement>(null);
  const track = useRef<HTMLUListElement>(null);
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
    element.addEventListener('scroll', updateEdges, {passive: true});
    updateEdges();
    return () => {
      resize.disconnect();
      element.removeEventListener('scroll', updateEdges);
    };
  }, [categories.length]);

  useLayoutEffect(() => {
    track.current!.scrollLeft = initialScroll;
  }, [initialScroll, edges.overflow]);

  function move(direction: number) {
    if (direction < 0 ? !edges.previous : !edges.next) return;
    const element = track.current!;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollBy({left: direction * element.clientWidth * 0.8, behavior: reduceMotion ? 'instant' : 'smooth'});
  }

  return <nav ref={nav} className="category-shortcuts" aria-label={t('shopping.directory')}>
    {edges.overflow && <button type="button" aria-disabled={!edges.previous} aria-label={t('shopping.previous_categories')} onClick={() => move(-1)}><LeftOutlined aria-hidden="true"/></button>}
    <ul ref={track} className="category-shortcuts-track">
      {categories.map(category => {
        const name = localizedContent(category.name, locale);
        return <li key={category.id}>
          <Link to={toCategory(category.id)} onClick={() => saveScroll(track.current!.scrollLeft)}>
            <CategoryImage src={category.imageUrl} className="category-shortcuts-image"/>
            <span title={name}>{name}</span>
          </Link>
        </li>;
      })}
    </ul>
    {edges.overflow && <button type="button" aria-disabled={!edges.next} aria-label={t('shopping.next_categories')} onClick={() => move(1)}><RightOutlined aria-hidden="true"/></button>}
  </nav>;
}
