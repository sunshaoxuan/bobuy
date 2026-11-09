import type {ReactNode} from 'react';

/** Ordinary text remains text. Only explicit credential-free HTTP(S) URLs become anchors. */
export function safeArticleParts(text:string):ReactNode[]{
 const parts:ReactNode[]=[];const pattern=/https?:\/\/[^\s<>"'`，。；！？、）》」』】]+/gi;let cursor=0,match:RegExpExecArray|null;
 while((match=pattern.exec(text))){
  let url=match[0];while(/[.,;!?]$/.test(url))url=url.slice(0,-1);
  while(url.endsWith(')')&&(url.match(/\)/g)?.length??0)>(url.match(/\(/g)?.length??0))url=url.slice(0,-1);
  parts.push(text.slice(cursor,match.index));let valid=false;
  try{const parsed=new URL(url);valid=!!parsed.hostname&&['http:','https:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password;}catch{}
  parts.push(valid?<a key={match.index} href={url} title={url} target="_blank" rel="noopener noreferrer">{url}</a>:url);parts.push(match[0].slice(url.length));cursor=match.index+match[0].length;
 }
 parts.push(text.slice(cursor));return parts;
}
export default function SafeArticleText({text}:{text:string}){return <>{safeArticleParts(text)}</>;}
