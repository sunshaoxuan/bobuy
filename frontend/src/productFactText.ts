import translations from './locales/product-facts.json';

const facts:Readonly<Record<string,Readonly<Record<string,string>>>>=translations;

/** Exact reviewed source literals only. Never infer pack sizes or rewrite model codes. */
export function productFactText(value:string|null|undefined,locale:string):string{
 if(!value)return '';
 return Object.prototype.hasOwnProperty.call(facts,value)?facts[value][locale]||value:value;
}
