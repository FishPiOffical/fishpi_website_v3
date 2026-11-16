<script setup lang="ts">
defineProps<{
  title: string
  count?: string
}>()
</script>

<template>
  <header class="list-heading">
    <div class="heading-row">
      <div class="heading-main">
        <h1 class="fp-page-title">{{ title }}</h1>
        <slot />
      </div>
      <nav v-if="$slots.sort" class="heading-sort fp-tabs" aria-label="帖子排序">
        <slot name="sort" />
      </nav>
      <span v-if="count" class="heading-count">{{ count }}</span>
    </div>
  </header>
</template>

<style scoped>
.list-heading {
  container: list-heading / inline-size;
  border-bottom: 1px solid var(--fp-border);
}

.heading-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-height: 54px;
  padding: 10px var(--fp-panel-padding);
}

.heading-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  min-width: 0;
}

.heading-row .fp-page-title {
  margin: 0;
  font-size: 1.3125rem;
  font-weight: 700;
  line-height: 1.3;
}

.heading-sort {
  --fp-tab-height: 28px;
  --fp-tab-inline: 8px;
  gap: 2px;
  margin-inline-start: auto;
  padding: 3px;
  border-radius: 8px;
  background: var(--fp-hover);
}

.heading-count {
  margin-inline-start: auto;
  color: var(--fp-muted);
  font-size: .75rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.heading-sort + .heading-count {
  margin-inline-start: 0;
}

@container list-heading (max-width: 28rem) {
  .heading-sort {
    order: 1;
    width: 100%;
    margin-inline-start: 0;
  }

  .heading-sort + .heading-count {
    margin-inline-start: auto;
  }
}

</style>
