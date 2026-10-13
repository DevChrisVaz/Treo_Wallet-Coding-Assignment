import '@testing-library/jest-dom/vitest';
import 'vitest-axe/extend-expect';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sin `globals: true`, Testing Library no limpia el DOM por su cuenta entre pruebas.
afterEach(() => {
  cleanup();
});
