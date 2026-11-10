import { useState } from 'react';
import { Select } from 'antd';
import type { RecommendationChoice } from '../api';
import { localizedContent, useI18n } from '../i18n';

export default function CatalogCategorySelect({ choices, value, disabled, onChange }: {
  choices: RecommendationChoice[];
  value: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState('');
  const unavailable = t('master.category_unavailable');
  const options = choices.map(choice => ({ value: choice.id, label: localizedContent(choice.name, locale).trim() || unavailable }));
  // Keep unmatched selections removable without presenting their internal IDs as labels.
  for (const id of new Set(value)) {
    if (!options.some(option => option.value === id)) options.push({ value: id, label: unavailable });
  }
  return <Select aria-label={t('master.categories')} mode="multiple" showSearch disabled={disabled}
    value={value} options={options} optionFilterProp="label" searchValue={search}
    onSearch={setSearch} onBlur={() => setSearch('')}
    onDropdownVisibleChange={open => { if (!open) setSearch(''); }}
    onChange={ids => { setSearch(''); onChange(ids); }} />;
}
