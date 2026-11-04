import { AsyncLocalStorage } from 'node:async_hooks'
import { setServerModeReader, defaultApiMode, type ApiMode } from './mode'
export const apiModeContext = new AsyncLocalStorage<ApiMode>()
setServerModeReader(()=>apiModeContext.getStore() || defaultApiMode())
