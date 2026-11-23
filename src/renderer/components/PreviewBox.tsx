import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useComposer } from '../state/useComposer'

// print-frame 边长：实测所在列的可用宽×行高后取 min（封顶 560px，防超大屏糊成一片）。
// 不再写死 400：窗口拉大拉小，正方形永远取“当前空间里最大的合法边长”。
function usePrintSize(colRef: React.RefObject<HTMLDivElement | null>): number {
  const [size, setSize] = useState(400)
  useLayoutEffect(() => {
    const el = colRef.current
    if (!el) return
    const measure = () => {
      const row = el.parentElement
      const head = el.parentElement?.querySelector(':scope > .eyebrow')
      const rowH = row?.clientHeight ?? 400
      const headH = head instanceof HTMLElement ? head.offsetHeight : 28
      const w = el.clientWidth
      // 行高 - header - 列内 gap ≈ 正方形可用高度；列宽即宽度上限
      const next = Math.max(200, Math.min(560, w, rowH - headH - 2))
      setSize((prev) => (Math.abs(prev - next) < 1 ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (el.parentElement) ro.observe(el.parentElement)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [colRef])
  return size
}

export function PreviewBox() {
  const { state } = useComposer()
  const { previewEntry, status, error } = state
  const colRef = useRef<HTMLDivElement | null>(null)
  const SIZE = Math.round(usePrintSize(colRef))
  const images = previewEntry?.images ?? []
  const [idx, setIdx] = useState(0)
  // P1-5缩放下界：clamp(0.2,4.0)函数式更新，中心恒中，关闭重置
  const [scale, setScale] = useState(1)
  const clampScale = (v: number) => Math.min(4.0, Math.max(0.2, v));
  const zoomBy = (d: number) => { console.log('[zoom] delta=', d); setScale((ss) => clampScale(Number((ss + d).toFixed(3)))); };
  const [viewer, setViewer] = useState(false)

  // When a new entry lands (or images go away), reset to first plate and
  // close any open viewer so the UI doesn't get stuck on a stale image.
  useEffect(() => {
    setIdx(0)
    setViewer(false)
    setScale(1)
  }, [previewEntry?.id])

  // Keyboard navigation while the viewer is open.
  useEffect(() => {
    if (!viewer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewer(false)
      else if (e.key === 'ArrowLeft')  setIdx((i) => (i - 1 + images.length) % images.length)
      else if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewer, images.length])

  const current = images[idx]
  const isLoading = status === 'loading'
  const isEmpty = !isLoading && images.length === 0

  // 缺失图兜底：生成图文件可能被“清理缓存”删掉（历史条目保留），
  // 此时 <img> 会 error，用虚线占位代替破图图标。
  const [broken, setBroken] = useState<Set<string>>(new Set())
  useEffect(() => {
    setBroken(new Set())
  }, [previewEntry?.id])
  const markBroken = (file: string) =>
    setBroken((s) => {
      if (s.has(file)) return s
      const next = new Set(s)
      next.add(file)
      return next
    })

  // Save button.
  //
  //   count === 1  → single Save-As dialog with the proper .png filter
  //                   (cleaner UX: user expects one file picker, not a
  //                   directory picker, for a single image).
  //   count  >  1  → directory picker, write every plate into the
  //                   chosen folder in one shot (single-shot workflow).
  const downloadAll = () => {
    if (images.length === 0) return
    if (images.length === 1) {
      const first = images[0]
      if (!first) return
      void window.api.downloadHistoryFile(first.file)
    } else {
      void window.api.downloadHistoryFiles(images.map((i) => i.file))
    }
  }

  const openAt = (i: number) => {
    if (images.length === 0) return
    setIdx(((i % images.length) + images.length) % images.length)
    setViewer(true)
  }

  // -------- gallery (thumbnail) view --------
  const box = (
    <div className="print" ref={colRef} style={{ width: '100%' }}>
      <div
        className="print-frame"
        style={{ width: SIZE, height: SIZE, padding: 0, position: 'relative' }}
      >
        {isLoading ? (
          <Spinner />
        ) : isEmpty ? (
          <EmptyState error={error} />
        ) : (
          <div className="gallery" style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        {/* P1-5缩放条 */}
            {images.map((img, i) => (
              <button
                key={img.file}
                type="button"
                className="gallery-cell"
                onClick={() => openAt(i)}
                aria-label={`Open plate ${i + 1} of ${images.length}`}
              >
                {broken.has(img.file) ? (
                  <span className="gallery-missing">missing file</span>
                ) : (
                  <img src={img.url} alt="" draggable={false} onError={(e) => { console.log('[file] img onError', img.file, (e.target as HTMLImageElement).src.slice(0, 120)); markBroken(img.file) }} />
                )}
                <span className="gallery-idx">{String(i + 1).padStart(2, '0')}</span>
              </button>
            ))}
          </div>
        )}

        {!isEmpty && !isLoading && (
          <div className="gallery-zoombar" style={{ position: 'absolute', right: 8, top: 8, display: 'flex', gap: 4 }}>
            <button type="button" aria-label="缩小" onClick={(e) => { e.stopPropagation(); zoomBy(-0.2) }}>−</button>
            <button type="button" aria-label="放大" onClick={(e) => { e.stopPropagation(); zoomBy(0.2) }}>＋</button>
            <button type="button" aria-label="重置" onClick={(e) => { e.stopPropagation(); console.log('[zoom] reset'); setScale(1) }}>1:1</button>
          </div>
        )}
        {/* Print label — sits on the frame border. */}
        {current && (
          <div className="print-index">
            Print № <strong>{images.length ? '0001' : '----'}</strong>
          </div>
        )}

        {/* Save — bottom-right of the frame. Downloads every plate at
            once (one folder picker, all files written). Label reflects
            count so users know what they're getting. */}
        {current && (
          <button
            type="button"
            className="print-save"
            onClick={(e) => { e.stopPropagation(); downloadAll() }}
            aria-label="保存全部图片"
            title="一键下载全部生成的图片"
          >
            ↓ Save {images.length > 1 ? `×${images.length}` : ''}
          </button>
        )}
      </div>
    </div>
  )

  if (viewer) {
    return (
      <Viewer
        images={images}
        idx={idx}
        setIdx={setIdx}
        onClose={() => setViewer(false)}
        onSaveCurrent={() => {
          if (!current) return
          void window.api.downloadHistoryFile(current.file)
        }}
      />
    )
  }

  return box
}

// ---------------------------------------------------------------------------
// Viewer — fullscreen lightbox with keyboard nav, drag nav, right-click save.
//
// Gesture model:
//   - Press (left button)  → start a tentative drag, no commit yet.
//   - Move < 8px on release  → it was a click; close the viewer.
//   - Move ≥ 8px on release  → it was a drag; flip plate if past the
//                              threshold OR if the flick velocity is high.
//                              Animate the slide-out / slide-in instead
//                              of jumping — see `commitPage()` below.
// ---------------------------------------------------------------------------

function Viewer({
  images, idx, setIdx, onClose, onSaveCurrent,
}: {
  images: { file: string; url: string }[]
  idx: number
  setIdx: (updater: (i: number) => number) => void
  onClose: () => void
  onSaveCurrent: () => void
}) {
  // Live translate in pixels. Negative = dragging left (next plate will
  // slide in from the right). Positive = dragging right (previous plate).
  const [dx, setDx] = useState(0)
  // True only once we've passed the movement threshold — separates
  // "click to close" from "drag to page".
  const [dragging, setDragging] = useState(false)
  // When a flip has been committed (drag past threshold or fast flick)
  // we animate dx to ±stageW, then change idx and animate back to 0.
  // `flying` is the state that suppresses click-close for the rest of
  // this gesture.
  const [flying, setFlying] = useState<null | { direction: 1 | -1 }>(null)

  // Refs — values that change frequently during a drag and that we
  // don't want to put in React state (would re-render every frame).
  const stateRef = useRef({
    startX: 0,
    lastX: 0,
    lastT: 0,
    vx: 0,        // px/ms; signed
    moved: 0,      // distance moved since press (signed)
    raf: 0,
    // True for one event tick after the user releases a drag, so the
    // backdrop click that would otherwise close the viewer doesn't fire.
    justDragged: false,
  })

  const stageRef = useRef<HTMLDivElement | null>(null)
  const FLICK_THRESHOLD = 60   // px — past this on release, commit
  const VELOCITY_THRESHOLD = 0.35 // px/ms — fast flick commits even below threshold
  const DRAG_THRESHOLD = 8      // px — first move past this claims the drag

  const onImgError = () => onClose()

  // Drive dx through requestAnimationFrame so the drag follows the cursor
  // with sub-frame latency and the slide-out/in animations ease smoothly.
  const tick = (nextDx: number) => {
    cancelAnimationFrame(stateRef.current.raf)
    stateRef.current.raf = requestAnimationFrame(() => setDx(nextDx))
  }

  const onPointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if (flying) return // ignore press during commit animation
    const s = stateRef.current
    s.startX = e.clientX
    s.lastX = e.clientX
    s.lastT = performance.now()
    s.vx = 0
    s.moved = 0
    setDragging(false)
    setDx(0)
  }

  // Use mousemove (not pointermove) so the handler only fires while a
  // mouse button is down. Pointermove fires on hover too, which made the
  // image drift the moment the user moved the cursor over it (s.moved was
  // non-zero because s.startX defaults to 0).
  // We still check e.buttons defensively — some setups can deliver
  // mousemove with no buttons down.
  const onPointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return // no button pressed = pure hover, ignore
    const s = stateRef.current
    const cur = e.clientX
    const now = performance.now()
    const dt = Math.max(1, now - s.lastT)
    s.vx = (cur - s.lastX) / dt   // px/ms, signed
    s.lastX = cur
    s.lastT = now
    s.moved = cur - s.startX

    if (!s.moved) return
    // Once we've moved past the threshold, treat this as a drag.
    if (!dragging && Math.abs(s.moved) > DRAG_THRESHOLD) setDragging(true)
    if (flying) return
    // Slight resistance past the first 30% so the gesture feels "weighted"
    const stageW = stageRef.current?.clientWidth ?? window.innerWidth
    const resist = s.moved > 0
      ? Math.max(0, s.moved - stageW * 0.3)
      : Math.min(0, s.moved + stageW * 0.3)
    const visual = s.moved - resist * 0.4
    tick(visual)
  }

  // Animate dx to a target value with custom ease (used by commitPage +
  // snapBack). Returns when the animation has effectively stopped.
  const animateTo = (target: number, durationMs: number, onDone: () => void) => {
    cancelAnimationFrame(stateRef.current.raf)
    const startVal = dx
    const startT = performance.now()
    const step = () => {
      const t = Math.min(1, (performance.now() - startT) / durationMs)
      // ease-out cubic: 1 - (1-t)^3
      const eased = 1 - Math.pow(1 - t, 3)
      const v = startVal + (target - startVal) * eased
      setDx(v)
      if (t < 1) {
        stateRef.current.raf = requestAnimationFrame(step)
      } else {
        onDone()
      }
    }
    stateRef.current.raf = requestAnimationFrame(step)
  }

  // User released after a drag. Decide commit vs snap-back.
  // IMPORTANT: only the LEFT button (0) is a gesture. Right-click is
  // handled by onContextMenu (save) — its mouseup (button=2) must NOT
  // be treated as "tiny click → close the viewer", otherwise saving via
  // right-click would instantly close the lightbox.
  const onPointerUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const s = stateRef.current
    const wasDragging = dragging
    setDragging(false)
    if (flying) return

    // Tiny move → click. Close the viewer.
    if (!wasDragging && Math.abs(s.moved) < DRAG_THRESHOLD) {
      onClose()
      return
    }
    // Big drag or fast flick → page. Direction: positive drag = previous
    // plate (came from right); negative drag = next plate (came from left).
    const stageW = stageRef.current?.clientWidth ?? window.innerWidth
    const passedThreshold = Math.abs(s.moved) > FLICK_THRESHOLD
    const flickCommit = Math.abs(s.vx) > VELOCITY_THRESHOLD
    if (passedThreshold || flickCommit) {
      // Mark so the next synthetic click (mouseup → click on backdrop if
      // cursor is over backdrop) doesn't close us out of the gesture.
      s.justDragged = true
      const dir: 1 | -1 = (s.moved < 0 || s.vx < 0) ? -1 : 1
      commitPage(dir, stageW)
    } else {
      animateTo(0, 220, () => {})
    }
  }

  // window-level mouseup catches the release if the cursor is over the
  // background or off the window when the user lets go. Without this,
  // pointerup would never fire after a drag because the mouse left the
  // img mid-gesture — leaving `dragging` permanently true and the
  // cursor stuck in its pressed state. This handler also commits the
  // page-flip when the cursor left the img before mouseup.
  useEffect(() => {
    if (!dragging && !flying) return
    const onUp = (e: MouseEvent) => {
      if (e.button !== 0) return // ignore right/middle-button releases
      const s = stateRef.current
      setDragging(false)
      if (flying) return
      const stageW = stageRef.current?.clientWidth ?? window.innerWidth
      const passedThreshold = Math.abs(s.moved) > FLICK_THRESHOLD
      const flickCommit = Math.abs(s.vx) > VELOCITY_THRESHOLD
      if (passedThreshold || flickCommit) {
        // Same logic as onPointerUp: mark justDragged so the next
        // synthetic click on the backdrop doesn't close the viewer.
        s.justDragged = true
        const dir: 1 | -1 = (s.moved < 0 || s.vx < 0) ? -1 : 1
        commitPage(dir, stageW)
      } else {
        animateTo(0, 220, () => {})
      }
    }
    const onMove = (e: MouseEvent) => {
      // Continue to track movement after the cursor leaves the image —
      // some browsers stop firing mousemove when the pointer is no
      // longer over the source element.
      if (e.buttons === 0) return
      const s = stateRef.current
      const cur = e.clientX
      const now = performance.now()
      const dt = Math.max(1, now - s.lastT)
      s.vx = (cur - s.lastX) / dt
      s.lastX = cur
      s.lastT = now
      s.moved = cur - s.startX
      if (!s.moved) return
      if (!dragging && Math.abs(s.moved) > DRAG_THRESHOLD) setDragging(true)
      if (flying) return
      const stageW = stageRef.current?.clientWidth ?? window.innerWidth
      const resist = s.moved > 0
        ? Math.max(0, s.moved - stageW * 0.3)
        : Math.min(0, s.moved + stageW * 0.3)
      tick(s.moved - resist * 0.4)
    }
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mousemove', onMove)
    }
  }, [dragging, flying])

  // Commit a page change with a slide-out + slide-in animation.
  // `dir === -1`: user dragged left → next plate. The old image slides
  // further left off-stage, then idx increments, new image slides in
  // from the right (translateX starts at +stageW and eases back to 0).
  // `dir === 1`: opposite — previous plate.
  const commitPage = (dir: 1 | -1, stageW: number) => {
    setFlying({ direction: dir })
    // 1) slide the current image off-stage
    animateTo(dir * stageW, 220, () => {
      // 2) swap index and reset dx to +stageW so the new image sits just
      //    off the opposite side
      setIdx((i) => {
        const next = dir === -1
          ? (i + 1) % images.length
          : (i - 1 + images.length) % images.length
        return next
      })
      // After state update, dx is still at ±stageW; set it to the start
      // position for the new image and slide back to 0.
      setDx(-dir * stageW)
      // wait one frame so React commits the new <img>, then animate.
      requestAnimationFrame(() => {
        animateTo(0, 260, () => {
          setFlying(null)
        })
      })
    })
  }

  // Right-click → save the visible plate.
  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    onSaveCurrent()
  }

  // Click on the dimmed backdrop closes the viewer — BUT only when we're
  // not in the middle of a drag, page-flip animation, or just-released-
  // a-drag (otherwise the synthetic click after the mouseup would close
  // the viewer mid-gesture).
  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (dragging || flying) return
    if (stateRef.current.justDragged) {
      stateRef.current.justDragged = false
      return
    }
    onClose()
  }

  const current = images[idx]
  if (!current) {
    onClose()
    return null
  }

  return (
    <div
      role="dialog" aria-modal="true"
      ref={stageRef}
      onClick={onBackdropClick}
      onContextMenu={onContextMenu}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(20, 18, 15, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        // Cursor is fixed (never reacts to internal drag state). Reasons:
        //   1. macOS often keeps a `grabbing` cursor visually after a real
        //      mouse drag until the cursor itself moves over a new element.
        //      Tying cursor to a React flag makes it stick when state
        //      briefly lags behind the system pointer.
        //   2. The user expects "click to close" to behave like a normal
        //      click — having the cursor flicker to `grabbing` on press
        //      reads as "the image is grabbed", which conflicts with the
        //      close-on-click semantics.
        // The drag still works via pointer events; the cursor is purely
        // visual and tells the user "this is a tappable image, drag
        // horizontally to page".
        cursor: 'zoom-out',
        overflow: 'hidden',
        userSelect: 'none',
        touchAction: 'pan-y',
      }}
    >
      <img
        key={current.file}
        src={current.url}
        alt={`plate ${idx + 1} of ${images.length}`}
        draggable={false}
        onError={onImgError}
        // Mouse events (not pointer events) so the handler does NOT fire
        // on hover. pointermove fires whenever the cursor moves over the
        // element regardless of button state; on React that meant the
        // image drifted the moment the cursor entered it.
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        style={{
          maxWidth: '92vw',
          maxHeight: '88vh',
          width: 'auto',
          height: 'auto',
          objectFit: 'contain',
          borderRadius: 2,
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.55)',
          transform: `translate3d(${dx}px, 0, 0)`,
          // No CSS transition — we drive the value with rAF so we get
          // exact easing control and no jank from CSS transition + state
          // updates fighting each other.
          willChange: 'transform',
          cursor: 'zoom-out',
          touchAction: 'none',
        }}
      />

      {images.length > 1 && (
        <div className="pager" style={{ bottom: 24, cursor: 'pointer' }}>
          {images.map((_, i) => (
            <button key={i} type="button"
              className={`dot ${i === idx ? 'is-active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setIdx(() => i) }}
              aria-label={`Go to plate ${i + 1}`}
            />
          ))}
        </div>
      )}

      <div style={{
        position: 'absolute', top: 16, left: 16,
        fontFamily: 'var(--font-mono)', fontSize: 10,
        letterSpacing: 'var(--track-loose)', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.6)', pointerEvents: 'none',
      }}>
        {idx + 1} / {images.length}
      </div>
      <div style={{
        position: 'absolute', top: 16, right: 16,
        fontFamily: 'var(--font-mono)', fontSize: 10,
        letterSpacing: 'var(--track-loose)', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.45)', pointerEvents: 'none',
      }}>
        drag / ← → navigate · right-click save · click to close
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div role="status" aria-label="生成中"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 44, height: 44,
        border: '2px solid rgba(31, 63, 224, 0.18)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'gptimg2-spin 900ms cubic-bezier(0.6, 0.05, 0.4, 0.95) infinite',
      }} />
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10, letterSpacing: 'var(--track-loose)',
        textTransform: 'uppercase', color: 'var(--text-3)',
      }}>Exposing plate</div>
      <style>{`@keyframes gptimg2-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function EmptyState({ error }: { error?: { message: string; body?: string } }) {
  if (error) {
    return (
      <div style={{ padding: 16, textAlign: 'center', maxWidth: 320, color: 'var(--text-1)' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic',
          fontSize: 18, color: 'var(--danger)', marginBottom: 10,
        }}>Exposure failed.</div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--text-2)', marginBottom: 12,
        }}>{error.message}</div>
        {error.body && (
          <pre style={{
            margin: 0, padding: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 10, lineHeight: 1.5,
            color: 'var(--text-2)',
            background: 'var(--bg-page)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            maxHeight: 200, overflow: 'auto',
            textAlign: 'left',
          }}>{error.body}</pre>
        )}
      </div>
    )
  }
  return (
    <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 32, color: 'var(--text-2)', marginBottom: 8,
      }}>no exposure yet</div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        letterSpacing: 'var(--track-loose)', textTransform: 'uppercase',
      }}>Press generate to expose</div>
    </div>
  )
}