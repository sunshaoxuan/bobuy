// jsdom 24 cannot parse Ant Design's :has sibling CSS. Real TreeSelect is exercised in browser acceptance.
export function CategoryTreeSelectMock({treeData = [], value, onChange, ...props}: any) {
  const options = (rows: any[]): any[] => rows.flatMap(row => [row, ...options(row.children ?? [])]);
  return <select aria-label={props['aria-label']} disabled={props.disabled} value={value ?? ''} onChange={event => onChange(event.target.value || undefined)}>
    <option value="">{props.placeholder}</option>
    {options(treeData).map(row => <option key={row.value} value={row.value} disabled={row.selectable === false}>{row.label}</option>)}
  </select>;
}
