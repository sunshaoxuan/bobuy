import {render,fireEvent} from '@testing-library/react';
import {it,expect} from 'vitest';
import CategoryImage from './CategoryImage';
it('falls back on a failed site asset and retries when the image is replaced',()=>{
 const {container,rerender}=render(<CategoryImage src="https://external.invalid/image.png" className="category-art"/>);
 expect(container.querySelector('img')).toBeNull();
 rerender(<CategoryImage src="/api/storefront/recommendation-images/one" className="category-art"/>);
 fireEvent.error(container.querySelector('img')!);expect(container.querySelector('img')).toBeNull();expect(container.querySelector('.category-art')).not.toBeNull();
 rerender(<CategoryImage src="/api/storefront/recommendation-images/two" className="category-art"/>);
 expect(container.querySelector('img')?.getAttribute('src')).toBe('/api/storefront/recommendation-images/two');
});
it('prioritizes visible shortcuts and keeps offscreen art lazy without waiting on load',()=>{
 const {container,rerender}=render(<CategoryImage src="/api/storefront/recommendation-images/one" className="category-art" priority/>);
 expect(container.querySelector('img')).toHaveAttribute('loading','eager');expect(container.querySelector('img')).toHaveAttribute('fetchpriority','high');
 rerender(<CategoryImage src="/api/storefront/recommendation-images/two" className="category-art" priority={false}/>);
 expect(container.querySelector('img')).toHaveAttribute('loading','lazy');expect(container.querySelector('img')).toHaveAttribute('fetchpriority','low');
 fireEvent.error(container.querySelector('img')!);expect(container.querySelector('.category-art')).toBeInTheDocument();expect(container.querySelector('img')).toBeNull();
});
