import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mocks = vi.hoisted(() => ({
  userData: '',
}));

vi.mock('electron', () => ({
  app: {
    getPath: (_name: string) => mocks.userData,
  },
  dialog: {},
  BrowserWindow: {
    getFocusedWindow: () => null,
    getAllWindows: () => [],
  },
}));

import { deleteHistory, listHistory } from './history';
import type { HistoryEntry } from '../shared/types';

function makeEntry(id: string, files: string[]): HistoryEntry {
  return {
    id,
    createdAt: Date.now(),
    presetName: 'test-preset',
    model: 'gpt-image-2',
    promptRaw: 'p',
    promptResolved: 'p',
    params: { aspect: '1:1', resolution: '1K', quality: 'medium', count: 1 },
    size: '1024x1024',
    refImageFiles: [],
    images: files.map((file) => ({ file, url: `img://${file}` })),
  };
}

describe('deleteHistory orphan GC', () => {
  beforeEach(() => {
    mocks.userData = mkdtempSync(join(tmpdir(), 'vitest-history-'));
    mkdirSync(join(mocks.userData, 'images'), { recursive: true });
  });

  function seed(entries: HistoryEntry[], filesOnDisk: string[]) {
    writeFileSync(join(mocks.userData, 'history.json'), JSON.stringify(entries, null, 2), 'utf-8');
    for (const f of filesOnDisk) {
      writeFileSync(join(mocks.userData, 'images', f), 'x', 'utf-8');
    }
  }

  it('deletes orphan file, keeps referenced file', () => {
    const e1 = makeEntry('e1', ['keep.png', 'shared.png']);
    const e2 = makeEntry('e2', ['shared.png', 'gone.png']);
    seed([e1, e2], ['keep.png', 'shared.png', 'gone.png']);

    const rest = deleteHistory('e2');
    expect(rest.map((e) => e.id)).toEqual(['e1']);

    // target-exclusive file is GC'd
    expect(existsSync(join(mocks.userData, 'images', 'gone.png'))).toBe(false);
    // still-referenced files survive
    expect(existsSync(join(mocks.userData, 'images', 'shared.png'))).toBe(true);
    expect(existsSync(join(mocks.userData, 'images', 'keep.png'))).toBe(true);
    // index no longer contains e2
    const raw = JSON.parse(readFileSync(join(mocks.userData, 'history.json'), 'utf-8'));
    expect(raw.map((e: HistoryEntry) => e.id)).toEqual(['e1']);
  });

  it('shared file survives when still used by remaining entry', () => {
    const e1 = makeEntry('e1', ['shared.png']);
    const e2 = makeEntry('e2', ['shared.png']);
    seed([e1, e2], ['shared.png']);

    deleteHistory('e2');
    expect(existsSync(join(mocks.userData, 'images', 'shared.png'))).toBe(true);
    expect(listHistory().map((e) => e.id)).toEqual(['e1']);
  });

  it('deleting missing id leaves files alone', () => {
    const e1 = makeEntry('e1', ['keep.png']);
    seed([e1], ['keep.png']);
    deleteHistory('nope');
    expect(existsSync(join(mocks.userData, 'images', 'keep.png'))).toBe(true);
    expect(listHistory()).toHaveLength(1);
  });
});
