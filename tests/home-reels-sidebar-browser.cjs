const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({serviceWorkers:'block'});
 await page.route('https://**',route=>route.abort());
 await page.route('**/api/**',route=>route.fulfill({json:{ok:true,user:{id:'u1',fullName:'اختبار'},posts:[],stories:[],reels:[{id:'r1',author:{fullName:'اختبار'},media:[{type:'audio',url:'/test.mp3'}]}],users:[],friends:[],requests:[],signals:[]}}));
 for(const width of [360,390,430,768,820,1180,1440,1920]){
  await page.setViewportSize({width,height:900});
  await page.goto('http://127.0.0.1:8765/taktak.html',{waitUntil:'domcontentloaded'});
  await page.locator('[data-reels-list] .reel-card').waitFor();
  const state=await page.evaluate(()=>{const p=document.querySelector('.home-reels-sidebar');const feed=document.querySelector('[data-feed]');return {count:document.querySelectorAll('[data-reels-list]').length,parent:p.parentElement.className,afterStories:p.previousElementSibling?.classList.contains('stories-block'),beforePosts:!!(p.compareDocumentPosition(feed)&Node.DOCUMENT_POSITION_FOLLOWING),overflow:document.documentElement.scrollWidth>innerWidth+1,visible:p.getBoundingClientRect().width>0,ads:!!document.querySelector('.paid-ads,.mobile-live-ads')};});
  assert.equal(state.count,1);assert.equal(state.visible,true);assert.equal(state.overflow,false);assert.equal(state.ads,false);
  if(width<=1200){assert.equal(state.parent,'feed');assert.equal(state.afterStories,true);assert.equal(state.beforePosts,true);}else assert.equal(state.parent,'right-side');
  console.log(width,state);
 }
 // Resizing an already loaded page must move the same list, not clone it.
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>document.querySelector('.home-reels-sidebar').parentElement.classList.contains('feed'));
 assert.equal(await page.locator('[data-reels-list] .reel-card').count(),1);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
