(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Gomoku = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SIZE = 15, DIRS = [[1,0],[0,1],[1,1],[1,-1]], LETTERS = 'ABCDEFGHIJKLMNO';
  const empty = () => Array(225).fill(0);
  const inside = (x,y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  const index = (x,y) => inside(x,y) ? y * SIZE + x : -1;
  function point(s) {
    if (typeof s !== 'string' || !/^[A-O](?:[1-9]|1[0-5])$/i.test(s)) throw new Error('无效棋盘坐标');
    return index(LETTERS.indexOf(s[0].toUpperCase()), 15 - Number(s.slice(1)));
  }
  function coord(p) {
    if (!Number.isInteger(p) || p < 0 || p >= 225) throw new Error('无效交点');
    return LETTERS[p % 15] + (15 - Math.floor(p / 15));
  }
  function make(black = [], white = []) {
    const b = empty();
    for (const [list,c] of [[black,1],[white,2]]) for (const s of list) {
      const p = typeof s === 'string' ? point(s) : s;
      coord(p);
      if (b[p]) throw new Error('棋子重叠：' + coord(p));
      b[p] = c;
    }
    return b;
  }
  function fromMoves(moves) {
    const b = empty();
    for (const [p,c] of moves) {
      coord(p);
      if (b[p] || (c !== 1 && c !== 2)) throw new Error('无效棋谱');
      b[p] = c;
    }
    return b;
  }
  function lineLength(b,p,c,dx,dy) {
    const x = p % 15, y = Math.floor(p/15);
    let n = 1;
    for (const sign of [-1,1]) {
      let i = 1, q;
      while ((q=index(x+sign*dx*i,y+sign*dy*i)) >= 0 && b[q] === c) { n++; i++; }
    }
    return n;
  }
  function winsAt(b,p,c,rule='freestyle') {
    return DIRS.some(([dx,dy]) => {
      const n = lineLength(b,p,c,dx,dy);
      return c === 1 && rule === 'renju' ? n === 5 : n >= 5;
    });
  }
  function winningMoves(b,c,rule='freestyle') {
    const found = [];
    for (let p=0;p<225;p++) if (!b[p]) {
      b[p]=c;
      if (winsAt(b,p,c,rule)) found.push(p);
      b[p]=0;
    }
    return found;
  }
  // A four is identified by its four stones, not by its two completion points.
  function fours(b,p,c,rule='freestyle',onlyDir=-1) {
    const out = new Map(), x=p%15,y=Math.floor(p/15);
    DIRS.forEach(([dx,dy],d) => {
      if (onlyDir >= 0 && onlyDir !== d) return;
      for (let start=-4;start<=0;start++) {
        const stones=[], holes=[];
        let blocked=false;
        for (let k=0;k<5;k++) {
          const q=index(x+(start+k)*dx,y+(start+k)*dy);
          if (q<0 || (b[q] && b[q]!==c)) { blocked=true; break; }
          (b[q]===c ? stones : holes).push(q);
        }
        if (blocked || stones.length!==4 || holes.length!==1) continue;
        const q=holes[0]; b[q]=c;
        const n=lineLength(b,q,c,dx,dy);
        b[q]=0;
        if (c===1 && rule==='renju' && n!==5) continue;
        const key=d+':'+stones.slice().sort((a,b)=>a-b).join(',');
        if (!out.has(key)) out.set(key,{dir:d,stones:stones.slice(),ends:[]});
        if (!out.get(key).ends.includes(q)) out.get(key).ends.push(q);
      }
    });
    return [...out.values()];
  }
  function placed(b,p,c,rule,memo) {
    const lengths=DIRS.map(([dx,dy])=>lineLength(b,p,c,dx,dy));
    const win=c===1 && rule==='renju' ? lengths.includes(5) : lengths.some(n=>n>=5);
    if (win) return {legal:true,win:true,reason:'五连',fours:[],threes:[]};
    if (c===1 && rule==='renju' && lengths.some(n=>n>5)) return {legal:false,win:false,reason:'长连禁手',fours:[],threes:[]};
    const fs=fours(b,p,c,rule);
    if (c===1 && rule==='renju' && fs.length>=2) return {legal:false,win:false,reason:'四四禁手',fours:fs,threes:[]};
    const threes=new Map(), x=p%15,y=Math.floor(p/15);
    DIRS.forEach(([dx,dy],d) => {
      for (let k=-4;k<=4;k++) {
        const q=index(x+k*dx,y+k*dy);
        if (q<0 || b[q]) continue;
        b[q]=c;
        const open=fours(b,p,c,rule,d).filter(f=>f.ends.length>=2 && f.stones.includes(q));
        if (open.length && !winsAt(b,q,c,rule)) {
          let legal=true;
          if (c===1 && rule==='renju') {
            const key=b.join('')+':'+q;
            if (!memo.has(key)) memo.set(key,placed(b,q,c,rule,memo).legal);
            legal=memo.get(key);
          }
          if (legal) for (const f of open) {
            const stones=f.stones.filter(a=>a!==q).sort((a,b)=>a-b);
            const key=d+':'+stones.join(',');
            if (!threes.has(key)) threes.set(key,{dir:d,stones,extensions:[]});
            threes.get(key).extensions.push(q);
          }
        }
        b[q]=0;
      }
    });
    const ts=[...threes.values()];
    const forbidden=c===1 && rule==='renju' && ts.length>=2;
    return {legal:!forbidden,win:false,reason:forbidden?'三三禁手':'合法',fours:fs,threes:ts};
  }
  function analyse(b,p,c,rule='freestyle') {
    if (!Array.isArray(b) || b.length!==225 || b.some(v=>v!==0&&v!==1&&v!==2)) throw new Error('无效棋盘');
    if (c!==1 && c!==2) throw new Error('无效棋色');
    if (!['freestyle','renju'].includes(rule)) throw new Error('未知规则');
    if (!Number.isInteger(p) || p<0 || p>=225) return {legal:false,win:false,reason:'超出棋盘'};
    if (b[p]) return {legal:false,win:false,reason:'此处已有棋子'};
    const copy=b.slice(); copy[p]=c;
    return placed(copy,p,c,rule,new Map());
  }
  function transformPoint(p,t) {
    let x=p%15-7,y=Math.floor(p/15)-7;
    if (t>=4) x=-x;
    for (let k=0;k<t%4;k++) [x,y]=[-y,x];
    return index(x+7,y+7);
  }
  function transformBoard(b,t) { const out=empty(); b.forEach((c,p)=>{out[transformPoint(p,t)]=c;}); return out; }
  function equivalent(b,a,z) {
    return Array.from({length:8},(_,t)=>t).some(t=>transformPoint(a,t)===z && b.every((c,p)=>b[transformPoint(p,t)]===c));
  }
  function candidates(b) {
    const out=new Set();
    b.forEach((c,p)=>{
      if (!c) return;
      for (const [dx,dy] of DIRS) for (let k=-4;k<=4;k++) {
        const q=index(p%15+k*dx,Math.floor(p/15)+k*dy);
        if (q>=0 && !b[q]) out.add(q);
      }
    });
    return [...out].sort((a,b)=>Math.abs(a%15-7)+Math.abs(Math.floor(a/15)-7)-Math.abs(b%15-7)-Math.abs(Math.floor(b/15)-7));
  }
  // Exact proof within continuous-four attacks only; failure says nothing about other winning plans.
  function proveVCF(b,c,depth=3,first=null) {
    const memo=new Map(), enemy=3-c;
    function search(left,forced) {
      const key=b.join('')+':'+left;
      if (forced===null && memo.has(key)) return memo.get(key);
      const immediate=winningMoves(b,c);
      if (immediate.length && (forced===null || immediate.includes(forced))) return {move:forced===null?immediate[0]:forced,win:true};
      if (left<=0) return null;
      const moves=forced===null?candidates(b):[forced];
      for (const p of moves) {
        if (b[p]) continue;
        b[p]=c;
        const danger=winningMoves(b,enemy), ends=winningMoves(b,c);
        let proof=null;
        if (!danger.length && ends.length>=2) proof={move:p,ends:ends.slice()};
        else if (!danger.length && ends.length===1) {
          const defense=ends[0]; b[defense]=enemy;
          const next=search(left-1,null);
          b[defense]=0;
          if (next) proof={move:p,defense,next};
        }
        b[p]=0;
        if (proof) { if (forced===null) memo.set(key,proof); return proof; }
      }
      if (forced===null) memo.set(key,null);
      return null;
    }
    return search(depth,first);
  }
  function proofLine(proof,c) {
    if (!proof) return [];
    const line=[[proof.move,c]];
    if (proof.win) return line;
    if (proof.ends) return line.concat([[proof.ends[0],3-c],[proof.ends[1],c]]);
    return line.concat([[proof.defense,3-c]],proofLine(proof.next,c));
  }
  return {SIZE,DIRS,LETTERS,empty,index,point,coord,make,fromMoves,lineLength,winsAt,winningMoves,fours,analyse,transformPoint,transformBoard,equivalent,candidates,proveVCF,proofLine};
});
