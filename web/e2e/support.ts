import { expect, type Page } from '@playwright/test';

export const API = 'http://127.0.0.1:4999';
/** 12:00 en Ciudad de México, el "ahora" de las historias. */
export const NOW = new Date('2026-10-13T18:00:00Z');
export const PRINCIPAL_ID = '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51';
export const SENT_TRANSFER_ID = '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a';

/** Cambia los datos de la API simulada (y reinicia su estado y su registro de peticiones). */
export async function scenario(page: Page, value: Record<string, string>) {
  const response = await page.request.post(`${API}/__scenario`, { data: value });
  expect(response.ok()).toBe(true);
}

export interface ApiRequest {
  method: string;
  path: string;
  /** La query tal como llegó (`?limit=5`), o `''`. */
  search: string;
}

/** Lo que la API simulada recibió del BFF desde el último `scenario`. */
export async function apiRequests(page: Page): Promise<ApiRequest[]> {
  const response = await page.request.get(`${API}/__requests`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { items: ApiRequest[] }).items;
}

/** Inicia sesión por el formulario real con el reloj del navegador fijo en NOW. */
export async function login(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.goto('/login');
  await page.getByLabel('Correo').fill('ana@example.com');
  await page.getByLabel('Contraseña').fill('Ana-demo-2026!');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL((url) => url.pathname === '/');
}

export function visibleH1Count(page: Page): Promise<number> {
  return page.evaluate(
    () => [...document.querySelectorAll('h1')].filter((h) => h.checkVisibility()).length,
  );
}

export function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}
