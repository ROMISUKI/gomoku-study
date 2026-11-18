(function(){
  'use strict';
  const G=window.Gomoku,C=window.StudyContent,P=window.StudyPuzzles,S=window.StudyStorage;
  const $=s=>document.querySelector(s),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const catalog={lessons:C.lessons.map(l=>l.id),puzzles:P.map(p=>p.id)};
  const loaded=S.load(localStorage,catalog);let data=loaded.data,storageError=loaded.error;
  const ui={route:null,selected:null,zoom:false,coord:'',message:null,lessonChoice:null,lessonMove:null,openingStage:0,swap:false,fourth:null,proposals:[],chosen:null,sixth:null,branch:-1,step:0,practiceFilter:'all',practiceGroup:'all',practiceEmpty:false,help:false,hint:0,answer:null,undo:[],redo:[],modal:null};
  let toastTimer,confirmAction,focusBeforeModal;
  function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>{$('#toast').hidden=true;},4000);}
  function persist(){
    if(storageError)return false;
    try{S.save(localStorage,data,catalog);return true;}
    catch(e){storageError='保存失败，当前操作尚未落盘。原数据未主动清空：'+e.message;showStorageWarning();toast('保存失败，请先导出备份');return false;}
  }
  function showStorageWarning(){const el=$('#storage-warning');el.hidden=!storageError;el.textContent=storageError||'';}
  function systemDark(){return window.AndroidApp?AndroidApp.isSystemDark():matchMedia('(prefers-color-scheme: dark)').matches;}
  function theme(){const dark=data.theme==='dark'||(data.theme==='system'&&systemDark());document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.classList.toggle('large',data.largeText);if(window.AndroidApp)AndroidApp.setDark(dark);}
  function result(id){return data.results[id]||(data.results[id]={attempts:0,errors:0,solved:false,assisted:false,star:false,review:false});}
  function complete(id){if(!data.completed.includes(id)){data.completed.push(id);persist();}}
  function navigate(route){if(location.hash==='#'+route){readRoute();}else location.hash=route;}
  const orderedLessons=()=>C.systemStages.flatMap(s=>s.lessons);
  function readRoute(){
    const parts=location.hash.slice(1).split('/');let tab=parts[0],id=parts[1];
    if(tab==='course'){tab='course';id=null;}
    else if(tab==='lesson'){if(!catalog.lessons.includes(id))id=data.lastLesson;}
    else if(tab==='openings'){if(!C.openings.some(o=>o.id===id))id='D4';}
    else if(tab==='practice'){if(!catalog.puzzles.includes(id))id=P[0].id;}
    else if(tab!=='sandbox'){tab='course';id=null;}
    const changed=!ui.route||ui.route.tab!==tab||ui.route.id!==id;
    ui.route={tab,id};
    if(changed){ui.selected=null;ui.zoom=false;ui.message=null;ui.lessonChoice=null;ui.lessonMove=null;ui.branch=-1;ui.step=0;ui.openingStage=0;ui.swap=false;ui.proposals=[];ui.fourth=null;ui.chosen=null;ui.sixth=null;ui.help=false;ui.hint=0;ui.answer=null;ui.coord='';ui.inspection=null;ui.practiceEmpty=false;}
    if(tab==='lesson'){data.lastLesson=id;persist();}
    closeModal();render();
    if(changed){window.scrollTo(0,0);$('#page-title')?.focus({preventScroll:true});}
  }
  function heading(kicker,title,subtitle,actions=''){return `<div class="page-heading"><div><div class="eyebrow">${esc(kicker)}</div><h1 id="page-title" tabindex="-1">${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><div class="heading-actions">${actions}</div></div>`;}
  function feedback(){return ui.message?`<div class="feedback ${ui.message.error?'error':''}" role="status">${esc(ui.message.text)}</div>`:'';}
  function message(text,error=false){ui.message={text,error};}
  function boardHTML(b,{numbers=[],marks=[],last=null,interactive=true}={}){
    const nmap=new Map(numbers.map(([p,c],i)=>[p,i+1]));
    let lines='',labels='',stones='',cells='';
    for(let i=0;i<15;i++){
      const x=30+i*30;lines+=`<path class="grid-line" d="M30 ${x}H450M${x} 30V450"/>`;
      labels+=`<text class="coord" x="${x}" y="12">${G.LETTERS[i]}</text><text class="coord" x="12" y="${x}">${15-i}</text><text class="coord" x="${x}" y="471">${G.LETTERS[i]}</text>`;
      let row='';
      for(let j=0;j<15;j++){
        const p=i*15+j,color=b[p]===1?'黑子':b[p]===2?'白子':'空点';
        row+=`<button type="button" role="gridcell" class="hit-cell" data-point="${p}" tabindex="${p===(ui.selected??112)?0:-1}" aria-label="${G.coord(p)} ${color}${p===ui.selected?'，已预选':''}" aria-selected="${p===ui.selected}" ${!interactive?'disabled':''}></button>`;
      }
      cells+=`<div role="row" class="hit-row">${row}</div>`;
    }
    for(const p of [48,56,112,168,176]){const x=30+(p%15)*30,y=30+Math.floor(p/15)*30;lines+=`<circle cx="${x}" cy="${y}" r="3" fill="#71552f"/>`;}
    b.forEach((c,p)=>{
      if(!c)return;const x=30+(p%15)*30,y=30+Math.floor(p/15)*30;
      stones+=`<circle cx="${x+1}" cy="${y+2}" r="13" fill="#553d232a"/><circle cx="${x}" cy="${y}" r="12.5" fill="url(#stone-${c})" stroke="${c===1?'#1b2520':'#b2a68e'}" stroke-width=".9"/>`;
      if(nmap.has(p))stones+=`<text class="stone-num" x="${x}" y="${y+.5}" fill="${c===1?'#fffdf5':'#25392d'}">${nmap.get(p)}</text>`;
      else if(p===last)stones+=`<circle cx="${x}" cy="${y}" r="3" fill="${c===1?'#f0d099':'#8a451f'}"/>`;
    });
    for(const m of marks){const p=typeof m.at==='string'?G.point(m.at):m.at;if(b[p])continue;const x=30+(p%15)*30,y=30+Math.floor(p/15)*30;stones+=`<circle cx="${x}" cy="${y}" r="10.5" fill="#eff5e2dd" stroke="#245b4d"/><text class="mark" x="${x}" y="${y+1}">${esc(m.label)}</text>`;}
    if(ui.selected!==null){const p=ui.selected,x=30+p%15*30,y=30+Math.floor(p/15)*30;stones+=`<path d="M${x-13} ${y-5}v-8h8M${x+5} ${y-13}h8v8M${x+13} ${y+5}v8h-8M${x-5} ${y+13}h-8v-8" stroke="#8c3c20" stroke-width="2.5" fill="none"/>`;}
    return `<div class="board-scroller"><div class="board-surface ${ui.zoom?'zoomed':''}"><svg class="board-svg" viewBox="0 0 480 480" aria-hidden="true"><defs><radialGradient id="stone-1" cx="32%" cy="25%"><stop stop-color="#4a554a"/><stop offset="1" stop-color="#18231d"/></radialGradient><radialGradient id="stone-2" cx="35%" cy="25%"><stop stop-color="#fffef8"/><stop offset="1" stop-color="#e8e5d8"/></radialGradient></defs>${lines}${labels}${stones}</svg><div class="hit-grid" role="grid" aria-label="15路棋盘，方向键移动，回车确认；也可用坐标输入落点">${cells}</div></div></div>`;
  }
  function boardPanel(b,opts={}){
    const playable=opts.playable!==false;
    return `<section class="panel board-panel" aria-label="交互棋盘"><div class="board-top"><span>${opts.label||'示意局面 · 非完整对局'}</span><span class="badge">${opts.rule||'无禁手教学'}</span></div>${boardHTML(b,{...opts,interactive:playable})}<div class="board-caption"><span>H8 天元 · 坐标 A—O 不跳 I</span><button class="text-button" data-act="zoom">${ui.zoom?'收起放大':'局部放大'}</button></div>${playable?selectionControls():''}</section>`;
  }
  function selectionControls(){return `<div class="selection-bar"><span class="small">${ui.selected===null?'先预选一个交点':`预选 <strong>${G.coord(ui.selected)}</strong>`}</span><div class="move-controls"><button data-act="cancel-point" ${ui.selected===null?'disabled':''}>取消</button><button class="primary" data-act="commit" ${ui.selected===null?'disabled':''}>${ui.route.tab==='sandbox'&&data.sandbox.mode==='erase'?'确认移除':'确认落子'}</button></div></div><div class="fine-controls" aria-label="微调预选交点"><button data-act="nudge-up" aria-label="上移一格">↑</button><button data-act="nudge-left" aria-label="左移一格">←</button><button data-act="nudge-down" aria-label="下移一格">↓</button><button data-act="nudge-right" aria-label="右移一格">→</button><span class="small">可微调，避免误触</span></div><details class="coordinate-entry-wrap"><summary class="text-button">用坐标定位</summary><div class="coordinate-entry"><label>交点<input id="coordinate" maxlength="3" placeholder="例如 H8" value="${esc(ui.coord)}" autocomplete="off" autocapitalize="characters"></label><button data-act="coordinate">定位</button></div></details>`;}
  function lessonBoard(l){const b=G.make(l.board.black,l.board.white);if(ui.lessonMove!==null)b[ui.lessonMove]=l.exercise.c;return b;}
  function courseProgress(){
    const ids=orderedLessons(),done=ids.filter(id=>data.completed.includes(id));
    return{ids,done:done.length,total:ids.length,next:ids.find(id=>!data.completed.includes(id))||ids[0]};
  }
  function renderCourse(){
    const p=courseProgress(),pct=Math.round(100*p.done/p.total);
    const stages=C.systemStages.map((stage,i)=>{
      const completed=stage.lessons.filter(id=>data.completed.includes(id)).length;
      return `<section class="panel stage-card"><div class="stage-head"><span class="stage-number">${String(i+1).padStart(2,'0')}</span><div class="stage-title"><h2>${esc(stage.title)}</h2><p>${esc(stage.subtitle)}</p></div><span class="badge ${completed===stage.lessons.length?'green':''}">${completed}/${stage.lessons.length}</span></div><div class="stage-lessons">${stage.lessons.map(id=>{const l=C.lessons.find(v=>v.id===id),done=data.completed.includes(id);return `<button class="stage-lesson" data-act="open-lesson" data-id="${id}"><span><strong>${esc(l.title)}</strong><small>${esc(l.tag)} · ${esc(l.lead)}</small></span><span class="badge ${done?'green':''}">${done?'已完成':'去学习'}</span></button>`;}).join('')}</div></section>`;
    }).join('');
    return heading('系统课 · 六阶段','从看清，到算清','不是把棋谱背长，而是把“看、判、算、摆、复”练成顺序。每课都可以在棋盘上验证。',`<button data-act="lessons">课程目录</button>`)+`<section class="panel course-hero"><div class="course-progress"><div><span class="eyebrow">学习路线</span><h2>${p.done} / ${p.total} 课已完成</h2><p class="small">完成课程互动或答对课内题会记为完成；答错不扣进度。</p></div><strong class="course-percent">${pct}%</strong></div><div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.done}" aria-label="系统课完成进度"><div class="progress-fill" style="width:${pct}%"></div></div><div class="control-row"><button class="primary" data-act="continue-course">${p.done?'继续下一课':'从第一课开始'}</button><button data-act="system-method">先看学习方法</button></div><div class="method-grid">${C.systemIntro.principles.map((v,i)=>`<div class="method-item"><span>${i+1}</span><p>${esc(v)}</p></div>`).join('')}</div></section>${stages}<section class="panel course-method"><div class="eyebrow">每课的五步</div><div class="method-steps">${C.systemIntro.method.map((v,i)=>`<div class="method-step"><strong>${i+1}</strong><p>${esc(v)}</p></div>`).join('')}</div><div class="notice">这套路线参考公开课程的教学顺序，但讲解、题面和判定为本 App 重写；不是课程原文，也不是完整职业定式库。</div></section>`;
  }
  function renderLesson(){
    const l=C.lessons.find(l=>l.id===ui.route.id),order=orderedLessons(),idx=order.indexOf(l.id),done=data.completed.includes(l.id);
    const exercise=l.exercise?`<div class="goal"><strong>${esc(l.exercise.prompt)}</strong><span class="small">直接在棋盘作答。判断依据是本题目标，不是猜固定坐标。</span></div>`:'';
    let left;
    if(l.special)left=renderProcedure(l);
    else left=boardPanel(lessonBoard(l),{marks:l.board.marks,playable:!!l.exercise&&ui.lessonMove===null,last:ui.lessonMove})+exercise+feedback();
    return heading(l.section,l.title,l.lead,`<button data-act="course">系统课</button><button data-act="lessons">课程目录</button>`)+`<div class="workbench"><div class="board-column">${left}<div class="notice">${done?'本课已完成互动。仍可随时重读、复做。':'先想一想，再亲手验证。'}<br>${idx+1} / ${order.length} 课 · ${esc(l.tag)}</div></div><article class="panel reading"><div class="eyebrow">读懂这一手</div>${l.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}${l.bullets?`<ul>${l.bullets.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:''}${l.quiz?quizHTML(l):''}<details class="notes"><summary>记录我的理由</summary><label class="small" for="lesson-note">自己的候选点、漏算的应手，或一句可迁移的经验</label><textarea id="lesson-note" maxlength="4000" placeholder="例如：先把对方的防守子放上，再检查反冲四。">${esc(data.notes[l.id]||'')}</textarea><small id="note-status">自动保存在本机，最多 4000 字。</small></details><div class="lesson-footer"><button data-act="lesson-prev" ${idx===0?'disabled':''}>上一课</button><button data-act="send-board">去摆棋验证</button><button class="primary" data-act="lesson-next" ${idx===order.length-1?'disabled':''}>下一课</button></div>${l.exercise&&ui.lessonMove!==null?'<button class="text-button" data-act="redo-lesson">重新作答</button>':''}</article></div>`;
  }
  function quizHTML(l){const q=l.quiz;return `<section class="question"><h3>${esc(q.prompt)}</h3><div class="choices">${q.options.map((o,i)=>`<button data-act="quiz" data-choice="${i}" class="${ui.lessonChoice===i?(i===q.correct?'correct':'wrong'):''}"><span class="choice-letter">${String.fromCharCode(65+i)}</span><span>${esc(o)}</span></button>`).join('')}</div>${ui.lessonChoice!==null?`<div class="feedback ${ui.lessonChoice===q.correct?'':'error'}" role="status"><strong>${ui.lessonChoice===q.correct?'理解正确':'再想一步'}</strong><p>${esc(ui.lessonChoice===q.correct?q.explanation:'先回到上方棋盘和规则，再检查一次条件。')}</p></div>`:''}</section>`;}
  function procedureBoard(){const b=G.make(['H8','I9'],['H9']);if(ui.fourth!==null)b[ui.fourth]=2;if(ui.chosen!==null)b[ui.chosen]=1;if(ui.sixth!==null)b[ui.sixth]=2;return b;}
  function renderProcedure(){
    const stage=ui.openingStage,b=procedureBoard(),black=ui.swap?'乙':'甲',white=ui.swap?'甲':'乙';
    const titles=['甲已摆好黑1、白2、黑3','乙选择：要不要交换执色？',`${white}执白，请下第4手`,`${black}执黑，提出两个不同形的黑5`,`${white}执白，选择保留哪个黑5？`,`${white}执白，继续下白6`,'开局程序完成'];
    let controls='';
    if(stage===0)controls='<button class="primary full-width" data-act="procedure-next">看完起形，让乙决定</button>';
    if(stage===1)controls='<div class="control-row"><button class="primary" data-act="swap-yes">交换执色</button><button data-act="swap-no">不交换</button></div>';
    if(stage===4)controls=`<div class="control-row">${ui.proposals.map((p,i)=>`<button data-act="choose-fifth" data-proposal="${i}">保留 ${String.fromCharCode(65+i)} · ${G.coord(p)}</button>`).join('')}</div>`;
    const marks=stage===3||stage===4?ui.proposals.map((at,i)=>({at,label:String.fromCharCode(65+i)})):[];
    return boardPanel(b,{numbers:[[G.point('H8'),1],[G.point('H9'),2],[G.point('I9'),1],...(ui.fourth!==null?[[ui.fourth,2]]:[]),...(ui.chosen!==null?[[ui.chosen,1]]:[]),...(ui.sixth!==null?[[ui.sixth,2]]:[])],marks,playable:[2,3,5].includes(stage),rule:'五手两打开局'})+`<section class="panel opening-procedure"><span class="badge green">步骤 ${stage+1} / 7</span><h2 class="mt">${esc(titles[stage])}</h2><div class="people mt"><span class="person"><i class="black-dot"></i>${black}执黑${stage<2?'（暂定）':''}</span><span class="person"><i class="white-dot"></i>${white}执白${stage<2?'（暂定）':''}</span></div>${stage===3?`<p class="small mt">已提供 ${ui.proposals.length} / 2 个点。候选点还不是实际落子；程序会拒绝相同或在现有局面下旋转、镜像等价的点。</p>`:''}${stage===6?'<p class="mt">盘上只有一个黑5。白6已落下，接下来轮黑7。交换不会改变原棋子的颜色或位置。</p>':''}<div class="mt">${controls}</div>${feedback()}<button class="text-button" data-act="procedure-reset">从头演练</button></section>`;
  }
  function currentOpening(){return C.openings.find(o=>o.id===ui.route.id);}
  function openingMoves(){const o=currentOpening();return o.moves.concat(ui.branch>=0?o.branches[ui.branch].moves.slice(0,ui.step):[]);}
  function renderOpenings(){
    const o=currentOpening(),branch=ui.branch>=0?o.branches[ui.branch]:null,moves=openingMoves(),label=ui.step?`${moves.length}手 · ${moves.at(-1)[1]===1?'黑':'白'} ${G.coord(moves.at(-1)[0])}`:'前三手起形';
    return heading('开局研习 · 26 种起形',o.name+'局',`${o.code} · ${o.kind}。看每步的用途，再比较对方换招后计划怎样变化。`,`<button data-act="opening-list">换个开局</button>`)+`<div class="workbench"><div class="board-column">${boardPanel(G.fromMoves(moves),{numbers:moves,playable:false,label:esc(label),rule:'前三手识别 / 保留5示例'})}<div class="stepper"><button data-act="branch-prev" ${!branch||ui.step===0?'disabled':''}>上一步</button><span>${branch?`${ui.step} / ${branch.moves.length} · ${esc(label)}`:'请选择一个教学分支'}</span><button class="primary" data-act="branch-next" ${!branch||ui.step===branch.moves.length?'disabled':''}>下一手</button></div><div class="notice">数字为盘面手数。分支中的黑5是最终保留点，不表示跳过了真实比赛的两打选择程序。</div></div><section class="panel reading"><div class="eyebrow">从起形到计划</div><h2>${o.kind==='直指'?'白2与天元正向相邻':'白2与天元斜向相邻'}</h2><p>黑1 H8，白2 ${G.coord(o.moves[1][0])}，黑3 ${G.coord(o.moves[2][0])}。旋转或镜像不会改变开局名称。</p><div class="control-row"><label for="branch-select">思路分支</label><select id="branch-select"><option value="-1">只看前三手</option>${o.branches.map((v,i)=>`<option value="${i}" ${ui.branch===i?'selected':''}>${esc(v.title)}</option>`).join('')}</select></div>${branch?`<div class="feedback branch-note"><strong>${esc(ui.step?label:branch.title)}</strong><p>${esc(ui.step?branch.notes[ui.step-1]:'先比较白4的意图，想一个黑方候选点，再点“下一手”查看示例。')}</p></div><p>${esc(branch.summary)}</p>`:'<p class="mt">先观察已有子力：哪些方向有二子材料？中间的白子是否切断连接？目前没有冲四时，不要机械地沿一条线延伸。</p>'}${!o.branches.length?'<div class="notice">本局提供起形识别，暂未编入短分支。可先从下方六种入门起形学习分支比较；不要把此空缺当成已经拥有完整定式库。</div>':''}<div class="notice">短分支是合法的棋理教学示例，包含不充分的防守供比较；不是最强着法排名、完整职业定式或必胜证明。</div><h3 class="mt">六种入门起形</h3><div class="chip-row">${C.common.map(n=>{const v=C.openings.find(o=>o.name===n);return `<button data-act="open-opening" data-id="${v.id}" aria-pressed="${o.id===v.id}">${n}</button>`;}).join('')}</div><button data-act="send-board">把当前局面拿去摆棋</button></section></div>`;
  }
  function practiceList(){return P.filter(p=>{const r=data.results[p.id];return(ui.practiceGroup==='all'||p.group===ui.practiceGroup)&&(ui.practiceFilter==='all'||ui.practiceFilter==='new'&&!r?.solved||ui.practiceFilter==='review'&&r?.review||ui.practiceFilter==='star'&&r?.star);});}
  function currentPuzzle(){return P.find(p=>p.id===ui.route.id);}
  function puzzleBoard(){const p=currentPuzzle(),b=p.board.slice();if(ui.answer)for(const[q,c]of ui.answer.sol.line.slice(0,ui.answer.cursor))b[q]=c;return b;}
  function renderPractice(){
    const p=currentPuzzle(),r=data.results[p.id],answer=ui.answer,solved=answer?.kind==='solved',list=practiceList();
    if(ui.practiceEmpty&&!list.length)return heading('练习筛选','这里暂时没有题目','筛选没有命中，不会用上一道题充当结果。')+'<section class="panel empty-state"><h2>暂无符合条件的题目</h2><p>全部做完、尚无错题或未收藏时，这里会留空。学习记录仍保存在本机。</p><button class="primary" data-act="reset-filters">查看全部练习</button></section>';
    const goals={win:'找一步直接成五',block:'先消除对方所有立即成五点',openfour:'走出一条活四',double:'走出两个不同的成五威胁',vcf:`找能在最多 ${p.depth} 次强制四后成五的起手`};
    const route=answer?answer.sol.line:[],last=answer&&answer.cursor?route[answer.cursor-1][0]:null;
    return heading('实战眼力 · 从局部到计算',p.title,`${p.group} · 轮${p.c===1?'黑':'白'} · ${goals[p.goal]}`,`<button data-act="puzzle-list">选题</button>`)+`<div class="workbench"><div class="board-column">${boardPanel(puzzleBoard(),{last,playable:!solved&&(!answer||answer.cursor===0),rule:'本题无禁手',label:answer&&answer.cursor?'路线演示 · 非对弈对手':'局部习题 · 轮'+(p.c===1?'黑':'白')})}${feedback()}${answer?`<div class="stepper"><button data-act="route-prev" ${answer.cursor===0?'disabled':''}>退一步</button><span>${answer.cursor} / ${route.length}${answer.cursor?` · ${route[answer.cursor-1][1]===1?'黑':'白'} ${G.coord(last)}`:''}</span><button class="primary" data-act="route-next" ${answer.cursor===route.length?'disabled':''}>下一手</button></div>`:''}<div class="notice">${r?.solved?(r.assisted?'最近一次：提示 / 看解完成':'最近一次：独立答对'):'本题尚未完成'}${r?.review?' · 待独立复习':''}<br>题库 ${P.length} 个方向练习，来自 ${new Set(P.map(p=>p.template)).size} 个原创母题，不是 ${P.length} 个独立新构型。</div></div><section class="panel reading"><div class="eyebrow">先思考，再验证</div><h2>${p.c===1?'执黑':'执白'} · ${esc(goals[p.goal])}</h2><p class="mt">先在心里算“我下、他应、我再下”。每题可以有多个合格起手，程序接受已核验的解，不以截图方向限制答案。</p><div class="chip-row">${[['all','全部'],['new','未完成'],['review','错题复习'],['star','收藏']].map(([id,name])=>`<button data-act="filter" data-filter="${id}" aria-pressed="${ui.practiceFilter===id}">${name}</button>`).join('')}</div><div class="control-row"><label for="puzzle-group">题型</label><select id="puzzle-group"><option value="all">全部题型</option>${[...new Set(P.map(v=>v.group))].map(g=>`<option ${ui.practiceGroup===g?'selected':''}>${esc(g)}</option>`).join('')}</select><button data-act="star" aria-pressed="${!!r?.star}">${r?.star?'已收藏':'收藏本题'}</button></div>${ui.hint?`<div class="feedback"><strong>思路提示</strong><p>${esc(p.hint)}</p><small>本轮已使用帮助，不计独立完成。</small></div>`:''}<div class="control-row"><button data-act="hint">思路提示</button><button data-act="reveal">查看路线</button></div>${answer?`<div class="feedback"><strong>${solved?(ui.help?'起手正确 · 使用过帮助':'起手正确 · 独立作答'):'看解中 · 不计独立完成'}</strong><p>${esc(p.why)}</p><p class="route-text">${route.map(([q,c],i)=>`${i+1}. ${c===1?'黑':'白'} ${G.coord(q)}`).join(' → ')}</p>${p.goal==='block'?'<small>本题只要求解除立即成五，不宣称后面一定守和。</small>':'<small>路线展示一种防法。强制四后的其他不防应手会被立即连五；活四的两个端点可互换。所有展示路线均由规则计算核验。</small>'}</div>`:''}<div class="notice">判题范围是本题明确目标与有限深度连续四。不符合目标的一手，仍可能在更长的计算或 VCT 中有其他价值；不会因此断言实战必败。</div><div class="lesson-footer"><button data-act="redo-puzzle">重做本题</button><button data-act="send-board">摆棋改一颗子</button><button class="primary" data-act="next-puzzle">下一题</button></div><small>当前筛选 ${list.length} 题。独立复做答对后移出待复习，历史错误次数保留。</small></section></div>`;
  }
  function renderSandbox(){
    const b=G.fromMoves(data.sandbox.moves),m=data.sandbox.mode;
    return heading('自由实验室','把“如果”摆出来','改一颗外围子、换一个防点，再看原来的攻击为什么成立或失效。')+`<div class="workbench"><div class="board-column">${boardPanel(b,{last:data.sandbox.moves.at(-1)?.[0],rule:'自由摆棋 · 不强制轮次',label:`已摆 ${data.sandbox.moves.length} 子`})}${feedback()}<div class="control-row"><button data-act="undo" ${!ui.undo.length?'disabled':''}>撤销</button><button data-act="redo" ${!ui.redo.length?'disabled':''}>重做</button><button data-act="rotate">旋转棋盘</button><button class="danger" data-act="clear-board" ${!data.sandbox.moves.length?'disabled':''}>清空</button></div></div><section class="panel reading"><div class="eyebrow">把你的判断变成可检查的局面</div><h2>落子方式</h2><div class="chip-row">${[['alternate','黑白交替'],['black','一直黑子'],['white','一直白子'],['erase','移除棋子']].map(([id,label])=>`<button data-act="sandbox-mode" data-mode="${id}" aria-pressed="${m===id}">${label}</button>`).join('')}</div><p class="small">${m==='alternate'?`下一颗：${data.sandbox.color===1?'黑':'白'}。切换模式不会清空棋盘。`:m==='erase'?'先预选已有棋子，再确认移除。':'可连续放同色子，用于构造局部练习。'}</p><h3 class="mt">检查一个候选点</h3><p class="mt">预选空点后，可以分别检查黑、白在这里的棋形。检查不会自动落子，也不把局部优势当成必胜。</p><div class="control-row"><button data-act="inspect-black">检查黑棋</button><button data-act="inspect-white">检查白棋</button></div><div id="inspection">${ui.inspection?`<div class="feedback">${esc(ui.inspection)}</div>`:''}</div><div class="notice">摆棋模式允许自由构型，不自动执行交换、比赛轮次或禁手判负。辅助检查采用有禁手连珠的棋形定义，但不处理计时、认输、申诉等比赛裁判事项。</div><h3 class="mt">用这三个问题做实验</h3><ul><li>如果防守子挪一格，原来的三还是真活三吗？</li><li>先交换两步攻击的顺序，对方能否反冲四？</li><li>少一颗支援子，那个“工字型”还能赢吗？</li></ul><button data-act="menu">备份这幅局面与学习记录</button></section></div>`;
  }
  function render(){
    theme();showStorageWarning();
    const {tab}=ui.route,active=tab==='lesson'?'course':tab;
    $('#main').innerHTML=tab==='course'?renderCourse():tab==='lesson'?renderLesson():tab==='openings'?renderOpenings():tab==='practice'?renderPractice():renderSandbox();
    document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  }
  function openModal(title,html,type='generic'){
    const dlg=$('#modal');if(!dlg.open)focusBeforeModal=document.activeElement;ui.modal=type;
    $('#modal-content').innerHTML=`<div class="modal-heading"><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" data-act="close-modal" aria-label="关闭弹窗">×</button></div>${html}`;
    if(!dlg.open)dlg.showModal();
  }
  function closeModal(){const d=$('#modal');if(d.open){d.close();focusBeforeModal?.focus?.({preventScroll:true});}ui.modal=null;confirmAction=null;}
  function confirm(title,text,action){openModal(title,`<p>${esc(text)}</p><div class="control-row mt"><button data-act="close-modal">取消</button><button class="primary" data-act="confirm-action">确认</button></div>`,'confirm');confirmAction=action;}
  function lessonsModal(){openModal('课程目录',`<p class="small">${data.completed.length} / ${C.lessons.length} 课完成互动。目录按系统课顺序排列，随时开放，不用打卡解锁。</p><div class="lesson-list">${C.systemStages.map(stage=>`<h3>${esc(stage.title)} · ${esc(stage.subtitle)}</h3>${stage.lessons.map(id=>{const l=C.lessons.find(v=>v.id===id);return `<button data-act="open-lesson" data-id="${id}"><span>${esc(l.title)}</span><small>${data.completed.includes(id)?'已练习':'待学习'}</small></button>`;}).join('')}`).join('')}</div>`,'lessons');}
  function openingModal(){openModal('26 种指定起形',`<p class="small">前三手决定名称。带“分支”的六局有短分支棋理教学，其余提供起形识别。</p>${['直指','斜指'].map(kind=>`<h3 class="mt">${kind} · 13 种</h3><div class="opening-cards mt">${C.openings.filter(o=>o.kind===kind).map(o=>`<button data-act="open-opening" data-id="${o.id}"><span>${o.name}</span><small>${o.code}${o.branches.length?' · 分支':''}</small></button>`).join('')}</div>`).join('')}`,'openings');}
  function puzzlesModal(){const list=practiceList();openModal('选择练习',`<p class="small">当前筛选 ${list.length} 题。${list.length?'换方向复习时，先从形状辨认，不背屏幕坐标。':'没有符合筛选的题目。可返回并切换“全部”。'}</p><div class="lesson-list mt">${list.map(p=>{const r=data.results[p.id];return `<button data-act="open-puzzle" data-id="${p.id}"><span>${esc(p.title)}<small style="display:block">${esc(p.group)}</small></span><small>${r?.review?'待复习':r?.solved?(r.assisted?'看解完成':'独立答对'):'未完成'}</small></button>`;}).join('')}</div>`,'puzzles');}
  function menu(){
    const results=Object.values(data.results),independent=results.filter(r=>r.solved&&!r.assisted).length,assisted=results.filter(r=>r.solved&&r.assisted).length,review=results.filter(r=>r.review).length;
    openModal('学习记录与设置',`<div class="stats-grid"><div class="stat"><strong>${independent}</strong><small>最近独立答对</small></div><div class="stat"><strong>${assisted}</strong><small>最近提示完成</small></div><div class="stat"><strong>${review}</strong><small>待独立复习</small></div></div><p class="small">完成互动课程 ${data.completed.length} / ${C.lessons.length}。记录不是棋力或段位认证。</p><div class="modal-section mt"><h3>阅读与操作</h3><div class="chip-row">${[['light','纸色'],['dark','深色'],['system','跟随系统']].map(([id,label])=>`<button data-act="theme" data-theme="${id}" aria-pressed="${data.theme===id}">${label}</button>`).join('')}</div><div class="setting-row"><label for="large-text">加大正文字号</label><input type="checkbox" id="large-text" ${data.largeText?'checked':''}></div><div class="setting-row"><label for="confirm-move">点棋盘后，再确认落子</label><input type="checkbox" id="confirm-move" ${data.confirmMove?'checked':''}></div><p class="small">小屏建议保留确认；也可局部放大、用方向按钮微调或输入坐标。</p></div><div class="modal-section"><h3>备份与恢复</h3><p class="small">课程、题目记录、笔记和当前摆棋保存在本机。卸载或清理应用数据会丢失；换手机前请导出 JSON。导入会替换当前记录，替换前会保留一份本机恢复副本。</p><div class="menu-actions"><button data-act="export">导出全部记录与摆棋</button><button data-act="import">导入 JSON 备份</button><button data-act="recover">恢复上一次导入前的副本</button>${storageError?'<button data-act="export-raw">导出未能读取的原始记录</button>':''}</div><input type="file" id="backup-file" accept="application/json,.json" hidden></div><div class="modal-section"><button class="full-width" data-act="about">关于、规则来源与内容边界</button></div>`,'menu');
  }
  function systemMethod(){openModal('系统学习方法',`<p class="small">不是把棋谱背长，而是把“看、判、算、摆、复”练成顺序。</p><div class="modal-section"><h3>四句总纲</h3><ul>${C.systemIntro.principles.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div><div class="modal-section"><h3>每课五步</h3><ol>${C.systemIntro.method.map(v=>`<li>${esc(v)}</li>`).join('')}</ol></div><div class="modal-section"><h3>每天 15 分钟</h3><p class="small">3 分钟独立复做昨日错题；5 分钟新题一两道并写出对手最强应手；4 分钟看一个开局分支或一段实战复盘；3 分钟摆一个变例，记一句可迁移的原因。</p></div><div class="modal-section"><h3>检查自己是否真的学会</h3><ul><li>换一个合理应手，还能解释原计划为什么成立或失效。</li><li>旋转棋盘、换颜色或增删一颗外围子，原解是否仍成立。</li><li>隔一天独立复做仍能做对，而不是记得第一步坐标。</li><li>能把整条路线讲给别人听，包括对手的反四和你的再反。</li></ul></div><div class="notice">系统课顺序参考公开课程《五子棋系统教程·基础篇》的教学结构；讲解、题面和判定为本 App 重写，未打包课程音频或画面。</div>`,'method');}
  function about(){openModal('关于五子棋研习',`<div class="badge green">${C.version} · 安卓离线教学</div><h3 class="mt">制作 / 署名：段小段</h3><p class="mt">理解规则、比较开局计划、寻找战术落点，并把理由放到棋盘上验证。</p><div class="modal-section"><h3>实际内容</h3><p class="small">${C.lessons.length} 课；26 种指定起形；六种起形各三条短分支；${P.length} 个方向练习来自 ${new Set(P.map(p=>p.template)).size} 个原创母题。分支并非完整职业定式，练题采用明确标注的无禁手规则。没有人机对手、联网对弈、段位评测或通用最强解引擎。</p></div><div class="modal-section"><h3>数据与权限</h3><p class="small">不申请网络、相册或广泛存储权限；页面没有在线资源、统计或广告。记录保存在本应用 WebView 的本地存储，虚拟来源为 https://app.local/。只在你操作导出、导入时使用系统文档选择器；你若选择云盘提供器，由该提供器处理文件。无账号、无自动云同步。</p></div><div class="modal-section"><h3>内容与第三方</h3><p class="small">讲解文字、简化局面、短分支说明和程序内棋盘为本项目编写；没有打包参考网站的文章、棋图或棋谱库，没有接入第三方棋力引擎。应用内无第三方运行时 JS 依赖。Android 系统 WebView 由设备提供，系统组件遵循各自许可。</p></div><div class="modal-section"><h3>规则与概念核验来源</h3><p class="small">核验日期：2026-11-16。下面网址供查阅，不在应用内自动联网打开；规则以赛事最新规程为准。</p><ol class="source-list">${C.sources.map(s=>`<li><strong>${esc(s.name)}</strong><span class="source-url">${esc(s.url)}</span><p>${esc(s.scope)}</p></li>`).join('')}</ol></div>`,'about');}
  function currentBoard(){if(ui.route.tab==='lesson'){const l=C.lessons.find(l=>l.id===ui.route.id);return l.special?procedureBoard():lessonBoard(l);}if(ui.route.tab==='openings')return G.fromMoves(openingMoves());if(ui.route.tab==='practice')return puzzleBoard();return G.fromMoves(data.sandbox.moves);}
  function selectPoint(p,instant=true){
    const b=currentBoard();
    if(b[p]&&!(ui.route.tab==='sandbox'&&data.sandbox.mode==='erase')){toast(G.coord(p)+' 已有棋子');return;}
    ui.selected=p;ui.coord=G.coord(p);ui.message=null;
    if(instant&&!data.confirmMove)commit();else render();
  }
  function nudge(dx,dy){const p=ui.selected??112,q=G.index(p%15+dx,Math.floor(p/15)+dy);if(q>=0){ui.selected=q;ui.coord=G.coord(q);render();}}
  function commit(){
    const p=ui.selected;if(p===null)return;
    const tab=ui.route.tab;
    if(tab==='lesson'){
      const l=C.lessons.find(l=>l.id===ui.route.id);
      if(l.special){procedureMove(p);return;}
      if(!l.exercise||ui.lessonMove!==null)return;
      const b=lessonBoard(l),s=l.exercise,r=G.analyse(b,p,s.c,s.rule);
      if(!r.legal){message(r.reason,true);render();return;}
      const z=b.slice();z[p]=s.c;
      const ok=s.goal==='win'?r.win:s.goal==='openfour'?G.fours(z,p,s.c).some(f=>f.ends.length>=2):!G.winningMoves(z,3-s.c).length;
      if(ok){ui.lessonMove=p;ui.selected=null;complete(l.id);message('正确。'+s.explanation);}
      else message('这一步没有完成本课目标。先检查成五点、封口和对手的立即威胁。',true);
    }else if(tab==='practice'){
      const q=currentPuzzle();if(ui.answer?.kind==='solved'||ui.answer?.cursor>0)return;
      if(q.board[p]){toast('此处已有棋子');return;}
      const sol=q.solutions.find(s=>s.p===p),r=result(q.id);r.attempts++;
      if(sol){r.solved=true;r.assisted=ui.help;if(!ui.help)r.review=false;ui.answer={sol,cursor:1,kind:'solved'};ui.selected=null;message('起手正确。请逐手查看对方应手，确认这条线如何兑现。');}
      else{r.errors++;r.review=true;message('这一步未完成本题目标，已加入错题复习。先检查对手最急的威胁；不符合本题目标不等于实战必败。',true);}
      persist();
    }else if(tab==='sandbox'){
      const b=currentBoard(),s=data.sandbox;
      if(s.mode==='erase'){if(!b[p]){toast('请选择已有棋子');return;}pushUndo();s.moves=s.moves.filter(m=>m[0]!==p);}
      else{if(b[p]){toast('此处已有棋子');return;}pushUndo();const c=s.mode==='black'?1:s.mode==='white'?2:s.color;s.moves.push([p,c]);if(s.mode==='alternate')s.color=3-c;const z=G.fromMoves(s.moves);if(G.winsAt(z,p,c))message('已形成五连或长连。这里是自由摆棋，仍可继续修改局面。');}
      ui.selected=null;ui.inspection=null;persist();
    }
    render();
  }
  function procedureMove(p){
    const b=procedureBoard();if(b[p]||ui.proposals.includes(p)){message('请选择空白且未使用的候选点。',true);render();return;}
    if(ui.openingStage===2){ui.fourth=p;ui.openingStage=3;}
    else if(ui.openingStage===3){
      if(ui.proposals.length&&G.equivalent(b,ui.proposals[0],p)){message('这两个黑5在已有局面下旋转、镜像等价，不符合两打要求。请换一个不同形的点。',true);render();return;}
      ui.proposals.push(p);if(ui.proposals.length===2)ui.openingStage=4;
    }else if(ui.openingStage===5){ui.sixth=p;ui.openingStage=6;complete('opening-procedure');}
    else return;
    ui.selected=null;ui.message=null;render();
  }
  function pushUndo(){ui.undo.push(JSON.parse(JSON.stringify(data.sandbox)));if(ui.undo.length>150)ui.undo.shift();ui.redo=[];}
  function sendBoard(){const b=currentBoard();const action=()=>{pushUndo();data.sandbox={moves:b.flatMap((c,p)=>c?[[p,c]]:[]),mode:'alternate',color:1};persist();navigate('sandbox');};if(data.sandbox.moves.length)confirm('替换当前摆棋？','现有摆棋会被当前教学局面替换。在本次运行内可撤销；需要长期保留请先导出备份。',action);else action();}
  function nextPuzzle(){const list=practiceList();if(!list.length){toast('这个筛选下已没有题目，试试“全部”');return;}const globalIndex=P.indexOf(currentPuzzle()),next=list.find(p=>P.indexOf(p)>globalIndex)||list[0];if(next.id===ui.route.id){toast('这个筛选下只有当前题');return;}navigate('practice/'+next.id);}
  function exportText(text){
    if(window.AndroidApp){AndroidApp.exportBackup(text);return;}
    const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='五子棋研习-备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已请求下载备份，请检查下载位置');
  }
  function importText(text){
    try{const clean=S.parse(text,catalog);confirm('导入并替换当前记录？',`此备份包含 ${clean.completed.length} 个课程记录、${Object.keys(clean.results).length} 个题目记录和 ${clean.sandbox.moves.length} 颗摆棋。原记录会先留作恢复副本。`,()=>{try{data=S.replace(localStorage,text,catalog);storageError=null;ui.undo=[];ui.redo=[];readRoute();toast('导入完成，原记录已保留为恢复副本');}catch(e){toast('导入未完成：'+e.message);}});}
    catch(e){openModal('备份无法导入',`<p class="danger">${esc(e.message)}</p><p class="mt">原记录没有被替换。请检查是否选中了本应用导出的 JSON 文件。</p>`);}
  }
  const acts={
    menu,about,lessons:lessonsModal,'opening-list':openingModal,'puzzle-list':puzzlesModal,'close-modal':closeModal,
    'confirm-action':()=>{const action=confirmAction;closeModal();action?.();},
    'course':()=>navigate('course'),'continue-course':()=>navigate('lesson/'+courseProgress().next),
    'system-method':systemMethod,
    'nav-course':()=>navigate('course'),'nav-openings':()=>navigate('openings/D4'),'nav-practice':()=>navigate('practice/'+P[0].id),'nav-sandbox':()=>navigate('sandbox'),
    'open-lesson':el=>navigate('lesson/'+el.dataset.id),'open-opening':el=>navigate('openings/'+el.dataset.id),'open-puzzle':el=>navigate('practice/'+el.dataset.id),
    'lesson-next':()=>{const order=orderedLessons(),i=order.indexOf(ui.route.id);if(i>=0&&i<order.length-1)navigate('lesson/'+order[i+1]);},
    'lesson-prev':()=>{const order=orderedLessons(),i=order.indexOf(ui.route.id);if(i>0)navigate('lesson/'+order[i-1]);},
    quiz:el=>{const l=C.lessons.find(l=>l.id===ui.route.id);ui.lessonChoice=Number(el.dataset.choice);if(ui.lessonChoice===l.quiz.correct)complete(l.id);render();},
    'redo-lesson':()=>{ui.lessonMove=null;ui.selected=null;ui.message=null;render();},
    zoom:()=>{ui.zoom=!ui.zoom;render();},'cancel-point':()=>{ui.selected=null;render();},commit,
    'nudge-up':()=>nudge(0,-1),'nudge-down':()=>nudge(0,1),'nudge-left':()=>nudge(-1,0),'nudge-right':()=>nudge(1,0),
    coordinate:()=>{try{ui.coord=$('#coordinate').value.trim().toUpperCase();selectPoint(G.point(ui.coord),false);}catch(e){toast(e.message);}},
    'procedure-next':()=>{ui.openingStage=1;render();},'swap-yes':()=>{ui.swap=true;ui.openingStage=2;render();},'swap-no':()=>{ui.swap=false;ui.openingStage=2;render();},
    'choose-fifth':el=>{ui.chosen=ui.proposals[Number(el.dataset.proposal)];ui.openingStage=5;ui.selected=null;render();},
    'procedure-reset':()=>{ui.openingStage=0;ui.swap=false;ui.fourth=null;ui.proposals=[];ui.chosen=null;ui.sixth=null;ui.message=null;ui.selected=null;render();},
    'branch-prev':()=>{if(ui.step>0)ui.step--;render();},'branch-next':()=>{const o=currentOpening();if(ui.branch>=0&&ui.step<o.branches[ui.branch].moves.length)ui.step++;render();},
    filter:el=>{ui.practiceFilter=el.dataset.filter;const list=practiceList();ui.practiceEmpty=!list.length;ui.selected=null;if(list.length&&!list.some(p=>p.id===ui.route.id))navigate('practice/'+list[0].id);else render();},
    'reset-filters':()=>{ui.practiceFilter='all';ui.practiceGroup='all';ui.practiceEmpty=false;render();},
    star:()=>{const r=result(ui.route.id);r.star=!r.star;persist();render();},
    hint:()=>{ui.hint=1;ui.help=true;render();},
    reveal:()=>{ui.help=true;ui.hint=1;if(!ui.answer)ui.answer={sol:currentPuzzle().solutions[0],kind:'revealed',cursor:0};render();},
    'route-prev':()=>{if(ui.answer&&ui.answer.cursor>0)ui.answer.cursor--;ui.selected=null;render();},
    'route-next':()=>{if(ui.answer&&ui.answer.cursor<ui.answer.sol.line.length)ui.answer.cursor++;ui.selected=null;render();},
    'redo-puzzle':()=>{ui.answer=null;ui.selected=null;ui.message=null;ui.hint=0;render();toast(ui.help?'已看过帮助，本轮重做仍标记提示完成':'已恢复初始局面');},
    'next-puzzle':nextPuzzle,'send-board':sendBoard,
    'sandbox-mode':el=>{data.sandbox.mode=el.dataset.mode;ui.selected=null;ui.inspection=null;persist();render();},
    undo:()=>{if(!ui.undo.length)return;ui.redo.push(JSON.parse(JSON.stringify(data.sandbox)));data.sandbox=ui.undo.pop();ui.selected=null;ui.message=null;ui.inspection=null;persist();render();},
    redo:()=>{if(!ui.redo.length)return;ui.undo.push(JSON.parse(JSON.stringify(data.sandbox)));data.sandbox=ui.redo.pop();ui.selected=null;ui.message=null;ui.inspection=null;persist();render();},
    rotate:()=>{pushUndo();data.sandbox.moves=data.sandbox.moves.map(([p,c])=>[G.transformPoint(p,1),c]);ui.selected=null;ui.inspection=null;persist();render();},
    'clear-board':()=>confirm('清空当前摆棋？','只清空摆棋，不影响课程、题目记录和笔记。本次运行内可撤销。',()=>{pushUndo();data.sandbox.moves=[];data.sandbox.color=1;ui.selected=null;ui.inspection=null;persist();render();}),
    'inspect-black':()=>inspect(1),'inspect-white':()=>inspect(2),
    theme:el=>{data.theme=el.dataset.theme;persist();theme();menu();render();},
    export:()=>exportText(JSON.stringify(S.validate(data,catalog),null,2)),
    'export-raw':()=>{try{const raw=localStorage.getItem(S.KEY);if(raw===null)toast('没有原始记录');else exportText(raw);}catch(e){toast('无法读取原始记录：'+e.message);}},
    import:()=>{if(window.AndroidApp)AndroidApp.importBackup();else $('#backup-file').click();},
    recover:()=>{try{const text=localStorage.getItem(S.RECOVERY);if(text===null){toast('没有导入前恢复副本');return;}importText(text);}catch(e){toast(e.message);}}
  };
  function inspect(c){if(ui.selected===null){toast('请先预选一个空点');return;}const r=G.analyse(currentBoard(),ui.selected,c,'renju');ui.inspection=`${c===1?'黑':'白'} ${G.coord(ui.selected)}：${r.reason}${r.legal&&!r.win?`；形成 ${r.fours?.length||0} 条四、${r.threes?.length||0} 条真实活三`:''}。这是局部棋形检查，不是全局胜负评估。`;render();}
  $('#app').addEventListener('click',event=>{
    const cell=event.target.closest('[data-point]');if(cell&&!cell.disabled){selectPoint(Number(cell.dataset.point));return;}
    const el=event.target.closest('[data-act]');if(!el||el.disabled)return;const act=acts[el.dataset.act];
    if(act){try{act(el);}catch(e){console.error(e);toast('操作未完成：'+e.message);}}
  });
  $('#app').addEventListener('input',event=>{
    if(event.target.id==='coordinate')ui.coord=event.target.value;
    if(event.target.id==='lesson-note'){data.notes[ui.route.id]=event.target.value;const ok=persist();$('#note-status').textContent=ok?'已保存到本机。':'未能保存，请导出备份。';}
  });
  $('#app').addEventListener('change',async event=>{
    const el=event.target;
    if(el.id==='branch-select'){ui.branch=Number(el.value);ui.step=0;ui.selected=null;render();}
    if(el.id==='puzzle-group'){ui.practiceGroup=el.value;const list=practiceList();ui.practiceEmpty=!list.length;if(list.length)navigate('practice/'+list[0].id);else render();}
    if(el.id==='large-text'){data.largeText=el.checked;persist();theme();render();}
    if(el.id==='confirm-move'){data.confirmMove=el.checked;persist();}
    if(el.id==='backup-file'&&el.files[0]){const f=el.files[0];try{if(f.size>1048576)throw Error('文件超过 1 MB');importText(await f.text());}catch(e){toast('导入失败：'+e.message);}el.value='';}
  });
  $('#app').addEventListener('keydown',event=>{
    if(event.target.closest('[data-point]')){
      const moves={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
      if(moves[event.key]){event.preventDefault();nudge(...moves[event.key]);$(`[data-point="${ui.selected}"]`)?.focus({preventScroll:true});}
      else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(ui.selected===null)selectPoint(Number(event.target.dataset.point),false);else commit();}
    }
    if(event.target.id==='coordinate'&&event.key==='Enter'){event.preventDefault();acts.coordinate();}
  });
  $('#modal').addEventListener('cancel',()=>{ui.modal=null;confirmAction=null;});
  window.nativeResult=(event,text)=>{if(event==='import')importText(text);else toast(text);};
  window.appHandleBack=()=>{if($('#modal').open){closeModal();return true;}if(ui.selected!==null){ui.selected=null;render();return true;}if(location.hash!=='#course'){navigate('course');return true;}return false;};
  window.appThemeChanged=()=>theme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',theme);
  window.addEventListener('hashchange',readRoute);
  readRoute();
})();
