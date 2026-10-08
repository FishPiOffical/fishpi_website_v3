<script setup lang="ts">
const PARAGRAPHS = [
  [100, 96, 88, 62],
  [100, 92, 45],
  [98, 100, 94, 80, 30],
]
</script>

<template>
  <div class="article-sk" role="status" aria-label="加载中…">
    <article class="sk-card post">
      <span class="sk title" />
      <div class="meta">
        <span class="sk avatar" />
        <span class="sk w-60" />
        <span class="sk w-110" />
        <span class="sk w-50" />
        <span class="sk w-50" />
      </div>
      <div class="tags">
        <span class="sk pill" />
        <span class="sk pill" />
      </div>
      <div class="body">
        <template v-for="(para, i) in PARAGRAPHS" :key="i">
          <span v-if="i === 1" class="sk heading" />
          <div class="para">
            <span v-for="(w, j) in para" :key="j" class="sk line" :style="{ width: `${w}%` }" />
          </div>
        </template>
      </div>
      <div class="actions">
        <span class="sk btn" />
        <span class="sk btn" />
        <span class="sk btn" />
      </div>
    </article>
    <section class="sk-card comments">
      <span class="sk w-80" />
      <div v-for="i in 3" :key="i" class="cmt">
        <span class="sk avatar lg" />
        <div class="cmt-lines">
          <span class="sk w-90" />
          <span class="sk line" :style="{ width: `${50 + i * 12}%` }" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.article-sk {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1060px;
  margin: 0 auto;
}
.sk-card {
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border: 1px solid var(--fp-border);
  border-radius: 8px;
}
.post {
  padding: 24px 28px;
}
.sk {
  display: block;
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--fp-hover) 25%, var(--fp-border) 37%, var(--fp-hover) 63%);
  background-size: 400% 100%;
  animation: sk-shimmer 1.4s ease infinite;
}
.title {
  width: 62%;
  height: 24px;
  border-radius: 6px;
}
.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}
.avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex: none;
}
.avatar.lg {
  width: 36px;
  height: 36px;
  border-radius: 6px;
}
.w-50 {
  width: 50px;
}
.w-60 {
  width: 60px;
}
.w-80 {
  width: 80px;
}
.w-90 {
  width: 90px;
}
.w-110 {
  width: 110px;
}
.tags {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.pill {
  width: 64px;
  height: 20px;
  border-radius: 10px;
}
.body {
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.para {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.line {
  height: 13px;
}
.heading {
  width: 34%;
  height: 18px;
  margin-top: 6px;
}
.actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 32px;
}
.btn {
  width: 72px;
  height: 30px;
  border-radius: 15px;
}
.comments {
  padding: 18px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.cmt {
  display: flex;
  gap: 12px;
}
.cmt-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 2px;
}
@keyframes sk-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}
@media (max-width: 768px) {
  .post,
  .comments {
    padding: 16px;
  }
  .title {
    width: 90%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sk {
    animation: none;
  }
}
</style>
