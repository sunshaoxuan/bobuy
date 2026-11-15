import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import postcss from 'postcss';

const css = readFileSync(`${process.cwd()}/src/recommendations.css`, 'utf8');

it('targets the recommendation card checkbox wrapper and mobile modal close', () => {
  const root=postcss.parse(css);
  const values={};
  root.walkRules('.rec-product .ant-checkbox-wrapper',rule=>rule.walkDecls(d=>{values[d.prop]=d.value;}));
  expect(values).toMatchObject({'display':'flex','min-height':'44px','height':'auto'});
  const close={};
  root.walkRules('.rec-repair-modal .ant-modal-close',rule=>rule.walkDecls(d=>{close[d.prop]=d.value;}));
  expect(close).toMatchObject({'width':'44px','height':'44px','min-width':'44px','min-height':'44px'});
});

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
