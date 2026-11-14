import { onScopeDispose } from 'vue'
import { isNavigationFailure, NavigationFailureType, useRouter } from 'vue-router'

/** 引用导航完成后通知当前视图；重复 hash 也属于一次明确的重新定位操作。 */
export function useChatQuoteNavigation(callback: (id: string, duplicated: boolean) => void) {
  const router = useRouter()
  const stop = router.afterEach((to, _from, failure) => {
    const duplicated = isNavigationFailure(failure, NavigationFailureType.duplicated)
    if (failure && !duplicated) return
    const match = to.path === '/cr' && /^#chatroom(\d{1,32})$/.exec(to.hash)
    if (match) callback(match[1]!, duplicated)
  })
  onScopeDispose(stop)
}
