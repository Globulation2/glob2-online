import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateCatalog} from './check-i18n.mjs';
test('catalog validation permits placeholder reordering',()=>validateCatalog({message:'{name} uses {count}'},{message:'{count} — {name}'},'test'));
test('catalog validation rejects silent fallback and missing placeholders',()=>{assert.throws(()=>validateCatalog({message:'Hello {name}'},{message:'Hello'},'test'),/placeholders/);assert.throws(()=>validateCatalog({a:'A',b:'B'},{a:'A'},'test'),/keys/);});
test('catalog validation rejects injected markup and blank translations',()=>{assert.throws(()=>validateCatalog({a:'A'},{a:'<b>A</b>'},'test'),/HTML/);assert.throws(()=>validateCatalog({a:'A'},{a:' '},'test'),/empty/);});
test('installer commands and executable names survive translation exactly',()=>{
 const source={help:'Run sudo snap install --dangerous ./PACKAGE.snap. Read INSTALL.txt; launch glob2.exe.'};
 validateCatalog(source,{help:'Exécutez sudo snap install --dangerous ./PACKAGE.snap. Consultez INSTALL.txt; lancez glob2.exe.'},'fr');
 assert.throws(()=>validateCatalog(source,{help:'Exécutez sudo snap install --dangerous ./PAQUET.snap. Consultez INSTALL.txt; lancez glob2.exe.'},'fr'),/protected literal/);
});
