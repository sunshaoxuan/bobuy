import {render,screen} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import ProductMarkerBadges from './ProductMarkerBadges';
import type {ProductMarkerDefinition} from '../api';
const marker=(id:string,enabled=true):ProductMarkerDefinition=>({id,code:id,badge:'新',name:{'en-US':id},description:{},color:'green',sortOrder:0,enabled,version:0});
beforeEach(()=>localStorage.setItem('bobbuy_locale','en-US'));
it('renders enabled markers in order, hides disabled definitions',()=>{const view=render(<I18nProvider><ProductMarkerBadges markers={[marker('a'),marker('b',false)]}/></I18nProvider>);expect(screen.getByLabelText('a')).toHaveTextContent('新');expect(screen.queryByLabelText('b')).not.toBeInTheDocument();expect(view.container.querySelectorAll('li')).toHaveLength(1);});
it('bounds image overlays to three badges plus an overflow count and keeps details complete',()=>{const values=Array.from({length:50},(_,i)=>marker(String(i)));const view=render(<I18nProvider><ProductMarkerBadges markers={values} overlay/></I18nProvider>);expect(view.container.querySelectorAll('li')).toHaveLength(4);expect(screen.getByLabelText('47 more markers')).toHaveTextContent('+47');view.rerender(<I18nProvider><ProductMarkerBadges markers={values}/></I18nProvider>);expect(view.container.querySelectorAll('li')).toHaveLength(50);});
it('renders no decoration for an empty assignment',()=>{const view=render(<I18nProvider><ProductMarkerBadges markers={[]}/></I18nProvider>);expect(view.container.querySelector('ul')).toBeNull();});
