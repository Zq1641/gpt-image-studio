import { useState } from 'react'
import type { MouseEvent } from 'react'
import { useComposer } from '../state/useComposer'
import { CacheModal } from './CacheModal'
import { displayPrompt, skillNamesIn } from '../lib/skillTokens'
import type { HistoryEntry } from '@shared/types'

// Archive 列表分页步长：首屏 100 条，点“加载更多”每次 +100。
// 只影响渲染挂载数，不影响数据（history 全量仍在内存 state 里）。
const PAGE_SIZE = 100

function formatWhen(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function idxLabel(i: number, total: number): string {
  // Show archive indices counting from oldest (=1) so the most recent is N.
  // We render newest first; compute its display index as the total - i.
  return String(total - i).padStart(4, '0')
}

export function HistoryPanel() {
  const { state, refillFromHistory, refreshHistory } = useComposer()
  const { history } = state
  const [cacheOpen, setCacheOpen] = useState(false)
  // 全量保存：历史不再截断。渲染侧分页展示（默认 100 条 + 加载更多），
  // 避免几百条时一次性挂载全部 DOM 把列表拖卡。
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // 历史增删后把展示数 clamp 回合法区间：新增时保持用户已展开的数量，
  // 删到不足一页时收回，避免“删完出现空白页”。
  const total = history.length
  const safeVisible = Math.min(Math.max(visibleCount, PAGE_SIZE), Math.max(total, PAGE_SIZE))
  const visible = history.slice(0, safeVisible)
  const hasMore = total > safeVisible

  const showMore = () => setVisibleCount((c) => c + PAGE_SIZE)

  const handleClear = async () => {
    if (!confirm(`确认清空全部 ${history.length} 条历史记录？\n\n历史图片也会一并删除，此操作不可恢复。`)) return
    await window.api.clearHistory()
    await refreshHistory()
  }

  return (
    <div className="archive">
      <div className="archive-head">
        <div className="archive-eyebrow">
          Archive <span className="count">· {String(history.length).padStart(3, '0')}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="pill" onClick={() => setCacheOpen(true)}>
            Cache
          </button>
          <button type="button" className="pill" onClick={() => void refreshHistory()} title="失败置顶重试">
            Retry
          </button>
          {history.length > 0 && (
            <button type="button" className="pill danger" onClick={() => void handleClear()}>
              Clear
            </button>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="archive-list" style={{
          aspectRatio: '1 / 1',
          maxWidth: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 24, color: 'var(--text-3)',
          }}>empty archive</div>
          <div className="output-empty">暂无输出 · Generate something to begin</div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: 'var(--track-loose)', textTransform: 'uppercase',
            color: 'var(--text-3)',
          }}>Generate something to begin</div>
        </div>
      ) : (
        <div className="archive-list" style={{ aspectRatio: '1 / 1', maxWidth: '100%' }}>
          {visible.map((h, i) => (
            <ArchiveRow
              key={h.id}
              entry={h}
              displayIdx={idxLabel(i, total)}
              onClick={() => refillFromHistory(h)}
            />
          ))}
          {hasMore && (
            <button type="button" className="archive-more" onClick={showMore}>
              加载更多 · {total - safeVisible} / {total}
            </button>
          )}
        </div>
      )}
      {cacheOpen && <CacheModal onClose={() => setCacheOpen(false)} />}
    </div>
  )
}

function ArchiveRow({
  entry, displayIdx, onClick,
}: { entry: HistoryEntry; displayIdx: string; onClick: () => void }) {
  const { deleteHistoryEntry } = useComposer()

  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`删除这条历史？\n\n「${(displayPrompt(entry.promptRaw) || '(空提示词)').slice(0, 40)}」\n其生成图文件也会一并回收（仍被其他条目引用时保留）。`)) return
    await deleteHistoryEntry(entry.id)
  }

  const refCount = Array.isArray(entry.refImages) ? entry.refImages.length : 0
  const skillCount = skillNamesIn(entry.promptRaw ?? '').length

  return (
    <div className="archive-item" onClick={onClick}>
      <div className="idx">
        №<br />
        <span className="n">{displayIdx}</span>
      </div>
      <div className="ts">
        {formatWhen(entry.createdAt)}
        <span className="preset">{entry.presetName}</span>
      </div>
      <div className="body">
        <div className="prompt">{displayPrompt(entry.promptRaw) || '(空提示词)'}</div>
        <div className="params">
          {entry.params.aspect} · {entry.params.resolution} · ×{entry.params.count} · {entry.images.length} plate{entry.images.length === 1 ? '' : 's'}{refCount > 0 ? ` · ${refCount} ref` : ''}{skillCount > 0 ? ` · ${skillCount} skill` : ''}
        </div>
      </div>
      <button
        type="button"
        className="archive-del"
        onClick={(e) => void handleDelete(e)}
        aria-label="删除这条历史"
        title="删除这条历史"
      >×</button>
    </div>
  )
}
