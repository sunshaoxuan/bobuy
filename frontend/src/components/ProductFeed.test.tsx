import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProductFeed from './ProductFeed';
import type { StoreProduct } from '../api';

const product: StoreProduct = { id:'p1', name:{'zh-CN':'测试商品'}, brand:'测试品牌', description:{'zh-CN':'商品说明'}, price:100, categoryId:'food', images:['/test.jpg'], merchantId:1 };
const products = Array.from({length:14}, (_,index) => ({...product,id:`p${index+1}`}));
const props = {quantities:{p1:99},onAdd:vi.fn(),onDetail:vi.fn()};
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('ProductFeed', () => {
  it('opens quantity separately from details and shows the existing quantity', () => {
    render(<ProductFeed products={[product]} {...props} />);
    fireEvent.click(screen.getByRole('button', {name:'加入购物车：测试商品'}));
    expect(props.onAdd).toHaveBeenCalledWith(product);
    expect(props.onDetail).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name:'加入购物车：测试商品'})).toHaveTextContent('99');
    fireEvent.click(screen.getByRole('button', {name:'商品详情：测试商品'}));
    expect(props.onDetail).toHaveBeenCalledWith(product);
  });
  it('appends batches without duplicating cards and resets for changed results', () => {
    const {rerender} = render(<ProductFeed products={products} {...props} />);
    expect(screen.getAllByRole('article')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button',{name:'加载更多商品'}));
    expect(screen.getAllByRole('article')).toHaveLength(12);
    fireEvent.click(screen.getByRole('button',{name:'加载更多商品'}));
    expect(screen.getAllByRole('article')).toHaveLength(14);
    expect(screen.queryByRole('button',{name:'加载更多商品'})).not.toBeInTheDocument();
    rerender(<ProductFeed products={products.slice(1)} {...props} />);
    expect(screen.getAllByRole('article')).toHaveLength(6);
    rerender(<ProductFeed products={[]} {...props} />);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
  it('loads on intersection and disconnects observers on unmount', () => {
    let intersect: IntersectionObserverCallback;
    const disconnect=vi.fn();
    vi.stubGlobal('IntersectionObserver',vi.fn().mockImplementation(callback => {
      intersect=callback;return {observe:vi.fn(),disconnect};
    }));
    const {unmount} = render(<ProductFeed products={products} {...props} />);
    act(() => intersect([{isIntersecting:false} as IntersectionObserverEntry],{} as IntersectionObserver));
    expect(screen.getAllByRole('article')).toHaveLength(6);
    act(() => intersect([{isIntersecting:true} as IntersectionObserverEntry],{} as IntersectionObserver));
    expect(screen.getAllByRole('article')).toHaveLength(12);
    unmount();expect(disconnect).toHaveBeenCalled();
  });
  it('sizes masonry rows from measured card height and disconnects on unmount', () => {
    let resize: ResizeObserverCallback;
    const disconnect=vi.fn();
    vi.stubGlobal('ResizeObserver',vi.fn().mockImplementation(callback => {
      resize=callback;return {observe:vi.fn(),disconnect};
    }));
    const {container,unmount}=render(<ProductFeed products={[product]} {...props} />);
    const tile=container.querySelector('.product-tile')!;
    vi.spyOn(tile,'getBoundingClientRect').mockReturnValue({height:200} as DOMRect);
    act(()=>resize([{target:tile} as ResizeObserverEntry],{} as ResizeObserver));
    expect((tile.parentElement as HTMLElement).style.gridRowEnd).toBe('span 17');
    unmount();expect(disconnect).toHaveBeenCalled();
  });
});
