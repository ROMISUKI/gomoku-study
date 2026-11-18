'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const G=require('../web/core.js');
const p=G.point;
test('coordinate roundtrip, all edges and invalid input',()=>{
  for(let i=0;i<225;i++) a.equal(p(G.coord(i)),i);
  a.equal(p('A15'),0); a.equal(p('O1'),224); a.equal(p('H8'),112);
  for(const s of ['P1','A0','A16','H8x','__proto__']) a.throws(()=>p(s));
});
test('four directions win, no wrapping, immutable analysis',()=>{
  for(const [dx,dy] of G.DIRS){
    const b=G.empty();for(let k=0;k<4;k++)b[G.index(7+dx*k,7+dy*k)]=1;
    const orig=b.slice();a.equal(G.analyse(b,G.index(7-dx,7-dy),1).win,true);a.deepEqual(b,orig);
  }
  const b=G.make(['N15','O15','A14','B14']);a.equal(G.analyse(b,p('C14'),1).win,false);
});
test('renju overline, white overline, exact-five priority over forbidden',()=>{
  const b=G.make(['C8','D8','E8','F8','H8']);
  a.equal(G.analyse(b,p('G8'),1,'renju').reason,'长连禁手');
  a.equal(G.analyse(b,p('G8'),1).win,true);
  a.equal(G.analyse(b.map(v=>v?2:0),p('G8'),2,'renju').win,true);
  const z=G.make(['D8','E8','F8','G8','H3','H4','H5','H6','H7']);
  a.equal(G.analyse(z,p('H8'),1,'renju').win,true);
});
test('a straight open four is one four, same-line double-four is detected',()=>{
  const b=G.make(['F8','G8','H8']);
  const r=G.analyse(b,p('I8'),1,'renju');a.equal(r.legal,true);a.equal(r.fours.length,1);a.equal(r.fours[0].ends.length,2);
  const z=G.make(['D8','F8','H8','J8']);
  a.equal(G.analyse(z,p('G8'),1,'renju').reason,'四四禁手');
});
test('double-four, real double-three and legal white fork',()=>{
  const b=G.make(['E8','F8','G8','H5','H6','H7']);
  a.equal(G.analyse(b,p('H8'),1,'renju').reason,'四四禁手');
  const z=G.make(['G8','I8','H7','H9']);
  a.equal(G.analyse(z,p('H8'),1,'renju').reason,'三三禁手');
  a.equal(G.analyse(z.map(v=>v?2:0),p('H8'),2,'renju').legal,true);
});
test('false three blocked by edge, by stone and by forbidden continuation',()=>{
  const b=G.make(['A8','C8','B7','B9']);a.equal(G.analyse(b,p('B8'),1,'renju').legal,true);
  const z=G.make(['G8','I8','H7','H9'],['H6','H10']);a.equal(G.analyse(z,p('H8'),1,'renju').legal,true);
  const f=G.make(['G8','I8','H7','H9','F6','F7','F9','J6','J7','J9']);
  a.equal(G.analyse(f,p('H8'),1,'renju').legal,true);
});
test('symmetry preserves stones and distinct fifth proposals',()=>{
  const b=G.make(['H8','I9'],['H9','I8']);
  a.equal(G.equivalent(b,p('J9'),p('I10')),true);
  a.equal(G.equivalent(b,p('J9'),p('J7')),false);
  for(let t=0;t<8;t++) a.equal(G.transformBoard(b,t).filter(Boolean).length,4);
});
test('VCF proves four-three against forced defense; counter-win refutes',()=>{
  const b=G.make(['F8','G8','H8','I9','I10'],['E8']);
  const before=b.slice(), proof=G.proveVCF(b,1,2,p('I8'));
  a.ok(proof);a.equal(proof.defense,p('J8'));a.deepEqual(b,before);
  const line=G.proofLine(proof,1);const play=b.slice();
  for(const [q,c] of line){a.equal(play[q],0);play[q]=c;}
  a.ok(G.winsAt(play,line.at(-1)[0],1));
  const danger=G.make(['F8','G8','H8','I9','I10'],['E8','A1','B1','C1','D1']);
  a.equal(G.proveVCF(danger,1,2,p('I8')),null);
});
test('rule decisions are invariant under all rotations and reflections',()=>{
 const cases=[
  [G.make(['G8','I8','H7','H9']),p('H8'),'三三禁手'],
  [G.make(['G8','I8','H7','H9'],['H6','H10']),p('H8'),'合法'],
  [G.make(['D8','F8','H8','J8']),p('G8'),'四四禁手'],
  [G.make(['C8','D8','E8','F8','H8']),p('G8'),'长连禁手']
 ];
 for(const[b,q,reason]of cases)for(let t=0;t<8;t++)a.equal(G.analyse(G.transformBoard(b,t),G.transformPoint(q,t),1,'renju').reason,reason);
});
test('seeded random win checks agree with an independent full-line scanner',()=>{
 let seed=761116;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function reference(b,p,c,exact){
  const x=p%15,y=Math.floor(p/15);
  for(const[dx,dy]of [[1,0],[0,1],[1,1],[1,-1]]){
   let startX=x,startY=y;
   while(startX-dx>=0&&startX-dx<15&&startY-dy>=0&&startY-dy<15){startX-=dx;startY-=dy;}
   let run=0,start=0;
   for(let k=0;;k++){
    const xx=startX+k*dx,yy=startY+k*dy,v=xx>=0&&xx<15&&yy>=0&&yy<15?b[yy*15+xx]:0;
    if(v===c){if(!run)start=k;run++;}else{const includesPoint=Array.from({length:run},(_,j)=>[startX+(start+j)*dx,startY+(start+j)*dy]).some(([xx,yy])=>xx===x&&yy===y);if(includesPoint&&(exact?run===5:run>=5))return true;run=0;}
    if(xx<0||xx>=15||yy<0||yy>=15)break;
   }
  }return false;
 }
 for(let k=0;k<120;k++){
  const b=G.empty();for(let p=0;p<225;p++){const r=rand();b[p]=r<.28?1:r<.56?2:0;}
  for(let p=0;p<225;p++)if(b[p]){a.equal(G.winsAt(b,p,b[p]),reference(b,p,b[p],false));if(b[p]===1)a.equal(G.winsAt(b,p,1,'renju'),reference(b,p,1,true));}
 }
});
