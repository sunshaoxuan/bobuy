/** Geometry is based on CSS columns and measured row heights, never a fixed card count. */
export function gridColumns(template:string,width:number,mobile:boolean){
 const tracks=template.trim().split(/\s+/).filter(value=>/^\d+(\.\d+)?px$/.test(value));
 return Math.max(1,tracks.length||(mobile?2:Math.floor((width+16)/216))||2);
}
export function rowOffsets(total:number,columns:number,estimate:number,gap:number,heights:Record<number,number>){
 const offsets=[0];for(let row=0;row<Math.ceil(total/columns);row++)offsets.push(offsets[row]+(heights[row]??estimate)+(row===Math.ceil(total/columns)-1?0:gap));return offsets;
}
export function visibleRows(offsets:number[],top:number,bottom:number,buffer=2){
 const count=offsets.length-1;if(!count)return {first:0,last:0};
 if(bottom<=0)return buffer>0&&bottom>-offsets[Math.min(buffer,count)]?{first:0,last:Math.min(buffer,count)}:{first:0,last:0};
 if(top>=offsets[count])return buffer>0&&top-offsets[count]<offsets[count]-offsets[Math.max(0,count-buffer)]?{first:Math.max(0,count-buffer),last:count}:{first:0,last:0};
 let first=0,last=count;while(first<count&&offsets[first+1]<=top)first++;while(last>first&&offsets[last-1]>=bottom)last--;
 return {first:Math.max(0,first-buffer),last:Math.min(count,last+buffer)};
}
export function missingRange<T>(items:Map<number,T>,start:number,end:number,max=48){
 let first=start;while(first<end&&items.has(first))first++;if(first===end)return;
 let last=first+1;while(last<end&&last-first<max&&!items.has(last))last++;return {offset:first,limit:last-first};
}
