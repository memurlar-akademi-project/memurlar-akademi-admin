import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AdminUser } from '../lib/types';

// Node's native TypeScript loader needs the runtime file extension.
const { userFormSubmission, userFormValues } = await import(
  new URL('../lib/user-form.ts', import.meta.url).href
) as typeof import('../lib/user-form');

const user: AdminUser = {
  id: 1, name: 'Internal fixture', email: 'fixture@example.invalid', role: 'user', status: 'active',
  order_count: 0, total_spent: 0, last_activity_at: null, is_currently_active: false,
  membership: {type:'free',status:'active',exam:{id:1,name:'Exam'},access:{type:'paid',status:'active',starts_at:null,ends_at:'2027-10-10T00:00:00Z',study_allowed:true,premium:true,expired_paid:false}},
  memberships: [{id:1,type:'free',status:'active',is_selected:true,exam:{id:1,name:'Exam'}},
    {id:2,type:'free',status:'passive',is_selected:false,exam:{id:3,name:'Other exam'}}],
  activity: {answered_question_count:0,correct_answer_count:0,accuracy_rate:0,practice_session_count:0,completed_mock_exam_count:0,in_progress_mock_exam_count:0,completed_topic_count:0,in_progress_topic_count:0,note_count:0,favorite_question_count:0},
  created_at:'2026-10-10T00:00:00Z',updated_at:'2026-10-10T00:00:00Z',
};

test('profile edit never sends purchase access, unchanged status or exam commands',()=>{
  const form=userFormValues(user);
  assert.equal(form.membership_type,'preserve');
  assert.deepEqual(userFormSubmission({...form,name:'Updated name'},user),{name:'Updated name'});
  assert.deepEqual(userFormSubmission({...form,email:'next@example.invalid'},user),{email:'next@example.invalid'});
  assert.deepEqual(userFormSubmission({...form,exam_ids:[3,1]},user),{});
});
test('an explicit Free decision is sent even when the raw row is already Free and Store Premium is active',()=>{
  const form=userFormValues(user);
  assert.deepEqual(userFormSubmission({...form,membership_type:'free'},user),{membership_type:'free'});
  assert.deepEqual(userFormSubmission({...form,membership_type:'paid'},user),{membership_type:'paid'});
  assert.deepEqual(userFormSubmission({...form,membership_status:'passive'},user),{membership_status:'passive'});
});
test('exam selection submits the canonical assignment set without a membership command',()=>{
  const form=userFormValues(user);
  assert.deepEqual(userFormSubmission({...form,active_exam_id:3},user),{exam_ids:[1,3],active_exam_id:3});
  assert.deepEqual(userFormSubmission({...form,exam_ids:[3,3],active_exam_id:3},user),{exam_ids:[3],active_exam_id:3});
});
test('canonical response resets access command and a new user still includes explicit initial settings',()=>{
  const form=userFormValues(user);
  assert.deepEqual(userFormSubmission(form,user),{});
  const body=userFormSubmission({...form,membership_type:'paid',password:'test-only-password'},null);
  assert.equal(body.membership_type,'paid');
  assert.equal(body.membership_status,'active');
  assert.equal(body.status,'active');
  assert.equal(body.password,'test-only-password');
  assert.deepEqual(body.exam_ids,[1,3]);
});
