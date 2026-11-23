import { useComposer } from '../state/useComposer'
import { resolvePrompt } from '../lib/refTokens'
import { missingSkillNames, resolveSkillPrompt } from '../lib/skillTokens'

// 生成按钮：idle/error 时是 Generate（含校验禁用态）；
// loading 时变成“取消生成”，点按即 abort 当前请求。
export function GenerateButton() {
  const { state, runGenerate, cancelGenerate } = useComposer()
  const { prompt, refImages, status } = state
  const skills = state.settings.skills ?? []
  const loading = status === 'loading'

  const { hasErrors, resolved } = (() => {
    // 先展开 skill 全文（胶囊→全文），再做 @图N 解析。
    // 顺序不能反：skill 全文里也可能带 @图N 引用。
    const sk = resolveSkillPrompt(prompt, skills)
    const r = resolvePrompt(sk.text, refImages)
    const out = { hasErrors: r.errors.length > 0 || sk.errors.length > 0, resolved: r.text }
    console.log('[parsedPrompt]', out.resolved.slice(0, 300), 'hasErrors=', out.hasErrors)
    return out
  })()
  const missingSkills = missingSkillNames(prompt, skills)

  if (loading) {
    return (
      <button
        type="button"
        className="generate-btn is-cancel"
        onClick={() => void cancelGenerate()}
        title="取消当前生成请求"
      >
        <span className="glyph">×</span>
        <span>取消生成</span>
        <Spinner />
      </button>
    )
  }

  const trimmed = prompt.trim()
  const disabled = trimmed.length === 0 || hasErrors
  const reason = trimmed.length === 0
    ? 'Write a prompt first'
    : missingSkills.length > 0
    ? `Skill 已删除：${missingSkills.join('、')}`
    : hasErrors
    ? 'Resolve the @ mentions first'
    : undefined

  return (
    <button
      type="button"
      className="generate-btn"
      disabled={disabled}
      onClick={() => void runGenerate(resolved)}
      title={reason}
    >
      <span className="glyph">↳</span>
      <span>Generate</span>
    </button>
  )
}

function Spinner() {
  return (
    <div aria-hidden style={{
      width: 12, height: 12,
      border: '1.5px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'gptimg2-spin 800ms linear infinite',
    }} />
  )
}
