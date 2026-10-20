import '@testing-library/jest-dom/vitest';

// jsdom lacks these browser APIs that the UI touches.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

if (!window.scrollTo) {
  Object.defineProperty(window, 'scrollTo', { writable: true, value: () => undefined });
}
