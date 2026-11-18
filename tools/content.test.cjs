'use strict';
const{test}=require('node:test'),a=require('node:assert/strict'),G=require('../web/core.js'),C=require('../web/content.js'),P=require('../web/puzzles.js');
function terminal(b){return b.some((c,p)=>c&&G.winsAt(b,p,c));}
test('all lessons are complete, original teaching positions are playable and quizzes have valid answers',()=>{
 a.equal(new Set(C.lessons.map(l=>l.id)).size,C.lessons.length);
 for(const l of C.lessons){
  a.ok(l.paragraphs.length>=2,l.id);const b=G.make(l.board.black,l.board.white);a.equal(terminal(b),false,l.id+' starts after game end');
  for(const m of l.board.marks)a.equal(b[G.point(m.at)],0,l.id+' mark overlaps stone');
  if(l.quiz){a.ok(l.quiz.correct>=0&&l.quiz.correct<l.quiz.options.length);a.ok(l.quiz.explanation.length>20);}
  if(l.exercise){
   const s=l.exercise,found=[];
   for(let p=0;p<225;p++)if(!b[p]){
    const z=b.slice();z[p]=s.c;
    const valid=s.goal==='win'?G.winsAt(z,p,s.c):s.goal==='openfour'?G.fours(z,p,s.c).some(f=>f.ends.length>=2):!G.winningMoves(z,3-s.c).length&&G.winningMoves(b,3-s.c).length>0;
    if(valid)found.push(p);
   }
   a.ok(found.length,l.id+' has no valid exercise solution');
  }
 }
});
test('system path covers every lesson exactly once and keeps a valid teaching order',()=>{
 const flat=C.systemStages.flatMap(s=>s.lessons);
 a.equal(flat.length,C.lessons.length);
 a.equal(new Set(flat).size,flat.length);
 for(const id of flat)a.ok(C.lessons.some(l=>l.id===id),id);
 a.deepEqual(flat.slice(0,2),['rules-board','rules-variants']);
 a.ok(C.systemStages.every(s=>s.title&&s.subtitle&&s.lessons.length));
 a.ok(C.systemIntro.principles.length>=3&&C.systemIntro.method.length>=3);
});
test('26 named openings have distinct symmetry classes and correct central constraints',()=>{
 a.equal(C.openings.length,26);const seen=[];
 for(const o of C.openings){
  const b=G.fromMoves(o.moves);a.equal(o.moves[0][0],G.point('H8'));
  const q=o.moves[1][0],r=o.moves[2][0];a.ok(Math.abs(q%15-7)<=1&&Math.abs(Math.floor(q/15)-7)<=1);a.ok(Math.abs(r%15-7)<=2&&Math.abs(Math.floor(r/15)-7)<=2);
  const key=Array.from({length:8},(_,t)=>G.transformBoard(b,t).join('')).sort()[0];a.ok(!seen.includes(key),o.name+' duplicate opening');seen.push(key);
 }
 a.equal(G.coord(C.openings.find(o=>o.name==='花月').moves[2][0]),'I9');
 a.equal(G.coord(C.openings.find(o=>o.name==='浦月').moves[2][0]),'I7');
 a.equal(G.coord(C.openings.find(o=>o.name==='疏星').moves[2][0]),'J10');
});
test('all short opening branches are legal under renju, have commentary for every move and no hidden turn errors',()=>{
 for(const o of C.openings)for(const branch of o.branches){
  const b=G.fromMoves(o.moves);a.equal(branch.notes.length,branch.moves.length);
  branch.moves.forEach(([p,c],i)=>{a.equal(c,i%2?1:2);const r=G.analyse(b,p,c,'renju');a.ok(r.legal,o.name+' '+branch.title+' '+G.coord(p)+' '+r.reason);a.equal(r.win,false);b[p]=c;});
 }
});
function verifyProof(b,c,v){
 a.equal(b[v.move],0);const z=b.slice();z[v.move]=c;
 if(v.win){a.ok(G.winsAt(z,v.move,c));return;}
 a.equal(G.winningMoves(z,3-c).length,0,'defender can win immediately');
 const wins=G.winningMoves(z,c);
 if(v.ends){a.ok(new Set(v.ends).size>=2);a.ok(v.ends.every(p=>wins.includes(p)));return;}
 a.deepEqual(wins,[v.defense]);
 // Every alternative defense must lose immediately, not just the displayed defense.
 for(let p=0;p<225;p++)if(!z[p]&&p!==v.defense){const other=z.slice();other[p]=3-c;a.equal(G.winsAt(other,p,3-c),false);a.ok(G.winningMoves(other,c).length);}
 z[v.defense]=3-c;verifyProof(z,c,v.next);
}
test('all generated puzzle answers carry checked winning/defensive certificates',()=>{
 a.equal(new Set(P.map(p=>p.id)).size,P.length);
 for(const p of P){
  a.equal(terminal(p.board),false,p.id+' initially terminal');a.ok(p.solutions.length,p.id);
  for(const s of p.solutions){
   a.equal(s.p,s.proof.move);
   if(p.goal==='block'){
    const z=p.board.slice();a.ok(G.winningMoves(z,3-p.c).length);z[s.p]=p.c;a.equal(G.winningMoves(z,3-p.c).length,0);
   }else verifyProof(p.board,p.c,s.proof);
   const z=p.board.slice();for(const[q,c]of s.line){a.equal(z[q],0);z[q]=c;}
   if(p.goal!=='block')a.ok(G.winsAt(z,s.line.at(-1)[0],p.c),p.id+' displayed route not winning');
  }
 }
});
test('one-move goals accept ALL solutions, including both open-four extensions',()=>{
 for(const p of P.filter(p=>p.goal!=='vcf')){
  const expected=[];
  for(let q=0;q<225;q++)if(!p.board[q]){
   const z=p.board.slice();z[q]=p.c;let ok=false;
   if(p.goal==='win')ok=G.winsAt(z,q,p.c);
   else if(p.goal==='block')ok=!G.winningMoves(z,3-p.c).length;
   else if(!G.winningMoves(z,3-p.c).length)ok=p.goal==='openfour'?G.fours(z,q,p.c).some(f=>f.ends.length>=2):G.winningMoves(z,p.c).length>=2;
   if(ok)expected.push(q);
  }
  a.deepEqual(p.solutions.map(v=>v.p).sort((a,b)=>a-b),expected,p.id);
 }
});
test('the illustrated gong line really works and fails if its support is removed',()=>{
 const l=C.lessons.find(l=>l.id==='shape-gong'),b=G.make(l.board.black,l.board.white);
 const proof=G.proveVCF(b,1,3,G.point('G7'));a.ok(proof);a.equal(proof.defense,G.point('G6'));
 const after=b.slice();after[G.point('G7')]=1;after[G.point('G6')]=2;
 a.ok(G.proveVCF(after,1,1,G.point('F8')));
 after[G.point('I5')]=0;a.equal(G.proveVCF(after,1,1,G.point('F8')),null);
});
