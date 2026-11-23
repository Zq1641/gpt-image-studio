import { useEffect, useState } from 'react'
import { useComposer } from '../state/useComposer'
import type { CacheStats } from '@shared/types'

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB']
  let v = n / 1024
  let u = 0
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u += 1
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[u]}`
}

// 缓存清理弹窗：展示三项占用的体积，支持针对性清理。
//   - 生成图：images/ 下的全部 plate 文件（清掉后历史条目保留，但图显示缺失）
//   - 参考图快照：history.json 里内嵌的 refImages[].dataUrl（history.json 膨胀主因，
//     剥离后历史/生成图都保留，只是老条目回填时不再恢复参考图）
//   - 全部清空：生成图 + 历史索引（含快照），等价于 Clear
export function CacheModal({ onClose }: { onClose: () => void }) {
  const { refreshHistory } = useComposer()
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const reload = async () => {
    const s = await window.api.getCacheStats()
    setStats(s)
  }

  useEffect(() => {
    void reload()
  }, [])

  const run = async (key: 'images' | 'refs' | 'all', fn: () => Promise<unknown>) => {
    if (busy) return
    setBusy(key)
    try {
      const res = await fn() as { entries?: unknown[]; stats?: CacheStats } | CacheStats
      if (res && typeof res === 'object' && 'stats' in res && res.stats) {
        setStats(res.stats)
      } else {
        await reload()
      }
      await refreshHistory()
    } finally {
      setBusy(null)
    }
  }

  const confirmImages = async () => {
    if (!stats || stats.imageCount === 0) return
    if (!confirm(`删除全部 ${stats.imageCount} 张本地生成图（${formatBytes(stats.imageBytes)}）？\n\n历史条目会保留，但图片将无法预览。此操作不可恢复。`)) return
    await run('images', () => window.api.clearGeneratedImages())
  }

  const confirmRefs = async () => {
    if (!stats || stats.refCount === 0) return
    if (!confirm(`剥离全部 ${stats.refCount} 张历史参考图快照（约 ${formatBytes(stats.refBytes)}）？\n\n生成图与历史记录都保留，只是老条目回填时不再恢复参考图。`)) return
    await run('refs', () => window.api.clearRefCache())
  }

  const confirmAll = async () => {
    if (!confirm(`清空全部缓存（${stats ? formatBytes(stats.totalBytes) : ''}）？\n\n包括：全部生成图 + 全部历史记录 + 参考图快照。此操作不可恢复。`)) return
    await run('all', () => window.api.clearAllCache())
  }

  return (
    <div role="dialog" aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20, 18, 15, 0.45)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, maxHeight: '85vh', overflow: 'auto',
          background: 'var(--bg-card)', borderRadius: 'var(--r-md)',
          border: '1px solid var(--line-strong)',
          boxShadow: 'var(--shadow-pop)', padding: 28,
        }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{
            margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 26, fontWeight: 500, color: 'var(--text-1)', letterSpacing: '-0.01em',
          }}>Cache</h2>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: 'var(--track-loose)', textTransform: 'uppercase',
            color: 'var(--text-3)',
          }}>Total {stats ? formatBytes(stats.totalBytes) : '…'}</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          letterSpacing: 'var(--track-loose)', textTransform: 'uppercase',
          color: 'var(--text-3)', marginBottom: 16,
        }}>Storage · 清理缓存</div>

        {!stats ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>正在统计…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CacheRow
              title="生成图"
              en="Generated plates"
              detail={`${stats.imageCount} 张 · ${formatBytes(stats.imageBytes)}`}
              actionLabel={busy === 'images' ? '清理中…' : '清理'}
              disabled={stats.imageCount === 0 || busy !== null}
              onAction={() => void confirmImages()}
            />
            <CacheRow
              title="参考图快照"
              en="Reference snapshots"
              detail={`${stats.refCount} 张 · 约 ${formatBytes(stats.refBytes)}`}
              actionLabel={busy === 'refs' ? '清理中…' : '清理'}
              disabled={stats.refCount === 0 || busy !== null}
              onAction={() => void confirmRefs()}
            />
            <CacheRow
              title="历史索引"
              en="History index"
              detail={`${stats.historyCount} 条 · ${formatBytes(stats.historyBytes)}（含快照）`}
              actionLabel="随全部清空"
              disabled
              onAction={() => {}}
            />
          </div>
        )}

        <div style={{
          marginTop: 12, padding: 10, borderRadius: 'var(--r-sm)',
          background: 'var(--bg-page)', border: '1px solid var(--line)',
          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6,
        }}>
          「全部清空」会删除生成图 + 历史记录 + 快照，等价于 Archive 的 Clear。
          只想瘦身不清记录时，用上面两项针对性清理。
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button type="button" className="pill danger"
            disabled={busy !== null || !stats || stats.totalBytes === 0}
            onClick={() => void confirmAll()}>
            {busy === 'all' ? '清空中…' : '全部清空'}
          </button>
          <button type="button" className="pill" onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  )
}

function CacheRow({
  title, en, detail, actionLabel, disabled, onAction,
}: {
  title: string; en: string; detail: string
  actionLabel: string; disabled: boolean; onAction: () => void
}) {
  return (
    <div style={{
      border: '1px solid var(--line)', borderRadius: 10,
      padding: '10px 12px', background: 'var(--bg-input)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15 }}>{title}</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            letterSpacing: 'var(--track-loose)', textTransform: 'uppercase',
            color: 'var(--text-3)',
          }}>{en}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
          {detail}
        </div>
      </div>
      <button type="button" className="pill" onClick={onAction} disabled={disabled}
        style={{ opacity: disabled ? 0.4 : 1 }}>
        {actionLabel}
      </button>
    </div>
  )
}
