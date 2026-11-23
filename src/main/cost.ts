// cost.ts — 纯函数：total = pricePerImage * count
export function estimateCost(count: number, pricePerImage: number): number {
  const c = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const p = Number.isFinite(pricePerImage) ? Math.max(0, pricePerImage) : 0;
  return Math.round(c * p * 10000) / 10000;
}
export function formatCNY(n: number): string {
  return '¥' + (Number.isFinite(n) ? n : 0).toFixed(2);
}
export function costPreview(count: number, pricePerImage: number): string {
  return `${formatCNY(estimateCost(count, pricePerImage))}（${count} 张 x ${formatCNY(pricePerImage)}/张）`;
}
