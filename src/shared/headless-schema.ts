// headless-schema.ts — 单核心唯一参数校验 + Body组装
// CLI/MCP/Electron三端唯一入口。只校验不二次封装。
import type { AspectRatio, Count, Quality, Resolution, ImageFieldName, SizeMode } from './types';
import { QUALITY_ALL, getSupportedQualities } from './types';
import { sizeString } from './size';

export interface HeadlessInput {
  prompt?: unknown; aspect?: unknown; resolution?: unknown;
  quality?: unknown; count?: unknown; images?: unknown;
  complexity?: unknown; size?: unknown; model?: unknown;
}
export interface HeadlessParams {
  prompt: string; aspect: AspectRatio; resolution: Resolution;
  quality: Quality; count: Count; images: string[];
  complexity?: string; sizeOverride?: string; modelOverride?: string;
}
export interface PresetLike {
  model: string; imageFieldName: ImageFieldName;
  sizeMode: SizeMode; sendAspectRatio: boolean;
}
const ASPECTS: AspectRatio[] = ['21:9','16:9','3:2','4:3','1:1','3:4','2:3','9:16'];
export function isAspect(v: unknown): v is AspectRatio {
  return typeof v === 'string' && (ASPECTS as string[]).includes(v);
}
export function isResolution(v: unknown): v is Resolution {
  if (v === 'auto' || v === '1K' || v === '2K' || v === '4K' || v === '6K' || v === '8K') return true;
  return typeof v === 'string' && /^\d+x\d+$/.test(v);
}
export function isQuality(v: unknown, model?: string): v is Quality {
  const allowed = model ? getSupportedQualities(model) : QUALITY_ALL;
  return typeof v === 'string' && (allowed as string[]).includes(v);
}
export function isCount(v: unknown): v is Count {
  return v === 1 || v === 2 || v === 3 || v === 4;
}
export function parseHeadlessParams(input: HeadlessInput, model?: string): { ok: true; params: HeadlessParams } | { ok: false; message: string } {
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (!prompt) return { ok: false, message: 'prompt 不能为空' };
  if (prompt.length > 8000) return { ok: false, message: 'prompt 超长（限8000字符）' };
  const aspect = input.aspect ?? '1:1';
  if (!isAspect(aspect)) return { ok: false, message: '非法 aspect' };
  const resolution = input.resolution ?? 'auto';
  if (!isResolution(resolution)) return { ok: false, message: '非法 resolution，仅支持 auto/1K/2K/4K/6K/8K/WxH' };
  const m = model ?? (typeof input.model === 'string' ? input.model : undefined);
  const quality = input.quality ?? 'medium';
  if (!isQuality(quality, m)) return { ok: false, message: '非法 quality，老四模型仅 auto/low/medium/high，2.6支持六档' };
  const count = input.count ?? 1;
  if (!isCount(count)) return { ok: false, message: '非法 count，仅支持 1-4' };
  let images: string[] = [];
  if (input.images !== undefined) {
    if (!Array.isArray(input.images)) return { ok: false, message: 'images 必须为 string[]' };
    for (const s of input.images) {
      if (typeof s !== 'string' || s.length === 0) return { ok: false, message: 'images 元素必须非空字符串' };
    }
    images = input.images as string[];
  }
  const out: HeadlessParams = { prompt, aspect, resolution: resolution as Resolution, quality: quality as Quality, count: count as Count, images };
  if (input.complexity !== undefined) {
    if (typeof input.complexity !== 'string' || !input.complexity || input.complexity.length > 64)
      return { ok: false, message: '非法 complexity（透传字符串）' };
    out.complexity = input.complexity;
  }
  if (input.size !== undefined) {
    if (typeof input.size !== 'string' || !input.size || input.size.length > 32)
      return { ok: false, message: '非法 size（透传字符串）' };
    out.sizeOverride = input.size;
  }
  if (typeof input.model === 'string' && input.model.trim()) out.modelOverride = input.model.trim().slice(0, 120);
  return { ok: true, params: out };
}
export function buildImageBody(p: HeadlessParams, preset: PresetLike, promptResolved: string): Record<string, unknown> {
  const model = p.modelOverride || preset.model;
  const body: Record<string, unknown> = { model, prompt: promptResolved, n: p.count };
  if (p.quality !== 'auto') (body as Record<string, unknown>).quality = p.quality;
  const size = p.sizeOverride ?? sizeString(p.aspect, p.resolution, preset.sizeMode);
  if (size) body.size = size;
  if (preset.sendAspectRatio) body.aspect_ratio = p.aspect;
  if (p.complexity !== undefined) body.complexity = p.complexity;
  if (p.images.length > 0) body[preset.imageFieldName] = p.images.length === 1 ? p.images[0] : p.images;
  return body;
}
export function estimatePayloadBytes(images: string[]): number {
  return images.reduce((s, x) => s + Math.floor(x.length * 0.75), 0);
}
