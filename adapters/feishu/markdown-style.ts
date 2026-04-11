/**
 * Feishu 卡片 Markdown 样式优化
 *
 * 背景: 飞书卡片的 `tag: 'markdown'` 元素对 H1~H3 标题有已知渲染异常
 * （字面量显示 `#`/`##`/`###`）。必须降级为 H4/H5 才能正常渲染。
 *
 * 实现参考: openclaw-lark/src/card/markdown-style.ts
 *
 * 本文件只做「保证能渲染」的最小预处理，不加 Schema 2.0 专属的
 * <br> 间距美化（cardVersion 参数预留以便将来升级）。
 */

/**
 * 对将要放入 `tag: 'markdown'` 元素的内容做安全预处理。
 *
 * - 标题降级: 若原文包含 H1~H3，则 H2~H6 → H5，H1 → H4
 * - 代码块内容受保护，不会被降级
 * - 连续 3+ 空行压缩为 2
 * - 任何内部错误都 fallback 到原文，不阻塞消息发送
 *
 * @param text 原始 markdown
 * @param cardVersion 卡片 schema 版本，当前只影响是否加段落间距 <br>
 */
export function optimizeMarkdownForFeishu(text: string, cardVersion = 1): string {
  try {
    return _optimizeMarkdownForFeishu(text, cardVersion)
  } catch {
    return text
  }
}

function _optimizeMarkdownForFeishu(text: string, cardVersion: number): string {
  // ── 1. 提取代码块，用占位符保护，处理后再还原 ─────────────────────
  // 这样代码块内部的 `#` 不会被标题降级误伤
  const MARK = '___CB_'
  const codeBlocks: string[] = []
  let r = text.replace(/```[\s\S]*?```/g, (m) => {
    return `${MARK}${codeBlocks.push(m) - 1}___`
  })

  // ── 2. 标题降级 ────────────────────────────────────────────────────
  // 只有当原文档（不是保护后的 r）包含 H1~H3 时才执行降级
  // 顺序: 先 H2~H6 → H5，再 H1 → H4
  // 若先 H1→H4，####会被后面的 #{2,6} 再次匹配成 H5（变 ##### Title 两次）
  const hasH1toH3 = /^#{1,3} /m.test(text)
  if (hasH1toH3) {
    r = r.replace(/^#{2,6} (.+)$/gm, '##### $1') // H2~H6 → H5
    r = r.replace(/^# (.+)$/gm, '#### $1') // H1 → H4
  }

  // ── 3. Schema 2.0 下可额外加段落间距 ────────────────────────────────
  // 当前飞书 adapter 走 Schema 1.0 / buildStreamingCard，这一块不启用
  if (cardVersion >= 2) {
    // 连续标题之间补 <br>
    r = r.replace(/^(#{4,5} .+)\n{1,2}(#{4,5} )/gm, '$1\n<br>\n$2')
  }

  // ── 4. 压缩多余空行（3 个以上连续换行 → 2 个）────────────────────
  // 注意: 必须在还原代码块之前做，否则代码块内部的连续换行会被误伤。
  // 此时代码块被占位符 `___CB_N___`（单行 token）替代，压缩只影响
  // 真正的 markdown 段落间距。
  r = r.replace(/\n{3,}/g, '\n\n')

  // ── 5. 还原代码块 ─────────────────────────────────────────────────
  // Schema 1.0 路径不在代码块前后加 <br>（维持现状，最小变更）
  codeBlocks.forEach((block, i) => {
    r = r.replace(`${MARK}${i}___`, block)
  })

  return r
}
