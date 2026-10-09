import { defineComponent, shallowRef, type Slot } from 'vue'

/**
 * 同一组件内复用一段模板：先渲染 <Define> 记下插槽，再在任意位置用 <Reuse> 渲染。
 * 必须在组件 setup 内调用，保证每个实例各有一份。
 */
export function createReusableTemplate() {
  const render = shallowRef<Slot | undefined>()
  const Define = defineComponent({
    setup(_, { slots }) {
      return () => {
        render.value = slots.default
        return null
      }
    },
  })
  const Reuse = defineComponent({
    inheritAttrs: false,
    setup(_, { attrs }) {
      return () => render.value?.(attrs)
    },
  })
  return [Define, Reuse] as const
}
