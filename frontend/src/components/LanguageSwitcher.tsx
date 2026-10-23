import { Button, Dropdown } from 'antd';
import { GlobalOutlined, DownOutlined } from '@ant-design/icons';
import { supportedLocales, useI18n, type Locale } from '../i18n';

const names: Record<Locale, string> = { 'zh-CN': '简体中文', 'en-US': 'English', 'ja-JP': '日本語', 'zh-TW': '繁體中文' };
const shortNames: Record<Locale, string> = { 'zh-CN': '简中', 'en-US': 'EN', 'ja-JP': '日本語', 'zh-TW': '繁中' };

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return <Dropdown trigger={['click']} menu={{ selectable: true, selectedKeys: [locale],
    items: supportedLocales.map(value => ({ key: value, label: <span lang={value}>{names[value]}</span> })),
    onClick: ({ key }) => setLocale(key as Locale) }}>
    <Button className="language-switcher" aria-label={t('language.label')} icon={<GlobalOutlined />}>
      <span>{shortNames[locale]}</span><DownOutlined />
    </Button>
  </Dropdown>;
}
