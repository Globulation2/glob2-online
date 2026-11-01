import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root,path),'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
export const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
export function validateCatalog(source,catalog,locale) {
 const expected=Object.keys(source).sort(),actual=Object.keys(catalog).sort();
 if(JSON.stringify(expected)!==JSON.stringify(actual))throw new Error(`${locale}: catalog keys differ from English`);
 for(const key of expected){const value=catalog[key];if(typeof value!=='string'||!value.trim())throw new Error(`${locale}/${key}: empty or non-string value`);if(JSON.stringify(placeholders(source[key]))!==JSON.stringify(placeholders(value)))throw new Error(`${locale}/${key}: placeholders differ`);for(const literal of ['Globulation 2','sudo snap install --dangerous ./PACKAGE.snap','INSTALL.txt','glob2.exe','Working 3/3','Food 10/10'])if(source[key].includes(literal)&&!value.includes(literal))throw new Error(`${locale}/${key}: protected literal changed: ${literal}`);if(/<\/?[a-z][^>]*>/i.test(value))throw new Error(`${locale}/${key}: HTML is not allowed`);}
}
function sourceDrift(source){
 const ast=ts.createSourceFile('marketing.ts',read('src/data/marketing.ts'),ts.ScriptTarget.Latest,true);
 function walk(value,path){
  if(ts.isStringLiteral(value)||ts.isNoSubstitutionTemplateLiteral(value)){if(source[path]!==value.text)throw new Error(`English source drift: ${path}`);}
  else if(ts.isArrayLiteralExpression(value))value.elements.forEach((item,index)=>walk(item,`${path}.${index}`));
  else if(ts.isObjectLiteralExpression(value))for(const property of value.properties){if(!ts.isPropertyAssignment(property))continue;const name=property.name.getText(ast).replace(/^['"]|['"]$/g,'');if(!['src','href','eyebrow'].includes(name))walk(property.initializer,`${path}.${name}`);}
 }
 for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations){const name=declaration.name.getText(ast);if(['home','game','downloads','community'].includes(name)&&declaration.initializer)walk(declaration.initializer,name);}
 function declarations(file){const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true);return tree.statements.filter(ts.isVariableStatement).flatMap(statement=>[...statement.declarationList.declarations]);}
 function property(object,name){return object.properties.find(item=>ts.isPropertyAssignment(item)&&item.name.getText().replace(/^['"]|['"]$/g,'')===name)?.initializer;}
 for(const declaration of declarations('src/data/downloads.ts')){
  const name=declaration.name.getText(),value=declaration.initializer;if(!value)continue;
  if(name==='downloadPlatforms'&&ts.isArrayLiteralExpression(value))for(const platform of value.elements){if(!ts.isObjectLiteralExpression(platform))continue;const id=property(platform,'id');if(!id||!ts.isStringLiteral(id))throw new Error('Invalid platform ID');for(const field of ['description','help']){const text=property(platform,field);if(!text||!ts.isStringLiteral(text)||source[`platform.${id.text}.${field}`]!==text.text)throw new Error(`English download source drift: ${id.text}/${field}`);}}
  if(['downloadArchitectures','downloadFormats'].includes(name)&&ts.isObjectLiteralExpression(value))for(const item of value.properties){if(!ts.isPropertyAssignment(item)||!ts.isStringLiteral(item.initializer))continue;const key=item.name.getText().replace(/^['"]|['"]$/g,'');const catalogKey=name==='downloadFormats'?`format.${key.replace('.','_')}`:`architecture.${key}`;if(source[catalogKey]!==item.initializer.text)throw new Error(`English download label drift: ${catalogKey}`);}
 }
 const site=declarations('src/data/site.ts').find(item=>item.name.getText()==='site')?.initializer;
 if(!site||!ts.isObjectLiteralExpression(site)||property(site,'tagline')?.text!==source['site.tagline'])throw new Error('English site tagline drift');
}
export function check({built=false}={}) {
 const rawSource=read('src/i18n/en.json'),source=JSON.parse(rawSource);
 const localeSource=read('src/i18n/locales.ts');
 const codes=[...localeSource.matchAll(/\bcode:\s*'([^']+)'/g)].map(match=>match[1]);
 if(codes.length!==45||new Set(codes).size!==45||!codes.includes('en'))throw new Error('Expected45 unique game locales');
 sourceDrift(source);
 for(const locale of codes){
  const raw=locale==='en'?rawSource:read(`src/i18n/locales/${locale}.json`);validateCatalog(source,JSON.parse(raw),locale);
  if(locale!=='en'){
   const review=JSON.parse(read(`src/i18n/reviews/${locale}.json`));
   if(review.status!=='reviewed'||!review.translator||!review.reviewer||review.reviewer===review.translator||review.sourceHash!==sha(rawSource)||review.catalogHash!==sha(raw))throw new Error(`${locale}: missing, stale or non-independent review`);
  }
  if(built)for(const page of ['','game','downloads','community']){
   const path=`${locale==='en'?'':`/${locale}`}/${page?`${page}/`:''}`;
   const html=read(`dist${path}index.html`);
   const direction=['ar','fa','ur'].includes(locale)?'rtl':'ltr';
   if(!html.includes(`<html lang="${locale}" dir="${direction}">`))throw new Error(`${path}: language/direction missing`);
   if(!html.includes(`rel="canonical" href="https://glob2.online${path}"`))throw new Error(`${path}: canonical missing`);
   const alternates=[...html.matchAll(/rel="alternate" hreflang="([^"]+)"/g)].map(match=>match[1]);
   for(const code of codes){const target=`https://glob2.online${code==='en'?'':`/${code}`}/${page?`${page}/`:''}`;if(!html.includes(`rel="alternate" hreflang="${code}" href="${target}"`))throw new Error(`${path}: wrong alternate destination for ${code}`);}
   if(alternates.length!==46||codes.some(code=>!alternates.includes(code)))throw new Error(`${path}: alternate languages incomplete`);
   if(html.match(/\{(?:setup|label|name|version|platform|format|architecture|size|os|title|dependencies)\}/))throw new Error(`${path}: unresolved placeholder`);
   for(const target of ['game','downloads','community'])if(!html.includes(`href="${locale==='en'?'':`/${locale}`}/${target}/"`))throw new Error(`${path}: localized ${target} link missing`);
  }
 }
 console.log(`Validated ${codes.length} marketing catalogs, ${Object.keys(source).length} fields each, 44 independent review fingerprints${built?', 180 static marketing routes':''}.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))check({built:process.argv.includes('--built')});
