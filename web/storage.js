(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyStorage=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='duan.gomoku-study.v1', RECOVERY=KEY+'.before-import';
  function initial(){return{schema:1,app:'gomoku-study',theme:'light',largeText:false,confirmMove:true,completed:[],results:{},notes:{},sandbox:{moves:[],mode:'alternate',color:1},lastLesson:'rules-board'};}
  function validate(v,catalog){
    if(!v||typeof v!=='object'||Array.isArray(v)||v.schema!==1||v.app!=='gomoku-study')throw new Error('不是兼容的五子棋研习备份（schema 1）');
    const out=initial(), lessonIds=new Set(catalog.lessons),puzzleIds=new Set(catalog.puzzles);
    if(!['light','dark','system'].includes(v.theme)||typeof v.largeText!=='boolean'||typeof v.confirmMove!=='boolean')throw new Error('设置格式错误');
    out.theme=v.theme;out.largeText=v.largeText;out.confirmMove=v.confirmMove;
    if(!Array.isArray(v.completed)||v.completed.length>lessonIds.size||new Set(v.completed).size!==v.completed.length||v.completed.some(id=>!lessonIds.has(id)))throw new Error('课程记录无效');
    out.completed=v.completed.slice();
    if(!v.results||typeof v.results!=='object'||Array.isArray(v.results)||Object.keys(v.results).length>puzzleIds.size)throw new Error('题目记录无效');
    for(const[id,r]of Object.entries(v.results)){
      if(!puzzleIds.has(id)||!r||!Number.isSafeInteger(r.attempts)||r.attempts<0||r.attempts>1000000||!Number.isSafeInteger(r.errors)||r.errors<0||r.errors>r.attempts||typeof r.solved!=='boolean'||typeof r.assisted!=='boolean'||typeof r.star!=='boolean'||typeof r.review!=='boolean')throw new Error('题目统计无效');
      out.results[id]={attempts:r.attempts,errors:r.errors,solved:r.solved,assisted:r.assisted,star:r.star,review:r.review};
    }
    if(!v.notes||typeof v.notes!=='object'||Array.isArray(v.notes)||Object.keys(v.notes).length>lessonIds.size)throw new Error('笔记格式错误');
    for(const[id,text]of Object.entries(v.notes)){
      if(!lessonIds.has(id)||typeof text!=='string'||text.length>4000)throw new Error('笔记内容无效');
      out.notes[id]=text;
    }
    const s=v.sandbox;
    if(!s||!Array.isArray(s.moves)||s.moves.length>225||!['alternate','black','white','erase'].includes(s.mode)||(s.color!==1&&s.color!==2))throw new Error('摆棋记录无效');
    const seen=new Set();
    for(const m of s.moves){if(!Array.isArray(m)||m.length!==2||!Number.isInteger(m[0])||m[0]<0||m[0]>=225||(m[1]!==1&&m[1]!==2)||seen.has(m[0]))throw new Error('摆棋交点无效');seen.add(m[0]);out.sandbox.moves.push([m[0],m[1]]);}
    out.sandbox.mode=s.mode;out.sandbox.color=s.color;
    if(!lessonIds.has(v.lastLesson))throw new Error('上次课程无效');out.lastLesson=v.lastLesson;
    return out;
  }
  function parse(text,catalog){if(typeof text!=='string'||text.length>1048576)throw new Error('文件过大（最多 1 MB）');return validate(JSON.parse(text),catalog);}
  function load(storage,catalog){
    try{const raw=storage.getItem(KEY);return{data:raw===null?initial():parse(raw,catalog),error:null};}
    catch(e){return{data:initial(),error:'学习记录读取失败，已保留原文并暂停自动保存：'+e.message};}
  }
  function save(storage,data,catalog){const clean=validate(data,catalog);storage.setItem(KEY,JSON.stringify(clean));return clean;}
  function replace(storage,text,catalog){
    const data=parse(text,catalog),old=storage.getItem(KEY);
    if(old!==null)storage.setItem(RECOVERY,old);
    storage.setItem(KEY,JSON.stringify(data));return data;
  }
  return{KEY,RECOVERY,initial,validate,parse,load,save,replace};
});
