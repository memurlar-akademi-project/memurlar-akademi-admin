import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topicContentPayload } from './topic-content-payload.ts';

test('structured lessons keep tables and nested lists on metadata-only saves', () => {
  const blocks = [{type:'table', headers:['Kavram','Kural'],rows:[['IS','Mal piyasası']]},{type:'list',items:[{marker:'a)',content:'Ana kural',children:[{marker:'1)',content:'Alt kural'}]}]}];
  const payload = topicContentPayload({summary:'Özet',content_body:'Old flat body',status:'draft'},blocks);
  assert.deepEqual(payload,{summary:'Özet',status:'draft',content_body:'',content_blocks:blocks});
});
test('legacy plain-text lessons remain editable', () => {
  assert.deepEqual(topicContentPayload({summary:'',content_body:'Yeni anlatım',status:'active'},null),{summary:null,status:'active',content_body:'Yeni anlatım',content_blocks:null});
});
test('removing every block cannot silently restore a stale plain-text body', () => {
  assert.equal(topicContentPayload({summary:'',content_body:'Stale body',status:'active'},[]).content_body,'');
});
