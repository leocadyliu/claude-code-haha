/**
 * optimizeMarkdownForFeishu 单元测试
 *
 * 覆盖:
 * - H1~H3 降级 (workaround Feishu tag:'markdown' H1~H3 渲染异常)
 * - 代码块保护（代码块内的 # 不能被降级）
 * - 空行压缩
 * - 边界场景: 无标题不动、全代码块、H4+ 不触发降级、混合内容
 */

import { describe, it, expect } from 'bun:test'
import { optimizeMarkdownForFeishu } from '../markdown-style.js'

describe('optimizeMarkdownForFeishu: 标题降级', () => {
  it('H1 → H4', () => {
    const out = optimizeMarkdownForFeishu('# Title')
    expect(out).toBe('#### Title')
  })

  it('H2 → H5', () => {
    const out = optimizeMarkdownForFeishu('## Title')
    expect(out).toBe('##### Title')
  })

  it('H3 → H5', () => {
    const out = optimizeMarkdownForFeishu('### Title')
    expect(out).toBe('##### Title')
  })

  it('混合 H1+H2+H3 全部降级', () => {
    const input = '# H1\n## H2\n### H3'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe('#### H1\n##### H2\n##### H3')
  })

  it('已存在的 H4 在没有 H1~H3 时原样保留（不触发降级管道）', () => {
    // 触发条件是原文必须有 H1~H3。纯 H4 文档原样返回。
    const input = '#### Already H4'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe('#### Already H4')
  })

  it('H5 在没有 H1~H3 时保留', () => {
    const input = '##### Already H5'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe('##### Already H5')
  })

  it('同时存在 H1 和 H4: H1→H4，原 H4 被规则降级为 H5', () => {
    // H4~H6 也走 #{2,6} → H5 的管道（因为原文有 H1）
    const input = '# Top\n#### Sub'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe('#### Top\n##### Sub')
  })

  it('标题文本前必须有空格才算标题（#xxx 不是标题）', () => {
    const input = '#notaheading'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe('#notaheading')
  })

  it('降级顺序: 不会把 # 先降成 ####，然后再被 #{2,6} 吃成 #####', () => {
    // 这是 openclaw-lark 源码里的关键注释 —— 顺序不能颠倒
    const out = optimizeMarkdownForFeishu('# Top')
    expect(out).toBe('#### Top') // 必须恰好是 4 个 #，不是 5 个
  })

  it('无标题文本原样返回', () => {
    const input = 'just some plain text\nwith a newline'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe(input)
  })
})

describe('optimizeMarkdownForFeishu: 代码块保护', () => {
  it('代码块内的 # 不会被降级', () => {
    const input = '```\n# not a heading\n## also not\n```'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe(input)
  })

  it('有外部标题时，代码块内的 # 仍受保护', () => {
    const input = '# Real heading\n\n```\n# inside code\n```'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe('#### Real heading\n\n```\n# inside code\n```')
  })

  it('语言标记的 fenced 代码块也受保护', () => {
    const input = '## Section\n\n```python\n# python comment\n### not a heading\n```'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe('##### Section\n\n```python\n# python comment\n### not a heading\n```')
  })

  it('多个代码块按顺序保护与还原', () => {
    const input = '# A\n```\n# b1\n```\n## C\n```\n### b2\n```'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe('#### A\n```\n# b1\n```\n##### C\n```\n### b2\n```')
  })

  it('全文只有代码块时原样返回', () => {
    const input = '```\n# in code\n## also in code\n```'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe(input)
  })
})

describe('optimizeMarkdownForFeishu: 空行压缩', () => {
  it('3 个换行 → 2 个', () => {
    const input = 'line1\n\n\nline2'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe('line1\n\nline2')
  })

  it('5 个换行 → 2 个', () => {
    const input = 'line1\n\n\n\n\nline2'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe('line1\n\nline2')
  })

  it('2 个换行保留', () => {
    const input = 'line1\n\nline2'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe('line1\n\nline2')
  })

  it('空行压缩不影响代码块内的连续换行', () => {
    // 代码块内的换行应当完全保留
    const input = '# Title\n\n```\nline1\n\n\nline2\n```'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).toBe('#### Title\n\n```\nline1\n\n\nline2\n```')
  })
})

describe('optimizeMarkdownForFeishu: 真实场景', () => {
  it('复现 screenshot 里的项目结构报告场景', () => {
    // 用户 screenshot 里的真实 markdown 片段
    const input = `## OpenCutSkill 项目架构概览

### 1. 项目定位

Screen Studio 视频自动剪辑工具。

### 2. 模块结构

\`\`\`
opencutskill/
├── cli/
├── core/
└── tests/
\`\`\``

    const out = optimizeMarkdownForFeishu(input)

    // 所有 H2~H3 应该被降级为 H5
    expect(out).toContain('##### OpenCutSkill 项目架构概览')
    expect(out).toContain('##### 1. 项目定位')
    expect(out).toContain('##### 2. 模块结构')
    // 代码块内容原封不动
    expect(out).toContain('opencutskill/')
    expect(out).toContain('├── cli/')
    // 代码块围栏也原样
    expect(out).toContain('```\nopencutskill/')
    // 原始的 ## 字面量不应残留
    expect(out).not.toMatch(/^## OpenCutSkill/m)
    expect(out).not.toMatch(/^### 1\./m)
  })

  it('错误输入 fallback 到原文不抛错', () => {
    // 即使输入是奇怪的字符串也不应抛错
    const weird = '\u0000\uFFFF```unclosed'
    expect(() => optimizeMarkdownForFeishu(weird)).not.toThrow()
  })

  it('空字符串返回空字符串', () => {
    expect(optimizeMarkdownForFeishu('')).toBe('')
  })
})

describe('optimizeMarkdownForFeishu: cardVersion 参数', () => {
  it('cardVersion=1 (默认) 不加段落间距 <br>', () => {
    const input = '# A\n## B'
    const out = optimizeMarkdownForFeishu(input)
    expect(out).not.toContain('<br>')
  })

  it('cardVersion=2 在连续降级标题之间加 <br>', () => {
    const input = '# A\n# B'
    const out = optimizeMarkdownForFeishu(input, 2)
    // 两个 H1 都降级为 H4，之间插入 <br>
    expect(out).toContain('#### A\n<br>\n#### B')
  })
})
