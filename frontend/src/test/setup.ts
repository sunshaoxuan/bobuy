import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// jsdom has no layout engine; browser resize behavior is exercised separately.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => { },
    removeListener: () => { },
    addEventListener: () => { },
    removeEventListener: () => { },
    dispatchEvent: () => false
  });
}

const originalGetComputedStyle = window.getComputedStyle.bind(window);
window.getComputedStyle = ((element: Element, _pseudoElt?: string | null) => {
  return originalGetComputedStyle(element);
}) as typeof window.getComputedStyle;

const suppressedWarnings = [/not wrapped in act/i, /uncontrolled input/i, /not match any format/i];
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: unknown[]) => {
  const firstArg = args[0];
  if (typeof firstArg === 'string' && suppressedWarnings.some((pattern) => pattern.test(firstArg))) {
    return;
  }
  originalError(...args);
};

console.warn = (...args: unknown[]) => {
  const firstArg = args[0];
  if (typeof firstArg === 'string' && suppressedWarnings.some((pattern) => pattern.test(firstArg))) {
    return;
  }
  originalWarn(...args);
};
