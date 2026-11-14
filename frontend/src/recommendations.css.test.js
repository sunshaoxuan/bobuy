import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import postcss from 'postcss';

const css = readFileSync(`${process.cwd()}/src/recommendations.css`, 'utf8');

it('spans failure cards across the grid independently of breakpoints and modal portals', () => {
  const root = postcss.parse(css);
  const spans = [];
  root.walkRules('.rec-product:has(.rec-publication-failures)', rule => {
    rule.walkDecls('grid-column', declaration => spans.push({
      value: declaration.value.replace(/\s/g, ''),
      parent: rule.parent.type,
    }));
  });
  expect(spans).toEqual([{ value: '1/-1', parent: 'root' }]);
  expect(css).not.toContain('.rec-linked:has(.rec-repair-modal)');
});
