import { describe, expect, it } from 'vitest';
import { computeSize, sizeString } from './size';
import type { AspectRatio, Resolution } from './types';

const LONG_EDGE: Record<string, number> = { '1K': 1024, '2K': 2048, '4K': 4096 };

function snap64(n: number): number {
  return Math.max(64, Math.round(n / 64) * 64);
}

function expectedComputed(aspect: AspectRatio, resolution: '1K' | '2K' | '4K'): string {
  const [w, h] = {
    '21:9': [21, 9],
    '16:9': [16, 9],
    '3:2': [3, 2],
    '4:3': [4, 3],
    '1:1': [1, 1],
    '3:4': [3, 4],
    '2:3': [2, 3],
    '9:16': [9, 16],
  }[aspect] as [number, number];
  const long = LONG_EDGE[resolution]!;
  const short = snap64((long * Math.min(w, h)) / Math.max(w, h));
  return w >= h ? `${long}x${short}` : `${short}x${long}`;
}

describe('computeSize 24 combinations', () => {
  const aspects: AspectRatio[] = ['21:9', '16:9', '3:2', '4:3', '1:1', '3:4', '2:3', '9:16'];
  const resolutions: ('1K' | '2K' | '4K')[] = ['1K', '2K', '4K'];
  for (const aspect of aspects) {
    for (const resolution of resolutions) {
      it(`${aspect} @ ${resolution} => ${expectedComputed(aspect, resolution)}`, () => {
        expect(computeSize(aspect, resolution)).toBe(expectedComputed(aspect, resolution));
      });
    }
  }

  it('spot checks', () => {
    expect(computeSize('16:9', '1K')).toBe('1024x576');
    expect(computeSize('1:1', '2K')).toBe('2048x2048');
    expect(computeSize('9:16', '1K')).toBe('576x1024');
  });

  it('auto returns empty (upper layer omits size)', () => {
    expect(computeSize('16:9', 'auto')).toBe('');
    expect(computeSize('1:1', 'auto')).toBe('');
  });

  it('WxH passthrough', () => {
    const custom = '1024x1536' as Resolution;
    expect(computeSize('16:9', custom)).toBe('1024x1536');
    expect(computeSize('1:1', custom)).toBe('1024x1536');
  });
});

describe('sizeString modes', () => {
  it("omit returns ''", () => {
    expect(sizeString('16:9', '1K', 'omit')).toBe('');
  });
  it('square returns LONGxLONG', () => {
    expect(sizeString('16:9', '1K', 'square')).toBe('1024x1024');
    expect(sizeString('9:16', '2K', 'square')).toBe('2048x2048');
    expect(sizeString('1:1', '4K', 'square')).toBe('4096x4096');
  });
  it('computed delegates to computeSize', () => {
    expect(sizeString('4:3', '1K', 'computed')).toBe(computeSize('4:3', '1K'));
  });
  it('auto returns empty', () => {
    expect(sizeString('16:9', 'auto', 'computed')).toBe('');
    expect(sizeString('16:9', 'auto', 'square')).toBe('');
  });
  it('WxH passthrough in any mode except omit', () => {
    const custom = '768x1152' as Resolution;
    expect(sizeString('16:9', custom, 'computed')).toBe('768x1152');
    expect(sizeString('16:9', custom, 'square')).toBe('768x1152');
    expect(sizeString('16:9', custom, 'omit')).toBe('');
  });
});
