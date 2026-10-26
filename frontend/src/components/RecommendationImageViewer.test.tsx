import {describe,it,expect} from 'vitest';
import {render,screen} from '@testing-library/react';
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
