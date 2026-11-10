/** In-memory implementation of the same exclusive lock contract, only for component/unit tests. */
export function installCartLocks(){
 let tail:Promise<unknown>=Promise.resolve();
 Object.defineProperty(navigator,'locks',{configurable:true,value:{request<T>(_name:string,callback:()=>T|Promise<T>){const next=tail.then(callback);tail=next.then(()=>undefined,()=>undefined);return next;}}});
}
