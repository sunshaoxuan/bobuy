import {render,screen} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import BrandLogo from './BrandLogo';

it.each([['zh-CN','宝宝败'],['zh-TW','寶寶敗'],['ja-JP','ボボバイ'],['en-US','BoBuy']])('keeps the localized name above the full domain in one shared lockup for %s',(locale,name)=>{
 localStorage.setItem('bobbuy_locale',locale);const view=render(<I18nProvider><BrandLogo/></I18nProvider>);
 expect(screen.getByText(name)).toHaveClass('brand-lockup-name');expect(view.container.querySelector('.brand-lockup')).toHaveAttribute('lang',locale);expect(view.container.querySelector('.brand-lockup-domain')).toHaveTextContent('bobuy.cc');expect(view.container.querySelector('.brand-lockup-label')?.children[0]).toHaveTextContent(name);expect(view.container.querySelectorAll('.brand-lockup-mark')).toHaveLength(1);
 view.rerender(<I18nProvider><BrandLogo compact/></I18nProvider>);expect(view.container.querySelector('.brand-lockup')).toHaveClass('brand-lockup-compact');expect(view.container.querySelector('.brand-lockup-domain')).toHaveTextContent('bobuy.cc');
});
