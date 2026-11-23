import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mocks = vi.hoisted(() => ({
  userData: '',
}));

vi.mock('electron', () => ({
  app: {
    getPath: (_name: string) => mocks.userData,
  },
  net: {
    request: () => {
      const reqHandlers = new Map<string, Function[]>();
      const on = (ev: string, cb: Function) => {
        const arr = reqHandlers.get(ev) ?? [];
        arr.push(cb);
        reqHandlers.set(ev, arr);
        return undefined as never;
      };
      return {
        on,
        abort: () => {},
        end: () => {
          const respHandlers = new Map<string, Function[]>();
          const resp = {
            headers: { 'content-length': '4', 'content-type': 'image/png' },
            on: (ev: string, cb: Function) => {
              const arr = respHandlers.get(ev) ?? [];
              arr.push(cb);
              respHandlers.set(ev, arr);
            },
          };
          for (const fn of reqHandlers.get('response') ?? []) fn(resp);
          setTimeout(() => {
            for (const fn of respHandlers.get('data') ?? []) fn(Buffer.from('fake'));
            for (const fn of respHandlers.get('end') ?? []) fn();
          }, 0);
        },
      };
    },
  },
}));

vi.mock('./settings', () => ({
  loadSettings: () => ({}),
}));

vi.mock('./presets', () => ({
  activePreset: () => ({ name: 'test-preset', model: 'gpt-image-2' }),
}));

import { normalizeResponse } from './normalize';
import type { GenerateRequest } from '../shared/types';

function makeReq(count: number): GenerateRequest {
  return {
    requestId: 'req-test-1',
    promptRaw: 'a cat',
    promptResolved: 'a cat',
    params: { aspect: '1:1', resolution: '1K', quality: 'medium', count: count as 1 | 2 | 3 | 4 },
    images: [],
  };
}

const B64 = Buffer.from('hello-world').toString('base64');

describe('normalizeResponse', () => {
  beforeEach(() => {
    mocks.userData = mkdtempSync(join(tmpdir(), 'vitest-normalize-'));
    mkdirSync(join(mocks.userData, 'images'), { recursive: true });
  });

  it('b64 via data array writes file and returns ok', async () => {
    const res = await normalizeResponse(makeReq(1), { data: [{ b64_json: B64 }] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.entry.images).toHaveLength(1);
    expect(existsSync(join(mocks.userData, 'images', res.entry.images[0]!.file))).toBe(true);
  });

  it('b64 via top-level b64_json string', async () => {
    const res = await normalizeResponse(makeReq(1), { b64_json: B64 });
    expect(res.ok).toBe(true);
  });

  it('b64 via top-level b64_json array', async () => {
    const res = await normalizeResponse(makeReq(2), { b64_json: [B64, B64] });
    // dedup: same content twice collapses to 1 (documented behavior)
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.entry.images.length).toBeGreaterThanOrEqual(1);
  });

  it('url via data array downloads (mocked net) and writes file', async () => {
    const res = await normalizeResponse(makeReq(1), { data: [{ url: 'https://example.com/a.png' }] });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.entry.images).toHaveLength(1);
  });

  it('url via top-level url', async () => {
    const res = await normalizeResponse(makeReq(1), { url: 'https://example.com/b.png' });
    expect(res.ok).toBe(true);
  });

  it('empty packet returns parse error', async () => {
    const res = await normalizeResponse(makeReq(1), {});
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('parse');
  });

  it('lists images dir growth as sanity', async () => {
    await normalizeResponse(makeReq(1), { data: [{ b64_json: B64 }] });
    expect(readdirSync(join(mocks.userData, 'images')).length).toBeGreaterThanOrEqual(1);
  });
});
