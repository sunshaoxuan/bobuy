import {describe,it,expect} from 'vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {RecommendationImageViewer} from './RecommendationImageViewer';
import {I18nProvider} from '../i18n';
import {boundPan,dragOffset,swipeDirection} from './RecommendationImageViewer';
import {RecommendationName} from './RecommendationName';

describe('gallery gesture boundaries',()=>{
 it('requires a deliberate horizontal swipe and leaves vertical/diagonal scroll alone',()=>{
  expect(swipeDirection(-80,10)).toBe(1);expect(swipeDirection(80,-12)).toBe(-1);
  expect(swipeDirection(20,0)).toBe(0);expect(swipeDirection(60,60)).toBe(0);expect(swipeDirection(30,150)).toBe(0);
 });
 it('clamps native-size panning to actual image edges and centers smaller axes',()=>{
  expect(boundPan(900,1200,400)).toBe(400);expect(boundPan(-900,1200,400)).toBe(-400);
  expect(boundPan(90,300,700)).toBe(0);expect(boundPan(-90,300,700)).toBe(0);expect(boundPan(50,1200,400)).toBe(50);
 });
 it('tracks the pointer between images, damps outward edges and prevents skipping beyond one image',()=>{
  expect(dragOffset(-90,300,true,false)).toBe(-90);expect(dragOffset(90,300,false,true)).toBe(90);
  expect(dragOffset(120,300,true,false)).toBe(30);expect(dragOffset(-120,300,false,true)).toBe(-30);
  expect(dragOffset(-900,300,false,false)).toBe(-300);
 });
});
describe('localized name layout',()=>{
 it('keeps the Japanese original and parentheses in a separate semantic line',()=>{
  render(<h1><RecommendationName text={{primaryName:'译名',originalName:'原名'}}/></h1>);
  expect(screen.getByText('译名').className).toBe('rec-name-local');expect(screen.getByText('（原名）').getAttribute('lang')).toBe('ja');
 });
 it('does not repeat the Japanese name when no translated name is present',()=>{
  const {container}=render(<RecommendationName text={{primaryName:'原名'}}/>);expect(container.textContent).toBe('原名');expect(container.querySelector('.rec-name-original')).toBeNull();
 });
});

it('keeps the selected image across equivalent array rebuilds and omits consumer filename alt without changing provenance',()=>{
 const pictures=[1,2,3].map(id=>({id:String(id),url:'/image-'+id+'.png',label:'internal-file-'+id+'.webp',sourceUrl:'https://source/'+id,assetKey:'asset-'+id,hash:'hash-'+id}));
 const original=JSON.stringify(pictures);const tree=(values:typeof pictures)=><I18nProvider><RecommendationImageViewer consumer pictures={values} name="Product"/></I18nProvider>;
 const view=render(tree(pictures));fireEvent.click(view.container.querySelectorAll('.rec-detail-thumbs button')[1]);expect(view.container.querySelector('.rec-gallery-navigation')).toHaveTextContent('2 / 3');
 view.rerender(tree(pictures.map(p=>({...p}))));expect(view.container.querySelector('.rec-gallery-navigation')).toHaveTextContent('2 / 3');expect([...view.container.querySelectorAll('img')].every(img=>!img.alt.includes('internal-file'))).toBe(true);expect(JSON.stringify(pictures)).toBe(original);
});
