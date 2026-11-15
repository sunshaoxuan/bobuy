import {scopedPath} from './storeNavigation';
export function hiddenTripDestination(search:string):string { return scopedPath('/products',search); }
