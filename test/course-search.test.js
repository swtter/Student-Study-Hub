import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCoursePassages} from '../lib/course-search.js';

test('retrieval includes late weeks rather than truncating the first weeks',()=>{
  const sources=Array.from({length:12},(_,index)=>({week:String(index+1),title:`Topic ${index+1}`,text:index===11?'stakeholder management':'introductory concepts'}));
  const selected=selectCoursePassages(sources,'stakeholder management',10000);
  assert.equal(selected[0].week,'12');
  assert.equal(new Set(selected.map(item=>item.week)).size,12);
});
test('retrieval respects context budget and keeps source metadata',()=>{
  const selected=selectCoursePassages([{week:'9',title:'Stakeholders',url:'https://example.com/page',text:'stakeholder '.repeat(2000)}],'stakeholder',6000);
  assert.ok(selected.reduce((sum,item)=>sum+item.text.length,0)<=6000);
  assert.equal(selected[0].url,'https://example.com/page');
});
