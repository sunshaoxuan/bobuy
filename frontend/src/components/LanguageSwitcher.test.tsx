import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { I18nProvider, useI18n } from '../i18n';
import LanguageSwitcher from './LanguageSwitcher';

function Example() { const {t}=useI18n(); return <><LanguageSwitcher /><h1>{t('app.brand')}</h1></>; }
afterEach(()=>localStorage.clear());
describe('language selection',()=>{
  it('updates document, dates and persisted locale without replacing the cart',async()=>{
    localStorage.setItem('bobbuy_locale','zh-CN');
    localStorage.setItem('bobuy.cart.v1','{"items":{"p1":99}}');
    render(<I18nProvider><Example /></I18nProvider>);
    for(const [language,brand,locale,dateLocale] of [['English','BoBuy','en-US','en'],['日本語','ボボバイ','ja-JP','ja'],['繁體中文','寶寶敗','zh-TW','zh-tw'],['简体中文','宝宝败','zh-CN','zh-cn']]) {
      fireEvent.click(screen.getByRole('button'));
      fireEvent.click(await screen.findByText(language));
      await waitFor(()=>expect(screen.getByRole('heading')).toHaveTextContent(brand));
      expect(document.documentElement.lang).toBe(locale);
      expect(document.title).toBe(brand);
      expect(dayjs.locale()).toBe(dateLocale);
      expect(localStorage.getItem('bobbuy_locale')).toBe(locale);
      expect(JSON.parse(localStorage.getItem('bobuy.cart.v1')!).items.p1).toBe(99);
    }
  });
});
