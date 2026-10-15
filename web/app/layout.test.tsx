import { beforeEach, describe, expect, it, vi } from 'vitest';

const connection = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('next/server', () => ({ connection }));
vi.mock('next/font/local', () => ({ default: () => ({ variable: 'font-work-sans' }) }));

import RootLayout from './layout';

beforeEach(() => {
  connection.mockClear();
});

describe('RootLayout', () => {
  it('WEB-39 espera la petición antes de renderizar, para que ninguna página sea estática y todas reciban el nonce', async () => {
    const tree = await RootLayout({ children: null } as never);
    expect(connection).toHaveBeenCalledTimes(1);
    expect(tree).toBeTruthy();
  });
});
