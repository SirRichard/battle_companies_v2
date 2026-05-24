// Only import jest-dom matchers when running in jsdom environment
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom')
}
