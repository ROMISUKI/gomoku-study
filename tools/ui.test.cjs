'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),a=require('node:assert/strict');
const puppeteer=require('X:/OpenCodeTools/temp/ms-test/node_modules/puppeteer-core');
const G=require('../web/core.js'),C=require('../web/content.js'),P=require('../web/puzzles.js'),S=require('../web/storage.js');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'qa');fs.mkdirSync(qa,{recursive:true});
const htmlPath=process.argv[2]?path.resolve(process.argv[2]):path.join(qa,'app.html');
if(!process.argv[2])require('./build-html.cjs')(path.join(root,'web'),htmlPath);
const html=fs.readFileSync(htmlPath),report={htmlSha256:crypto.createHash('sha256').update(html).digest('hex'),checks:[],errors:[],screenshots:[]};
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');if(req.url==='/favicon.ico'){res.writeHead(204);res.end();}else res.end(html);});
let browser,page,origin;
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
async function route(r){await page.goto(origin+'/#'+r,{waitUntil:'load'});await page.waitForSelector('#page-title');}
async function targetCenter(selector){
 await page.waitForSelector(selector);await page.$eval(selector,el=>el.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
 return page.$eval(selector,el=>{const b=el.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2;if(!el.contains(document.elementFromPoint(x,y)))throw Error('Target is obscured: '+el.outerHTML.slice(0,180));return{x,y};});
}
async function click(selector){const p=await targetCenter(selector);await page.mouse.click(p.x,p.y);}
async function saved(){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)),S.KEY);}
async function tapPoint(p){const q=await targetCenter(`[data-point="${p}"]`);await page.touchscreen.tap(q.x,q.y);}
async function play(p){await tapPoint(p);await click('[data-act="commit"]');}
async function board(){return page.$$eval('[data-point]',els=>els.map(e=>/黑子/.test(e.ariaLabel)?1:/白子/.test(e.ariaLabel)?2:0));}
async function shot(name){const file=path.join(qa,name+'.png');await page.screenshot({path:file,fullPage:true});report.screenshots.push(file);}
async function text(){return page.$eval('#main',el=>el.innerText);}
function contrast(c1,c2){function lum(c){const v=c.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];}const l=[lum(c1),lum(c2)].sort((a,b)=>b-a);return(l[0]+.05)/(l[1]+.05);}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 page=await browser.newPage();await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))report.errors.push('External request: '+r.url());});
 await check('system course is the default screen, shows six stages and continues in path order',async()=>{
  await page.goto(origin+'/',{waitUntil:'load'});await page.waitForSelector('#page-title');
  a.equal(await page.evaluate(()=>location.hash),'');
  a.match(await text(),/系统课 · 六阶段/);a.equal((await page.$$('.stage-card')).length,6);
  a.match(await page.$eval('.course-progress',el=>el.innerText),/0 \/ \d+ 课已完成/);
  await click('[data-act="continue-course"]');await page.waitForFunction(()=>location.hash==='#lesson/rules-board');await page.waitForFunction(()=>document.querySelector('#page-title')?.textContent.includes('第一手'));
  a.equal(await page.evaluate(()=>window.appHandleBack()),true);await page.waitForFunction(()=>location.hash==='#course');a.match(await text(),/从看清，到算清/);
 });
 await check('phone touch selects and confirms a real legal winning move',async()=>{
  await route('lesson/rules-board');await shot('light-390');await tapPoint(G.point('I8'));
  a.equal((await board())[G.point('I8')],0,'selection must not place immediately');await click('[data-act="commit"]');
  a.equal((await board())[G.point('I8')],1);a.ok((await saved()).completed.includes('rules-board'));
 });
 await check('note persistence and untrusted text stay plain after reload',async()=>{
  await page.$eval('#lesson-note',el=>{el.value='<img src=x onerror="window.injected=true"> 我漏看了斜线';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.reload({waitUntil:'load'});a.match(await page.$eval('#lesson-note',el=>el.value),/漏看/);a.equal(await page.evaluate(()=>window.injected),undefined);
 });
 await check('all lesson quizzes, move exercises and back/forward navigation work',async()=>{
  for(const l of C.lessons){
   if(l.special)continue;await route('lesson/'+l.id);
   if(l.quiz){await click(`[data-act="quiz"][data-choice="${l.quiz.correct}"]`);a.match(await text(),/理解正确/);}
   else if(l.exercise){
    const b=G.make(l.board.black,l.board.white),s=l.exercise;
    const p=Array.from({length:225},(_,p)=>p).find(p=>{if(b[p])return false;const z=b.slice();z[p]=s.c;return s.goal==='win'?G.winsAt(z,p,s.c):s.goal==='openfour'?G.fours(z,p,s.c).some(f=>f.ends.length>=2):!G.winningMoves(z,3-s.c).length;});
    await play(p);a.match(await text(),/正确/);
   }
   a.ok((await saved()).completed.includes(l.id),l.id);
  }
  await route('lesson/rules-board');await click('[data-act="lesson-next"]');await page.waitForFunction(()=>location.hash.includes('rules-variants'));a.match(await text(),/先约定规则/);
 });
 await check('classic opening: both swap choices, equivalent fifth rejection and only one retained fifth',async()=>{
  for(const swap of [true,false]){
   await route('lesson/opening-procedure');if(!swap)await click('[data-act="procedure-reset"]');await click('[data-act="procedure-next"]');await click(`[data-act="swap-${swap?'yes':'no'}"]`);
   a.match(await text(),new RegExp((swap?'甲':'乙')+'执白，请下第4手'));
   await play(G.point('I8'));await play(G.point('J9'));await play(G.point('I10'));
   a.match(await text(),/等价/);a.match(await text(),/已提供 1 \/ 2/);
   await play(G.point('J7'));await click('[data-act="choose-fifth"][data-proposal="1"]');
   a.equal((await board()).filter(Boolean).length,5);a.equal((await board())[G.point('J9')],0);
   await play(G.point('O1'));a.equal((await board()).filter(Boolean).length,6);a.match(await text(),/接下来轮黑7/);
  }
 });
 await check('26 openings and every annotated short branch replay actual board states',async()=>{
  for(const o of C.openings){
   await route('openings/'+o.id);a.deepEqual(await board(),G.fromMoves(o.moves));
   for(let i=0;i<o.branches.length;i++){
    await page.select('#branch-select',String(i));const moves=o.moves.slice();
    for(const move of o.branches[i].moves){await click('[data-act="branch-next"]');moves.push(move);a.deepEqual(await board(),G.fromMoves(moves),o.name);}
   }
  }
  await route('openings/I7');await page.select('#branch-select','0');await click('[data-act="branch-next"]');await shot('opening-390');
 });
 await check('wrong answer and hints are recorded honestly, bookmarks survive reload',async()=>{
  const p=P[0];await route('practice/'+p.id);await play(G.point('A15'));
  let r=(await saved()).results[p.id];a.equal(r.errors,1);a.equal(r.review,true);a.equal(r.solved,false);
  await click('[data-act="hint"]');await play(p.solutions[0].p);r=(await saved()).results[p.id];a.equal(r.assisted,true);a.equal(r.review,true);
  await click('[data-act="star"]');await page.reload({waitUntil:'load'});a.equal((await saved()).results[p.id].star,true);
 });
 await check('every exercise accepts a certified solution and replays through the real final win',async()=>{
  for(const p of P){
   await route('practice/'+p.id);const sol=p.solutions.at(-1);await play(sol.p);const record=(await saved()).results[p.id];a.equal(record.solved,true,p.id);a.equal(record.assisted,false,p.id);a.equal(record.review,false,p.id);
   a.deepEqual(await board(),(()=>{const b=p.board.slice();b[sol.p]=p.c;return b;})());
   for(let k=1;k<sol.line.length;k++)await click('[data-act="route-next"]');
   const final=p.board.slice();for(const[q,c]of sol.line)final[q]=c;a.deepEqual(await board(),final,p.id+' final replay');
  }
  await route('practice/gong-0');await click('[data-act="reveal"]');await shot('gong-390');a.equal((await saved()).results['gong-0'].assisted,false,'viewing a solution later must not rewrite old completion');
 });
 await check('empty filters show a real empty state, not an unrelated old exercise',async()=>{
  await click('[data-act="filter"][data-filter="new"]');a.match(await text(),/暂无符合条件的题目/);a.equal((await page.$$('[data-point]')).length,0);await click('[data-act="reset-filters"]');a.equal((await page.$$('[data-point]')).length,225);
 });
 await check('sandbox placement, erase, undo/redo, rotate, empty-board cancellation and persistence',async()=>{
  await route('sandbox');await play(G.point('A15'));await play(G.point('O1'));a.equal((await saved()).sandbox.moves.length,2);
  await click('[data-act="undo"]');a.equal((await saved()).sandbox.moves.length,1);await click('[data-act="redo"]');a.equal((await saved()).sandbox.moves.length,2);
  await click('[data-act="rotate"]');a.equal((await saved()).sandbox.moves[0][0],G.transformPoint(G.point('A15'),1));
  await click('[data-act="sandbox-mode"][data-mode="erase"]');await play(G.transformPoint(G.point('A15'),1));a.equal((await saved()).sandbox.moves.length,1);
  await click('[data-act="clear-board"]');await click('[data-act="close-modal"]');a.equal((await saved()).sandbox.moves.length,1);
  await click('[data-act="clear-board"]');await click('[data-act="confirm-action"]');a.equal((await saved()).sandbox.moves.length,0);await click('[data-act="undo"]');a.equal((await saved()).sandbox.moves.length,1);
  await page.reload({waitUntil:'load'});a.equal((await board()).filter(Boolean).length,1);
 });
 await check('sandbox inspects actual renju forbidden point without placing it',async()=>{
  await route('lesson/rules-forbidden');await click('[data-act="send-board"]');await click('[data-act="confirm-action"]');await page.waitForFunction(()=>location.hash==='#sandbox');
  await tapPoint(G.point('H8'));await click('[data-act="inspect-black"]');a.match(await text(),/三三禁手/);a.equal((await board())[G.point('H8')],0);
 });
 await check('keyboard and coordinate entry hit the same exact intersections',async()=>{
  await route('sandbox');await page.focus('[data-point="112"]');await page.keyboard.press('ArrowRight');a.equal(await page.$eval('[aria-selected="true"]',el=>el.dataset.point),'113');
  await click('[data-act="cancel-point"]');await click('.coordinate-entry-wrap summary');await click('#coordinate');await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.type('O15');await click('[data-act="coordinate"]');a.equal(await page.$eval('[aria-selected="true"]',el=>el.dataset.point),'14');
 });
 await check('real JSON export download, validated import and pre-import recovery work',async()=>{
  const download=path.join(qa,'downloads');fs.mkdirSync(download,{recursive:true});const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:download,eventsEnabled:true});
  await click('[data-act="menu"]');const before=await saved();const completion=new Promise(resolve=>{cdp.on('Browser.downloadProgress',e=>{if(e.state==='completed')resolve();});});await click('[data-act="export"]');await Promise.race([completion,new Promise((_,reject)=>setTimeout(()=>reject(Error('download timed out')),15000))]);
  const exported=fs.readdirSync(download).filter(f=>f.endsWith('.json')).map(f=>path.join(download,f)).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0];a.deepEqual(JSON.parse(fs.readFileSync(exported,'utf8')),before);
  const wrong=path.join(qa,'bad-import.json');fs.writeFileSync(wrong,'{"schema":999}');await (await page.$('#backup-file')).uploadFile(wrong);await page.waitForFunction(()=>document.querySelector('#modal-title').textContent==='备份无法导入');a.deepEqual(await saved(),before);
  await click('[data-act="close-modal"]');await click('[data-act="menu"]');const changed=JSON.parse(JSON.stringify(before));changed.theme='dark';const fixture=path.join(qa,'valid-import.json');fs.writeFileSync(fixture,JSON.stringify(changed));await (await page.$('#backup-file')).uploadFile(fixture);await page.waitForFunction(()=>document.querySelector('#modal-title').textContent==='导入并替换当前记录？');await click('[data-act="confirm-action"]');a.equal((await saved()).theme,'dark');a.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),S.RECOVERY),before);
  await click('[data-act="menu"]');await click('[data-act="recover"]');await click('[data-act="confirm-action"]');a.deepEqual(await saved(),before);
 });
 await check('damaged stored JSON is not overwritten by normal interaction',async()=>{
  const before=await page.evaluate(k=>localStorage.getItem(k),S.KEY);await page.evaluate(k=>localStorage.setItem(k,'{broken'),S.KEY);await page.reload({waitUntil:'load'});a.match(await page.$eval('#storage-warning',el=>el.textContent),/保留原文/);
  await route('lesson/rules-variants');await click('[data-act="quiz"][data-choice="1"]');a.equal(await page.evaluate(k=>localStorage.getItem(k),S.KEY),'{broken');
  await page.evaluate((k,v)=>localStorage.setItem(k,v),S.KEY,before);await page.reload({waitUntil:'load'});
 });
 await check('touch targets align with drawn intersections at all corners and after board zoom',async()=>{
  await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});await route('sandbox');
  for(const zoom of [false,true]){
   if(zoom)await click('[data-act="zoom"]');
   for(const p of [0,14,210,224,112]){
    const q=await targetCenter(`[data-point="${p}"]`);
    const drawn=await page.$eval('.board-svg',(svg,p)=>{const pt=svg.createSVGPoint();pt.x=30+p%15*30;pt.y=30+Math.floor(p/15)*30;const v=pt.matrixTransform(svg.getScreenCTM());return{x:v.x,y:v.y};},p);
    a.ok(Math.abs(q.x-drawn.x)<1&&Math.abs(q.y-drawn.y)<1,'draw/input disagreement');
    await page.touchscreen.tap(q.x,q.y);a.equal(await page.$eval('[aria-selected="true"]',el=>Number(el.dataset.point)),p);
   }
  }
 });
 await check('responsive layouts, larger text, reduced motion, themes and measured text contrast',async()=>{
  for(const theme of ['light','dark']){
   await click('[data-act="menu"]');await click(`[data-act="theme"][data-theme="${theme}"]`);await click('[data-act="close-modal"]');
   const colors=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement),e=document.createElement('span');document.body.append(e);const out={};for(const key of ['bg','card','fg','muted']){e.style.color=s.getPropertyValue('--'+key);out[key]=getComputedStyle(e).color;}e.remove();return out;});
   a.ok(contrast(colors.fg,colors.bg)>=4.5);a.ok(contrast(colors.muted,colors.card)>=4.5);
    for(const [width,height]of [[320,740],[390,844],[844,390],[768,1024],[1280,900]]){
     await page.setViewport({width,height,deviceScaleFactor:1,isMobile:true,hasTouch:true});
     for(const r of ['lesson/rules-forbidden','openings/D4','practice/gong-0','sandbox']){
      await route(r);a.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),theme+' '+width+' '+r+' overflow');
     }
   }
  }
  await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await click('[data-act="menu"]');await click('#large-text');await click('[data-act="close-modal"]');await route('lesson/shape-gong');a.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('dark-large-390');
  await click('[data-act="menu"]');await click('[data-act="about"]');a.match(await page.$eval('#modal',el=>el.innerText),/制作 \/ 署名：段小段/);a.match(await page.$eval('#modal',el=>el.innerText),/1\.1\.0/);await shot('about-dark');
 });
 a.deepEqual(report.errors,[],'browser errors');report.ok=true;
})().catch(e=>{report.ok=false;report.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{
 if(page&&!report.ok)try{await shot('failure');}catch{}
 fs.writeFileSync(path.join(qa,'ui-report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();server.close();
});
