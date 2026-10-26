export const currencies={JPY:{symbol:'¥',digits:0},USD:{symbol:'$',digits:2},CNY:{symbol:'¥',digits:2},TWD:{symbol:'NT$',digits:2}} as const;
export function formatMoney(amount:number,currency='JPY',locale='ja-JP'){
 const definition=currencies[currency as keyof typeof currencies];
 return `${currency} ${definition?.symbol??''}${new Intl.NumberFormat(locale,{minimumFractionDigits:definition?.digits??2,maximumFractionDigits:Math.max(definition?.digits??2,Number.isInteger(amount)?0:2)}).format(amount)}`;
}
