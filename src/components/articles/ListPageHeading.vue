<script setup lang="ts">
defineProps<{
  title: string
  count?: string
  description?: string
}>()
</script>

<template>
  <header class="list-heading">
    <div class="heading-row">
      <div class="heading-main">
        <h1 class="fp-page-title">{{ title }}</h1>
        <slot />
      </div>
      <nav v-if="$slots.sort" class="heading-sort" aria-label="帖子排序">
        <slot name="sort" />
      </nav>
      <span v-if="count" class="heading-count">{{ count }}</span>
    </div>
    <p v-if="description" class="heading-description">{{ description }}</p>
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
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  max-width: 100%;
  margin-inline-start: auto;
  padding: 3px;
  border-radius: 8px;
  background: var(--fp-hover);
}

.heading-sort :slotted(a) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  min-height: 28px;
  border-radius: 5px;
  color: var(--fp-muted);
  font-size: .8125rem;
  font-weight: 600;
  white-space: nowrap;
}

.heading-sort :slotted(a:hover) {
  color: var(--fp-title);
  text-decoration: none;
}

.heading-sort :slotted(a[aria-current='page']) {
  background: var(--fp-card);
  color: var(--fp-primary-ink, var(--fp-primary));
  box-shadow: var(--fp-card-shadow);
}

.heading-sort :slotted(a:focus-visible) {
  outline-offset: -2px;
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

.heading-description {
  margin: 0;
  padding: 0 var(--fp-panel-padding) 10px;
  color: var(--fp-muted);
  font-size: .75rem;
  line-height: 1.65;
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

@media (pointer: coarse) {
  .heading-sort :slotted(a) {
    min-height: 44px;
  }
}
</style>
