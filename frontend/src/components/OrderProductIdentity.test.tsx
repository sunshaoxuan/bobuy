import {render,screen,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {OrderProductIdentity,OrderSpecification} from './OrderProductIdentity';
let locale='zh-CN';vi.mock('../i18n',()=>({useI18n:()=>({locale,t:(key:string)=>key})}));afterEach(()=>{cleanup();locale='zh-CN';});
describe('order purchase-time identity',()=>{
 it('renders snapshot brand, pure name, package combination and unit independently',()=>{
  render(<OrderProductIdentity includeSpecification line={{itemName:'Source',names:{'zh-CN':'纸尿裤'},brand:'Pampers',packaging:'80片×2包',specifications:{'zh-CN':'L码；80片×2包'},spec:'box',saleUnit:'box'}}/>);
  expect(screen.getByText('纸尿裤')).toBeInTheDocument();expect(screen.getByLabelText('stock.item.brand')).toHaveTextContent('Pampers');expect(screen.getByText('master.packaging: 80片×2包')).toBeInTheDocument();expect(screen.getByText('L码；80片×2包')).toBeInTheDocument();
 });
 it('preserves legacy order wording and legacy sale unit',()=>{render(<OrderProductIdentity includeSpecification line={{itemName:'Old full product name 80x2',spec:'old-box'}}/>);expect(screen.getByText('Old full product name 80x2')).toBeInTheDocument();expect(screen.getByText('old-box')).toBeInTheDocument();});
 it('marks a source-language specification rather than pretending it is translated',()=>{render(<OrderSpecification line={{itemName:'Name',specifications:{'ja-JP':'原規格'}}}/>);expect(screen.getByText('原規格')).toBeInTheDocument();expect(screen.getByText('article.field_source')).toBeInTheDocument();});
});
