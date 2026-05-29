// 注入到被预览页面的 IIFE 入口（M3 逐步填实）
;(() => {
  // 标记注入成功，供宿主探测
  ;(window as unknown as { __PREVIEW_AGENT__?: boolean }).__PREVIEW_AGENT__ = true
})()
