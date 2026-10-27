export type TagContext={value:string;start:number;end:number;prefix:string;selectionStart:number;selectionEnd:number}
const separator=/[,，、;；]/u
/** Existing article tag separators; replacement never rewrites unrelated tags or spacing. */
export function tagContext(value:string,selectionStart:number,selectionEnd=selectionStart):TagContext|null{
 if(!Number.isInteger(selectionStart)||!Number.isInteger(selectionEnd)||selectionStart<0||selectionEnd<selectionStart||selectionEnd>value.length||separator.test(value.slice(selectionStart,selectionEnd)))return null
 let left=selectionStart,right=selectionEnd
 while(left>0&&!separator.test(value[left-1]!))left--
 while(right<value.length&&!separator.test(value[right]!))right++
 const piece=value.slice(left,right),leading=piece.match(/^\s*/u)![0].length,trailing=piece.match(/\s*$/u)![0].length
 const start=left+leading,end=Math.max(start,right-trailing)
 return{value,start,end,prefix:value.slice(left,selectionStart).trim(),selectionStart,selectionEnd}
}
export function replaceTag(context:TagContext,title:string){
 return{value:context.value.slice(0,context.start)+title+context.value.slice(context.end),caret:context.start+title.length}
}
