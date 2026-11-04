import {getApiMode} from './mode'
import {userSuggestions} from './v3-user-suggestions'
import {legacyUserSuggestions,type EditorSuggestion} from './legacy/editor'
export function editorUserSuggestions(prefix:string,signal?:AbortSignal):Promise<EditorSuggestion[]>{return getApiMode()==='v1'?legacyUserSuggestions(prefix,signal):userSuggestions(prefix,signal)}
