const fs=require('fs'),path=require('path'),http=require('http');
const puppeteer=require('X:/OpenCodeTools/temp/ms-test/node_modules/puppeteer-core');
const html=fs.readFileSync(path.resolve('qa/extracted/app.html'));
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
for(const [name,w,h] of [['course-390',390,844],['course-1280',1280,900]]){
 const page=await browser.newPage();await page.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:w<900,hasTouch:w<900});
 await page.goto(origin+'/',{waitUntil:'load'});await page.waitForSelector('.stage-card');
 await page.screenshot({path:'qa/'+name+'.png',fullPage:false});
 console.log(name, await page.$eval('#page-title',e=>e.textContent), await page.$$eval('.stage-card',e=>e.length));
 await page.close();
}
await browser.close();server.close();})().catch(e=>{console.error(e);process.exit(1);});
