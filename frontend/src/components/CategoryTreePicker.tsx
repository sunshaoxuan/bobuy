import {useId} from 'react';
import {Button, Select, TreeSelect} from 'antd';
import type {CategoryTreeNode} from '../api';
import {type Locale, useI18n} from '../i18n';
import './categoryTreePicker.css';

export type CategoryOption = {key: string; value: string; title: string; label: string; selectable: boolean; children: CategoryOption[]};
export function categoryName(node: CategoryTreeNode, locale: Locale) {
  return node.name[locale]?.trim() || node.name['ja-JP']?.trim() || '';
}
// Contract for the future storefront tree consumer (#134). Pending translations
// must not publish Japanese names as Chinese. Admin keeps its original-name reference.
export function storefrontCategoryName(node: CategoryTreeNode, locale: Locale) {
  return node.name[locale === 'ja-JP' ? 'ja-JP' : 'zh-CN'] ?? '';
}
export function categoryTreeData(nodes: CategoryTreeNode[], locale: Locale, leavesOnly = false): CategoryOption[] {
  const byParent = new Map<string | null, CategoryTreeNode[]>();
  for (const node of nodes) {
    const group = byParent.get(node.parentId) ?? [];
    group.push(node); byParent.set(node.parentId, group);
  }
  const build = (parent: string | null, path: string[], seen: Set<string>): CategoryOption[] =>
    [...(byParent.get(parent) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
      .filter(node => !seen.has(node.id)).map(node => {
        const title = categoryName(node, locale), next = [...path, title];
        const children = build(node.id, next, new Set([...seen, node.id]));
        return {key: node.id, value: node.id, title, label: next.join(' › '), selectable: !leavesOnly || children.length === 0, children};
      });
  return build(null, [], new Set());
}

export default function CategoryTreePicker({nodes, value, disabled, onChange}: {
  nodes: CategoryTreeNode[]; value: string | null; disabled?: boolean; onChange: (id: string | null) => void;
}) {
  const {t, locale} = useI18n();
  const selected = nodes.find(node => node.id === value);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const path = selected?.fullPath.map(id => byId.get(id)).filter((node): node is CategoryTreeNode => !!node)
    .map(node => categoryName(node, locale)).join(' › ');
  return <div className="category-tree-picker-field">
    <TreeSelect className="category-tree-picker" aria-label={t('categoryTree.picker')}
      treeData={categoryTreeData(nodes, locale, true)} treeNodeLabelProp="label"
      value={selected?.id} showSearch treeDefaultExpandAll disabled={disabled}
      placeholder={t('categoryTree.uncategorized')} onChange={id => onChange(id ?? null)}
      popupClassName="category-tree-picker-popup" listHeight={320}
      filterTreeNode={(input, node) => String(node.label ?? '').toLocaleLowerCase().includes(input.toLocaleLowerCase())}/>
    {path && <p className="category-tree-current-path" aria-live="polite">{path}</p>}
    <Button disabled={disabled || !value} onClick={() => onChange(null)}>{t('categoryTree.clear')}</Button>
  </div>;
}

export function CategoryTreeMultiPicker({nodes, values, primary, disabled, onChange}: {
  nodes: CategoryTreeNode[]; values: string[]; primary: string | null; disabled?: boolean;
  onChange: (values: string[], primary: string | null) => void;
}) {
  const {t, locale} = useI18n();
  const primaryLabelId = useId();
  const options = categoryTreeData(nodes, locale, true);
  const labels = new Map<string, string>();
  const collect = (rows: CategoryOption[]) => rows.forEach(row => { labels.set(row.value, row.label); collect(row.children); });
  collect(options);
  return <div className="category-tree-picker-field category-tree-multi-picker">
    <TreeSelect className="category-tree-picker" aria-label={t('categoryTree.picker')}
      treeData={options} treeNodeLabelProp="label" value={values} multiple showSearch treeDefaultExpandAll
      disabled={disabled} placeholder={t('categoryTree.uncategorized')} popupClassName="category-tree-picker-popup"
      onChange={(next: string[]) => onChange(next, next.includes(primary ?? '') ? primary : next[0] ?? null)}
      filterTreeNode={(input, node) => String(node.label ?? '').toLocaleLowerCase().includes(input.toLocaleLowerCase())}/>
    {values.length > 0 && <div className="category-tree-primary-field">
      <span className="category-tree-primary-label" id={primaryLabelId}>{t('categoryTree.primary')}</span>
      <Select aria-label={t('categoryTree.primary')} aria-labelledby={primaryLabelId} disabled={disabled} value={primary ?? values[0]}
        options={values.map(value => ({value, label: labels.get(value) ?? value}))} onChange={next => onChange(values, next)}/>
    </div>}
    <Button disabled={disabled || values.length === 0} onClick={() => onChange([], null)}>{t('categoryTree.clear')}</Button>
  </div>;
}
