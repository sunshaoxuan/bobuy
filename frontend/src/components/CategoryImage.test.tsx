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
