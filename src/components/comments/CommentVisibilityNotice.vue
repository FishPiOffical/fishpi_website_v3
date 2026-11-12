<template>
  <div class="comment-visibility-notice" role="note" aria-label="系统提示：评论正文当前不可见">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </svg>
    <span class="comment-visibility-notice__label">系统提示</span>
    <span>评论正文当前不可见</span>
  </div>
</template>

<style scoped>
.comment-visibility-notice {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0;
  padding: 8px 10px;
  border: 1px dashed var(--fp-border);
  border-radius: 6px;
  background: color-mix(in srgb, var(--fp-muted) 5%, transparent);
  color: var(--fp-muted);
  font-size: 12px;
  line-height: 1.6;
}
.comment-visibility-notice svg { flex: none; }
.comment-visibility-notice__label { font-weight: 600; }
</style>
