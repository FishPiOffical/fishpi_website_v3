import { computed, type MaybeRefOrGetter, toValue, watchEffect } from 'vue'
import { useHead, useSeoMeta } from '@unhead/vue'
import { absoluteUrl, pageTitle, SITE_DEFAULT_DESC, SITE_NAME } from '@/seo/site'

export interface PageSeoInput {
  title?: string
  description?: string
  path?: string
  image?: string
  type?: 'website' | 'article' | 'profile'
  robots?: string
  jsonLd?: Record<string, unknown> | Record<string, unknown>[] | null
}

export function usePageSeo(input: MaybeRefOrGetter<PageSeoInput>) {
  const resolved = computed(() => toValue(input))

  useSeoMeta({
    title: () => pageTitle(resolved.value.title),
    description: () => resolved.value.description || SITE_DEFAULT_DESC,
    ogTitle: () => pageTitle(resolved.value.title),
    ogDescription: () => resolved.value.description || SITE_DEFAULT_DESC,
    ogType: () => resolved.value.type || 'website',
    ogUrl: () => absoluteUrl(resolved.value.path || '/'),
    ogSiteName: SITE_NAME,
    ogImage: () => resolved.value.image || absoluteUrl('/favicon.svg'),
    twitterCard: 'summary',
    twitterTitle: () => pageTitle(resolved.value.title),
    twitterDescription: () => resolved.value.description || SITE_DEFAULT_DESC,
    twitterImage: () => resolved.value.image || absoluteUrl('/favicon.svg'),
    robots: () => resolved.value.robots || 'index,follow',
  })

  useHead({
    link: () => [
      {
        rel: 'canonical',
        href: absoluteUrl(resolved.value.path || '/'),
      },
    ],
    script: () => {
      const ld = resolved.value.jsonLd
      if (!ld) return []
      return [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(ld),
        },
      ]
    },
  })

  // Keep document title in sync for CSR navigations without SSR.
  watchEffect(() => {
    if (typeof document === 'undefined') return
    document.title = pageTitle(resolved.value.title)
  })
}
