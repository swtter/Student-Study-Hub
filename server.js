import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeModule,assignSequentialWeeks,extractWeekNumber,extractReferences,classifyStage,isProgressItem,teachingWeek,WEEK_ONE} from './lib/study.js';

const root=path.dirname(fileURLToPath(import.meta.url));
for(const line of fs.existsSync(path.join(root,'.env'))?fs.readFileSync(path.join(root,'.env'),'utf8').split(/\r?\n/):[]){const i=line.indexOf('=');if(i>0&&!line.startsWith('#'))process.env[line.slice(0,i).trim()]??=line.slice(i+1).trim()}
const PORT=Number(process.env.PORT||3001),canvas=(process.env.CANVAS_BASE_URL||'https://canvas.uts.edu.au').replace(/\/$/,'');
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))};

async function canvasGet(route){
  if(!process.env.CANVAS_TOKEN)throw new Error('Canvas is not configured. Copy .env.example to .env and add CANVAS_TOKEN.');
  const out=[];let url=`${canvas}/api/v1${route}${route.includes('?')?'&':'?'}per_page=100`;
  do{const response=await fetch(url,{headers:{Authorization:`Bearer ${process.env.CANVAS_TOKEN}`}});if(!response.ok)throw new Error(`Canvas ${response.status}: ${await response.text()}`);const data=await response.json();out.push(...(Array.isArray(data)?data:[data]));url=(response.headers.get('link')?.split(',').find(value=>/rel="next"/.test(value))?.match(/<([^>]+)>/)||[])[1]}while(url);
  return out;
}

function providerConfig(){
  const requested=(process.env.AI_PROVIDER||'qwen').toLowerCase(),provider=['qwen','deepseek','gemini'].includes(requested)?requested:'qwen';
  const defaults={qwen:{base:'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',model:'qwen-plus'},deepseek:{base:'https://api.deepseek.com',model:'deepseek-chat'},gemini:{base:'https://generativelanguage.googleapis.com/v1beta/openai',model:'gemini-3.8-flash'}};
  const key=process.env.AI_API_KEY||(provider==='gemini'?process.env.GEMINI_API_KEY:'');
  return{provider,base:(process.env.AI_BASE_URL||defaults[provider].base).replace(/\/$/,''),model:process.env.AI_MODEL||defaults[provider].model,configured:Boolean(key),key};
}
const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
async function askAI(messages){
  const config=providerConfig();if(!config.key)throw new Error(`${config.provider} API key is not configured.`);
  const models=config.provider==='gemini'?[...new Set([config.model,'gemini-3.5-flash-lite'])]:[config.model];let lastStatus=0;
  for(const model of models){
    for(let attempt=0;attempt<2;attempt+=1){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),model===config.model?20000:30000);let response;
      try{response=await fetch(`${config.base}/chat/completions`,{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${config.key}`},body:JSON.stringify({model,messages,temperature:.3}),signal:controller.signal})}
      catch(error){clearTimeout(timer);if(error.name==='AbortError'){lastStatus='timeout';break}throw error}
      clearTimeout(timer);
      if(response.ok){const data=await response.json();return{content:data.choices?.[0]?.message?.content||'',model,fallback:model!==config.model}}
      lastStatus=response.status;
      if(![429,500,502,503,504].includes(response.status))throw new Error(`${config.provider} rejected the request (${response.status}). Check the API key and model name.`);
      if(attempt===0)await wait(900);
    }
  }
  if(config.provider==='gemini'&&lastStatus===503)throw new Error('Gemini is temporarily busy. Study retried and also tried the lighter backup model. Please wait a minute and try again.');
  throw new Error(`${config.provider} is temporarily unavailable (${lastStatus}). Study retried automatically; please try again shortly.`);
}

function htmlToText(html=''){return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<\/(h[1-6]|p|li|tr|section|article|div)>/gi,'\n').replace(/<t[dh]\b[^>]*>/gi,' | ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/[ \t]+/g,' ').replace(/\n\s+/g,'\n').trim()}
function parseOverview(raw){const cleaned=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();try{return JSON.parse(cleaned)}catch{}const match=cleaned.match(/\{[\s\S]*\}/);if(match)try{return JSON.parse(match[0])}catch{}return{overview:cleaned,keyPoints:[],importantTerms:[]}}
function parseTutorResponse(raw){
  const cleaned=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();let value;
  try{value=JSON.parse(cleaned)}catch{const match=cleaned.match(/\{[\s\S]*\}/);if(match)try{value=JSON.parse(match[0])}catch{}}
  if(!value||typeof value.answer!=='string')return{answer:raw,diagram:null};
  const diagram=value.diagram&&Array.isArray(value.diagram.nodes)&&value.diagram.nodes.length>1?{title:String(value.diagram.title||'Concept map').slice(0,120),nodes:value.diagram.nodes.slice(0,6).map((node,index)=>({id:String(node.id||`n${index+1}`),label:String(node.label||'').slice(0,100),detail:String(node.detail||'').slice(0,180)})),edges:Array.isArray(value.diagram.edges)?value.diagram.edges.slice(0,8).map(edge=>({from:String(edge.from||''),to:String(edge.to||''),label:String(edge.label||'').slice(0,80)})):[]}:null;
  return{answer:value.answer,diagram};
}

function fallbackItem(item,courseId,type){
  if(type==='Page')return{id:`page:${item.url}`,type:'Page',title:item.title||item.url,page_url:item.url,html_url:item.html_url,stage:classifyStage(item),trackProgress:isProgressItem({type:'Page',title:item.title})};
  const title=item.display_name||item.filename||`File ${item.id}`;
  return{id:`file:${item.id}`,type:'File',title,html_url:item.url||`${canvas}/courses/${courseId}/files/${item.id}`,stage:classifyStage({title}),trackProgress:isProgressItem({type:'File',title})};
}
async function loadCourseStructure(courseId){
  const raw=await canvasGet(`/courses/${courseId}/modules?include[]=items`),modules=assignSequentialWeeks(raw.map(normalizeModule));
  if(modules.some(module=>module.week!==null))return modules;
  const[pages,files]=await Promise.all([canvasGet(`/courses/${courseId}/pages?sort=title&order=asc`).catch(()=>[]),canvasGet(`/courses/${courseId}/files?sort=display_name&order=asc`).catch(()=>[])]);
  const items=[...pages.filter(page=>page.published!==false).map(page=>fallbackItem(page,courseId,'Page')),...files.filter(file=>file.hidden!==true).map(file=>fallbackItem(file,courseId,'File'))],groups=new Map(),other=[];
  for(const item of items){const week=extractWeekNumber(item.title);if(week===null)other.push(item);else groups.set(week,[...(groups.get(week)||[]),item])}
  if(groups.size){const grouped=[...groups.entries()].sort(([a],[b])=>a-b).map(([week,weekItems])=>({id:`fallback-week-${week}`,name:`Week ${week} materials`,week,inferredWeek:true,items:weekItems}));if(other.length)grouped.push({id:'fallback-other',name:'Other course materials',week:null,items:other});return grouped}
  if(items.length)return[{id:'fallback-materials',name:'Course materials',week:teachingWeek(),inferredWeek:true,items}];
  return modules;
}
async function weekContext(courseId,weekNumber){
  const modules=await loadCourseStructure(courseId),module=modules.find(value=>value.week===weekNumber);if(!module)throw new Error(`Week ${weekNumber} was not found in Canvas.`);
  const sources=await Promise.all(module.items.filter(item=>item.type==='Page'&&item.page_url).slice(0,20).map(async item=>{try{const page=(await canvasGet(`/courses/${courseId}/pages/${encodeURIComponent(item.page_url)}`))[0];return{title:page.title||item.title,text:htmlToText(page.body||'').slice(0,9000),url:page.html_url||item.html_url}}catch{return{title:item.title,text:'',url:item.html_url}}}));
  return{module,sources};
}

function staticFile(req,res){let requested=req.url==='/'?'/index.html':req.url.split('?')[0];const file=path.join(root,'public',path.normalize(requested).replace(/^(\.\.[/\\])+/,''));if(!file.startsWith(path.join(root,'public'))||!fs.existsSync(file))return false;const ext=path.extname(file);res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[ext]||'application/octet-stream')+'; charset=utf-8'});fs.createReadStream(file).pipe(res);return true}

const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,`http://${req.headers.host}`);if(!url.pathname.startsWith('/api/')){if(!staticFile(req,res))json(res,404,{error:'Not found'});return}
  const body=await new Promise((resolve,reject)=>{let value='';req.on('data',chunk=>value+=chunk);req.on('end',()=>{try{resolve(value?JSON.parse(value):{})}catch(error){reject(error)}})});
  if(url.pathname==='/api/config'){const ai=providerConfig();return json(res,200,{weekOne:WEEK_ONE,currentWeek:teachingWeek(),ai:{provider:ai.provider,model:ai.model,configured:ai.configured},canvasConfigured:Boolean(process.env.CANVAS_TOKEN)})}
  if(url.pathname==='/api/courses')return json(res,200,await canvasGet('/courses?enrollment_state=active&include[]=term'));
  let match=url.pathname.match(/^\/api\/courses\/(\d+)\/modules$/);if(match)return json(res,200,await loadCourseStructure(match[1]));
  match=url.pathname.match(/^\/api\/courses\/(\d+)\/weeks\/(\d+)\/overview$/);if(match&&req.method==='POST'){
    const courseId=match[1],weekNumber=Number(match[2]),{module,sources}=await weekContext(courseId,weekNumber),sourceText=sources.filter(source=>source.text).map(source=>`SOURCE: ${source.title}\n${source.text}`).join('\n\n').slice(0,50000);
    if(!sourceText)throw new Error('No readable Canvas page text was found for this week. The material list and source links are still available.');
    const prompt=`Create a concise study overview for a university student using only the Canvas material below. Return valid JSON only with keys: overview (2-4 clear sentences), keyPoints (3-5 short, specific learning takeaways), importantTerms (3-6 terms). Do not invent details.\n\nCOURSE WEEK: ${module.name}\nOTHER CANVAS ITEMS: ${module.items.map(item=>`${item.type}: ${item.title}`).join('\n')}\n\n${sourceText}`;
    const aiResult=await askAI([{role:'system',content:'You are a careful course study assistant. Base every point on the supplied course pages and keep the summary compact.'},{role:'user',content:prompt}]),result=parseOverview(aiResult.content);
    return json(res,200,{...result,sources:sources.map(source=>({title:source.title,url:source.url})),week:weekNumber,module:module.name,aiModel:aiResult.model,aiFallback:aiResult.fallback});
  }
  match=url.pathname.match(/^\/api\/courses\/(\d+)\/weeks\/(\d+)\/chat$/);if(match&&req.method==='POST'){
    const question=String(body.question||'').trim();if(!question)return json(res,400,{error:'Write a question first.'});
    const{module,sources}=await weekContext(match[1],Number(match[2])),context=[`WEEK: ${module.name}`,`CANVAS ITEMS:\n${module.items.map(item=>`${item.type}: ${item.title}`).join('\n')}`,...sources.filter(source=>source.text).map(source=>`CANVAS PAGE: ${source.title}\n${source.text}`)].join('\n\n').slice(0,50000);
    const history=Array.isArray(body.history)?body.history.slice(-8).filter(item=>['user','assistant'].includes(item.role)&&typeof item.content==='string').map(item=>({role:item.role,content:item.content.slice(0,5000)})):[];
    const responseFormat=`Return valid JSON only in this shape: {"answer":"clear Markdown answer","diagram":null}. The answer must use short sections, descriptive headings, bullets where helpful, and one concrete example. Do not use raw HTML. When a process, comparison, hierarchy, or relationship would be clearer visually, replace null with {"title":"short title","nodes":[{"id":"n1","label":"concept","detail":"one-line explanation"}],"edges":[{"from":"n1","to":"n2","label":"relationship"}]}. Keep nodes in a logical reading order, use 2-6 nodes, and do not invent facts.`;
    const aiResult=await askAI([{role:'system',content:`You are a concise university study tutor. Answer only from the supplied Canvas context. If the answer is not in the materials, clearly say so instead of guessing. Explain one idea at a time in plain language. ${responseFormat}\n\n${context}`},...history,{role:'user',content:question}]),ai=providerConfig(),tutor=parseTutorResponse(aiResult.content);
    return json(res,200,{answer:tutor.answer,diagram:tutor.diagram,provider:ai.provider,model:aiResult.model,fallback:aiResult.fallback,sources:sources.map(source=>({title:source.title,url:source.url}))});
  }
  match=url.pathname.match(/^\/api\/courses\/(\d+)\/pages\/(.+)$/);if(match){const page=(await canvasGet(`/courses/${match[1]}/pages/${encodeURIComponent(decodeURIComponent(match[2]))}`))[0];return json(res,200,{...page,references:extractReferences(page.body||'',{courseId:match[1],title:page.title,type:'Canvas Page'})})}
  match=url.pathname.match(/^\/api\/courses\/(\d+)\/assignments$/);if(match)return json(res,200,await canvasGet(`/courses/${match[1]}/assignments?include[]=submission`));
  if(url.pathname==='/api/assessments'&&req.method==='POST'){const sets=await Promise.all((body.courseIds||[]).map(async id=>(await canvasGet(`/courses/${id}/assignments?include[]=submission`)).map(assignment=>({...assignment,course_id:id}))));return json(res,200,sets.flat().sort((a,b)=>new Date(a.due_at||'9999')-new Date(b.due_at||'9999')))}
  json(res,404,{error:'API route not found'});
}catch(error){json(res,500,{error:error.message})}});
server.listen(PORT,()=>console.log(`Study running at http://localhost:${PORT}`));
