import {getApiMode} from './mode'
import {getAccessToken,getAuthContextVersion,onAccessTokenChange} from './http'
import {getLegacyKey,onLegacyKeyChange} from './legacy/auth'
/** Only used to gate editor work. Transport adapters still choose their own protocol credential. */
export function getEditorCredential(){return getApiMode()==='v1'?getLegacyKey():getAccessToken()}
export function getEditorContext(){return getApiMode()==='v1'?JSON.stringify(['v1',getAuthContextVersion(),getLegacyKey()]):JSON.stringify(['v3',getAuthContextVersion()])}
export function onEditorCredentialChange(listener:(credential:string|null)=>void){return getApiMode()==='v1'?onLegacyKeyChange(listener):onAccessTokenChange(listener)}
