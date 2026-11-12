/** Stable saved brand names; aliases adapt existing values for display only. */
export const socialPlatformGroups:readonly {key:'china'|'international';options:readonly {value:string;label:string;aliases:readonly string[]}[]}[] = [
  {key:'china',options:[
    {value:'微信',label:'微信 / WeChat',aliases:['WeChat','Weixin']},
    {value:'QQ',label:'QQ',aliases:[]},
    {value:'小红书',label:'小红书 / REDnote',aliases:['Xiaohongshu','REDnote']},
    {value:'微博',label:'微博 / Weibo',aliases:['Weibo','Sina Weibo']},
    {value:'抖音',label:'抖音 / Douyin',aliases:['Douyin']},
    {value:'快手',label:'快手 / Kuaishou',aliases:['Kuaishou']},
    {value:'哔哩哔哩',label:'哔哩哔哩 / Bilibili',aliases:['Bilibili','B站']},
    {value:'豆瓣',label:'豆瓣 / Douban',aliases:['Douban']},
  ]},
  {key:'international',options:[
    ...['LINE','WhatsApp','Telegram','Instagram','Facebook','Messenger','TikTok'].map(value=>({value,label:value,aliases:[]})),
    {value:'X',label:'X (Twitter)',aliases:['Twitter']},
    ...['Threads','YouTube','Discord','Reddit','LinkedIn','Snapchat','Pinterest','Signal','KakaoTalk','Zalo','Viber'].map(value=>({value,label:value,aliases:[]})),
  ]},
];

export function socialPlatformValue(value?:string):string|undefined {
  const name=value?.trim().toLowerCase();
  return socialPlatformGroups.flatMap(group=>group.options).find(option=>[option.value,...option.aliases].some(alias=>alias.toLowerCase()===name))?.value;
}
