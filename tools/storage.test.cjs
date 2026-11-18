'use strict';
const{test}=require('node:test'),a=require('node:assert/strict'),S=require('../web/storage.js');
const cat={lessons:['rules-board','l2'],puzzles:['p1']};
function memory(){const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)};}
test('save/read, notes, independent storage identity',()=>{
 const st=memory(),data=S.initial();data.notes.l2='<script>not executed</script>';data.sandbox.moves=[[112,1],[113,2]];
 S.save(st,data,cat);a.deepEqual(S.load(st,cat).data,data);a.match(S.KEY,/gomoku/);
});
test('bad existing data is preserved, not silently overwritten',()=>{
 const st=memory();st.setItem(S.KEY,'{broken');const r=S.load(st,cat);a.ok(r.error);a.equal(st.getItem(S.KEY),'{broken');
});
test('valid import preserves original; failed validation or backup leaves it untouched',()=>{
 const st=memory();S.save(st,S.initial(),cat);const old=st.getItem(S.KEY),v=S.initial();v.theme='dark';
 a.equal(S.replace(st,JSON.stringify(v),cat).theme,'dark');a.equal(st.getItem(S.RECOVERY),old);
 const current=st.getItem(S.KEY);a.throws(()=>S.replace(st,'{}',cat));a.equal(st.getItem(S.KEY),current);
 const broken={getItem:()=>old,setItem:()=>{throw Error('disk full');}};a.throws(()=>S.replace(broken,JSON.stringify(v),cat),/disk full/);
});
test('reject malicious input, unknown ids, oversized notes, duplicate coordinates and invalid counts',()=>{
 for(const mutate of [v=>v.schema=9,v=>v.completed=['evil'],v=>v.completed=['l2','l2'],v=>v.notes.l2='x'.repeat(4001),v=>v.sandbox.moves=[[112,1],[112,2]],v=>v.results.p1={attempts:0,errors:1,solved:true,assisted:false,star:false,review:false}]){
  const v=S.initial();mutate(v);a.throws(()=>S.validate(v,cat));
 }
 a.throws(()=>S.parse('x'.repeat(1048577),cat));
 const v=S.initial();v.__proto__={injected:true};a.equal(S.validate(v,cat).injected,undefined);
});
