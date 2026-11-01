// Rendered localization review: run against a built-site server with Firebase headers.
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const round=process.argv[2]??'1';
const origin=process.env.SITE_URL??'http://127.0.0.1:4323';
const output=`artifacts/i18n/round-${round}`;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
const release=JSON.parse(await readFile('src/data/release-metadata.json','utf8'));
const channels=JSON.parse(await readFile('src/data/download-channels.json','utf8'));
const manifest=release.manifest??JSON.parse(await readFile('src/data/experimental-release.json','utf8'));
const expectedDownloads=[...manifest.packages.filter(pkg=>!channels.withdrawnPackages.includes(pkg.filename)),...manifest.sources].map(item=>({url:item.url,sha256:item.sha256})).sort((a,b)=>a.url.localeCompare(b.url));
for(const locale of ['en','de','ar','ja','ta'])for(const width of [360,1440]){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 const page=await context.newPage();
 const prefix=locale==='en'?'':`/${locale}`;
 for(const path of ['/','/downloads/']){
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+prefix+path,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  const name=`${locale}-${width}-${path==='/'?'home':'downloads'}`;
  await page.screenshot({path:`${output}/${name}.png`,fullPage:true});
  const languages=page.locator('.language-picker');await languages.locator('summary').focus();await page.keyboard.press('Enter');
  const keyboardOpened=await languages.evaluate(element=>element.open);
  await page.keyboard.press('Tab');
  const keyboardTarget=await page.evaluate(()=>document.activeElement?.getAttribute('href'));
  const expectedLanguageTarget=path==='/downloads/'?'/ar/downloads/':'/ar/';
  await page.screenshot({path:`${output}/${name}-languages.png`,fullPage:false});
  const menu=await languages.locator('.language-options').boundingBox();
  let downloadMetadataCorrect=true,commandIsolated=true;
  if(path==='/downloads/'){
   const actualDownloads=await page.locator('.download-packages > li').evaluateAll(items=>items.map(item=>({url:item.querySelector('a')?.getAttribute('href'),sha256:item.querySelector('.download-checksum code')?.textContent})).sort((a,b)=>a.url.localeCompare(b.url)));
   downloadMetadataCorrect=JSON.stringify(actualDownloads)===JSON.stringify(expectedDownloads);
   if(locale==='ar'){
    await languages.locator('summary').click();
    const linux=page.locator('.download-platform').filter({has:page.locator('#linux-heading')});
    await linux.locator('details.download-help').evaluateAll(items=>items.forEach(item=>item.open=true));
    const command=linux.locator('code').filter({hasText:'sudo snap install --dangerous ./PACKAGE.snap'});
    commandIsolated=await command.evaluate(element=>element.textContent==='sudo snap install --dangerous ./PACKAGE.snap'&&getComputedStyle(element).direction==='ltr'&&getComputedStyle(element).unicodeBidi==='isolate');
    await command.scrollIntoViewIfNeeded();
    await page.screenshot({path:`${output}/${locale}-${width}-linux-install-help.png`,fullPage:false});
   }
  }
  results.push({locale,width,path,overflow,keyboardOpened,keyboardTarget,keyboardCorrect:keyboardTarget===expectedLanguageTarget,menuFits:menu&&menu.x>=0&&menu.x+menu.width<=width+1,downloadMetadataCorrect,commandIsolated,errors,violations:accessibility.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
 }
 await context.close();
}
await browser.close();await writeFile(`${output}/results.json`,JSON.stringify(results,null,2)+'\n');
const problems=results.filter(r=>r.overflow||!r.menuFits||!r.keyboardOpened||!r.keyboardCorrect||!r.downloadMetadataCorrect||!r.commandIsolated||r.errors.length||r.violations.length);
console.log(JSON.stringify({output,cases:results.length,problems},null,2));

if(problems.length)process.exitCode=1;
