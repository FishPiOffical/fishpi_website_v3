import {getApiMode} from './mode'
import * as v3 from './v3-emojis'
import {legacyFrequentEmotions,legacyEmojiGroups,legacyGroupEmojis} from './legacy/editor-emojis'
export const fetchV3FrequentEmotions=()=>getApiMode()==='v1'?legacyFrequentEmotions():v3.fetchV3FrequentEmotions()
export const fetchV3EmojiGroups=(p=1,size=50)=>getApiMode()==='v1'?legacyEmojiGroups(p,size):v3.fetchV3EmojiGroups(p,size)
export const fetchV3GroupEmojis=(id:string,p=1,size=50)=>getApiMode()==='v1'?legacyGroupEmojis(id,p,size):v3.fetchV3GroupEmojis(id,p,size)
