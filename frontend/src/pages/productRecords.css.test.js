import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(`${process.cwd()}/src/pages/productRecords.css`, 'utf8');

describe('compact stock action CSS contract', () => {
  it('overrides workspace minimums with equal visible dimensions', () => {
    expect(css).toMatch(
      /\.merchant-shell \.stock-compact-action\.ant-btn,[^{]*\.merchant-drawer \.stock-compact-action\.ant-btn\{[^}]*width:32px;[^}]*height:32px;[^}]*min-width:32px;[^}]*min-height:32px;/,
    );
    expect(css).toContain('.merchant-shell .stock-mobile-card .stock-compact-action.ant-btn,.merchant-drawer .stock-mobile-card .stock-compact-action.ant-btn{width:44px;height:44px;min-width:44px;min-height:44px}');
  });

  it('keeps the compact action treatment token-based and lightweight', () => {
    expect(css).toContain('border:var(--zen-line,1px solid #deded8)');
    expect(css).toContain('background:var(--zen-bg,#f5f5f3)');
    expect(css).toContain('color:var(--zen-ink,#252529)');
    expect(css).toContain('box-shadow:none');
  });
});
