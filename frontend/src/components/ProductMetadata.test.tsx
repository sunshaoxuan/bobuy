import {render,screen} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {ProductBrand,ProductVariant} from './ProductMetadata';
vi.mock('../i18n',()=>({useI18n:()=>({t:(key:string)=>key})}));
describe('separate product identity',()=>{
 it('shows brand/model/packaging separately and retains package combination',()=>{
  render(<><ProductBrand brand="Pampers"/><h1>Diapers</h1><p>80 pieces × 2</p><ProductVariant model="L" packaging="80 pieces × 2 packs"/></>);
  expect(screen.getByLabelText('stock.item.brand')).toHaveTextContent('Pampers');
  expect(screen.getByRole('heading')).toHaveTextContent(/^Diapers$/);
  expect(screen.getByText('master.packaging: 80 pieces × 2 packs')).toBeInTheDocument();
 });
 it('does not invent unknown brand or variant',()=>{const {container}=render(<><ProductBrand brand=""/><ProductVariant/></>);expect(container).toBeEmptyDOMElement();});
});
