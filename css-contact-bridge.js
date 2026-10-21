/* CSS Cloud contact lookup - on-demand, local-only, no persistence. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
let seq=0;
function clear(){seq++;$('cssContactResult').textContent='ยังไม่ได้ค้นหาข้อมูลผู้ติดต่อ';}
function iso(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function init(){
 const app=$('app');if(!app||!window.CSSCloud)return;
 const host=document.createElement('div');host.className='card';host.id='cssContactPanel';
 host.innerHTML=`<h2>ข้อมูลผู้ติดต่อจาก SMS</h2><p class="muted">อ่านข้อมูลจาก CSS Internal Bridge เฉพาะเมื่อกดค้นหา ไม่บันทึกข้อมูลผู้ติดต่อใน Supabase</p><div class="grid"><label>JOB ID<input id="cssContactJob" maxlength="80" placeholder="ระบุ JOB ID"></label><label>ตั้งแต่วันที่<input type="date" id="cssContactFrom"></label><label>ถึงวันที่<input type="date" id="cssContactTo"></label></div><p class="toolbar"><button type="button" id="cssContactLookup">แสดงข้อมูลผู้ติดต่อ</button><button type="button" class="secondary" id="cssContactClear">ล้างข้อมูล</button></p><div id="cssContactResult" role="status" aria-live="polite" style="padding:14px;background:#f4f8fd;border:1px solid #dce5f0;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere">ยังไม่ได้ค้นหาข้อมูลผู้ติดต่อ</div>`;
 const survey=$('surveyForm')?.closest('.card');if(survey)app.insertBefore(host,survey);else app.appendChild(host);
 const today=new Date(),prior=new Date(today);prior.setDate(today.getDate()-7);$('cssContactFrom').value=iso(prior);$('cssContactTo').value=iso(today);
 $('cssContactClear').addEventListener('click',()=>{$('cssContactJob').value='';clear()});
 $('cssContactLookup').addEventListener('click',async()=>{
  const id=$('cssContactJob').value.trim(),from=$('cssContactFrom').value,to=$('cssContactTo').value,run=++seq,button=$('cssContactLookup');
  $('cssContactResult').textContent='กำลังค้นหา…';
  if(!id||!from||!to){$('cssContactResult').textContent='กรุณาระบุ JOB ID และช่วงวันที่';return}
  const start=new Date(from+'T00:00:00'),end=new Date(to+'T00:00:00'),days=Math.round((end-start)/86400000);
  if(!Number.isFinite(days)||days<0||days>31){$('cssContactResult').textContent='ช่วงวันที่ต้องไม่เกิน 31 วัน';return}
  button.disabled=true;
  try{
   const member=await CSSCloud.currentMember();if(!member?.active)throw Error('กรุณาเข้าสู่ระบบใหม่');
   const {data,error}=await CSSCloud.getClient().auth.getSession();if(error||!data.session?.access_token)throw Error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
   const params=new URLSearchParams({job_id:id,from,to});
   const response=await fetch('http://127.0.0.1:18766/api/contact?'+params,{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store'});
   const payload=await response.json();if(run!==seq)return;
   if(!response.ok||!payload.ok){const msg={400:'ข้อมูลคำขอไม่ถูกต้องหรืออ่าน JOB ไม่สำเร็จ',401:'ตรวจสอบสิทธิ์ไม่ผ่าน',404:'ไม่พบ JOB ในช่วงวันที่ที่เลือก',502:'ไม่สามารถติดต่อ CSS V6.5 ได้'}[response.status]||('HTTP '+response.status);throw Error(msg)}
   const c=payload.contact||{};
   $('cssContactResult').textContent=[['JOB ID',c.JOB_ID],['ชื่อผู้แจ้ง',c.Informer],['เบอร์โทรศัพท์',c.InPhone],['สถานี',c.xStation||c.STA_ID],['ประเภทงาน',c.WorkType],['รายละเอียด',c.JobFailure_Detail]].map(([k,v])=>k+': '+(v||'-')).join('\n');
  }catch(e){if(run===seq)$('cssContactResult').textContent='ไม่สามารถแสดงข้อมูล: '+(e instanceof TypeError?'ติดต่อ Internal Bridge บนเครื่องนี้ไม่ได้':e.message)}finally{button.disabled=false}
 });
 // Existing JOB table buttons populate both survey form and contact lookup.
 app.addEventListener('click',event=>{const button=event.target.closest('button.choose[data-id]');if(!button)return;$('cssContactJob').value=button.dataset.id;clear()});
 $('logout')?.addEventListener('click',()=>{$('cssContactJob').value='';clear()},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
