import {describe,it,expect} from 'vitest';
import {gridColumns,missingRange,rowOffsets,visibleRows} from './catalogWindow';
describe('viewport rows',()=>{
 it('uses actual CSS tracks, with a mobile fallback only before layout is measurable',()=>{expect(gridColumns('180px 180px 180px 180px 180px 180px',1160,false)).toBe(6);expect(gridColumns('',360,true)).toBe(2);expect(gridColumns('',1920,false)).toBe(8);});
 it('retains measured row extent and exact partial last rows',()=>{expect(rowOffsets(7,2,300,20,{1:340})).toEqual([0,320,680,1000,1300]);expect(rowOffsets(0,2,300,20,{})).toEqual([0]);});
 it('finds visible rows and two rows of buffer without mounting a whole category',()=>{const offsets=rowOffsets(100,2,100,0,{});expect(visibleRows(offsets,500,700)).toEqual({first:3,last:9});expect(visibleRows(offsets,-400,-100)).toEqual({first:0,last:2});expect(visibleRows(offsets,-600,-300)).toEqual({first:0,last:0});expect(visibleRows([0,372,744,1116,1488],0,371)).toEqual({first:0,last:3});expect(visibleRows(offsets,5300,5400)).toEqual({first:0,last:0});});
 it('requests only missing positions at a fast-scroll destination and caps each range',()=>{const items=new Map([[0,'a'],[1,'b'],[20,'c']]);expect(missingRange(items,18,25)).toEqual({offset:18,limit:2});expect(missingRange(items,0,2)).toBeUndefined();expect(missingRange(items,100,200)).toEqual({offset:100,limit:48});});
});
