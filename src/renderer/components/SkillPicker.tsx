import { useRef, useState } from 'react'
import { useComposer } from '../state/useComposer'
import { skillNameFromFile, SKILL_CONTENT_MAX } from '@shared/skills'

// 右上角 Skills 区：复用原 presets（TemplatePills/.toc）的排版语言 ——
// 同样的 eyebrow 计数、同样的 toc-item 行（编号 + 中文大字 + 英文小字 + hover →）。
// 点击一行 → 往输入框插入红色胶囊；hover 行尾 × → 删除。
// 上传：只收 .md / .markdown / .txt，纯文本读取，全文存盘。
export function SkillPicker() {
  const { state, insertSkill, addSkill, deleteSkill } = useComposer()
  const skills = state.settings.skills ?? []
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const pickFile = () => {
    setError('')
    fileRef.current?.click()
  }

  const onFile = async (f: File | undefined) => {
    if (!f || busy) return
    setError('')
    const text = await f.text().catch(() => '')
    if (!text.trim()) {
      setError('文件是空的，换一个再试')
      return
    }
    if (text.length > SKILL_CONTENT_MAX) {
      setError(`文件过大（${(text.length / 1024).toFixed(0)}KB，限 ${SKILL_CONTENT_MAX / 1000}KB）`)
      return
    }
    setBusy(true)
    try {
      const name = skillNameFromFile(f.name)
      // 同名视为覆盖更新：先问一句，避免手滑覆盖已有全文。
      const dup = skills.find((s) => s.name === name)
      if (dup && !confirm(`已存在同名 Skill「${name}」，用新文件覆盖它的全文吗？`)) return
      await addSkill({ name, content: text, sourceName: f.name })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onDelete = async (id: string) => {
    if (confirmId !== id) {
      // 第一击：行内确认态（沿用 model-chip is-confirm 的红描边语言）
      setConfirmId(id)
      return
    }
    setConfirmId(null)
    await deleteSkill(id)
  }

  return (
    <div className="toc skill-list">
      <input
        ref={fileRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        style={{ display: 'none' }}
        aria-label="上传 skill 文件"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        className="toc-item toc-upload"
        onClick={pickFile}
        disabled={busy}
        title="上传 .md / .txt（全文存盘，输入框只显示红色名称胶囊）"
      >
        <span className="toc-num">＋</span>
        <span className="toc-text">
          <span className="toc-label">{busy ? '上传中…' : '上传 Skill'}</span>
          <span className="toc-en">Upload .md / .txt</span>
        </span>
      </button>
      {error && <div className="plate-err" style={{ padding: '6px 0' }}>{error}</div>}
      {skills.length === 0 && !error && (
        <div className="skill-empty">暂无 Skill，点上面上传第一个</div>
      )}
      {skills.map((s, i) => (
        <button
          key={s.id}
          type="button"
          className={`toc-item skill-row${confirmId === s.id ? ' is-confirm' : ''}`}
          onClick={() => insertSkill(s.name)}
          title={`点击插入「${s.name}」胶囊（全文 ${s.charCount} 字，生成时自动拼入）`}
        >
          <span className="toc-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="toc-text">
            <span className="toc-label">{s.name}</span>
            <span className="toc-en">{s.charCount} chars{s.sourceName ? ` · ${s.sourceName}` : ''}</span>
          </span>
          <span
            role="button"
            aria-label={confirmId === s.id ? `确认删除 ${s.name}` : `删除 ${s.name}`}
            title={confirmId === s.id ? '再点一次确认删除' : '删除这个 Skill'}
            className="skill-del"
            onClick={(e) => { e.stopPropagation(); void onDelete(s.id) }}
            onMouseDown={(e) => e.stopPropagation()}
          >{confirmId === s.id ? '确认？' : '×'}</span>
        </button>
      ))}
    </div>
  )
}
