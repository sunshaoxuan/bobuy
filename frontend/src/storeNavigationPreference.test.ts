import {navigationDevice,navigationStorageKey,readNavigationExpanded,rememberNavigationExpanded} from './storeNavigationPreference';

it('defaults both device classes to collapsed and remembers them independently',()=>{
  const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>void values.set(key,value)};
  expect(navigationDevice(390)).toBe('mobile');
  expect(navigationDevice(1280)).toBe('desktop');
  expect(readNavigationExpanded('mobile',storage)).toBe(false);
  expect(readNavigationExpanded('desktop',storage)).toBe(false);
  rememberNavigationExpanded('desktop',true,storage);
  expect(values.get(navigationStorageKey('desktop'))).toBe('expanded');
  expect(readNavigationExpanded('desktop',storage)).toBe(true);
  expect(readNavigationExpanded('mobile',storage)).toBe(false);
});
