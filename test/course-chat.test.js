import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {normalizeModule,assignSequentialWeeks,extractWeekNumber,extractReferences,classifyStage,isProgressItem,teachingWeek,WEEK_ONE} from '../lib/study.js';
import {selectCoursePassages} from '../lib/course-search.js';

test('all-week API reads late weeks, returns sources and reuses its index',async()=>{
  let handler, pageReads=0, captured='';
  const script=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/const root=.*;\n/,'const root="/mock";\n');
  const sandbox={path,fs:{existsSync:()=>false},normalizeModule,assignSequentialWeeks,extractWeekNumber,extractReferences,classifyStage,isProgressItem,teachingWeek,WEEK_ONE,selectCoursePassages,URL,AbortController,setTimeout,clearTimeout,console,process:{env:{CANVAS_TOKEN:'fake',AI_API_KEY:'fake'}},http:{createServer(callback){handler=callback;return{listen(){}}}},fetch:async(url,options)=>{
    let data;
    if(url.includes('/modules?'))data=Array.from({length:12},(_,index)=>({id:index+1,name:`Week ${index+1}`,items:[{id:index+1,type:'Page',title:`Lesson ${index+1}`,page_url:`lesson-${index+1}`}]}));
    else if(url.includes('/pages/')){pageReads++;const week=url.match(/lesson-(\d+)/)[1];data={title:`Lesson ${week}`,body:`<p>Week ${week} discusses ${week==='12'?'stakeholder management':'basic concepts'}.</p>`,html_url:`https://canvas.example/lesson-${week}`};}
    else{captured=JSON.parse(options.body).messages[0].content;data={choices:[{message:{content:JSON.stringify({answer:'Stakeholders are discussed in Week 12 (Lesson 12).',diagram:null})}}]};}
    return{ok:true,json:async()=>data,headers:{get:()=>null}};
  }};
  vm.runInNewContext(script,sandbox);
  const request=async()=>{
    let result,status;
    const req={url:'/api/courses/1/chat',method:'POST',headers:{host:'localhost'},on(event,callback){if(event==='data')callback(JSON.stringify({question:'Where is stakeholder management?'}));if(event==='end')callback();}};
    await handler(req,{writeHead(code){status=code},end(value){result=JSON.parse(value)}});
    assert.equal(status,200);return result;
  };
  const result=await request();
  assert.equal(result.coverage.totalWeeks,12);
  assert.equal(result.coverage.readablePages,12);
  assert.ok(result.sources.some(source=>source.week==='12'));
  assert.match(captured,/Week 12.*Lesson 12/);
  await request();assert.equal(pageReads,12);
});
