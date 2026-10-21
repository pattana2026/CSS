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
 host.innerHTML=`<h2>ค้นหา JOB จาก SMS ตามช่วงวันที่</h2><p class="muted">เลือกช่วงวันที่เพื่อดูรายการ JOB แล้วกดดูผู้ติดต่อเฉพาะรายการที่ต้องการ ข้อมูลชื่อและเบอร์โทรศัพท์ไม่ถูกบันทึกใน Supabase</p><div class="grid"><label>ตั้งแต่วันที่<input type="date" id="cssContactFrom"></label><label>ถึงวันที่<input type="date" id="cssContactTo"></label></div><p class="toolbar"><button type="button" id="cssJobsSearch">ค้นหา JOB จาก SMS</button><button type="button" class="secondary" id="cssContactClear">ล้างข้อมูล</button><span id="cssJobsCount" class="muted"></span></p><div style="max-height:420px;overflow:auto"><table><thead><tr><th>JOB ID</th><th>วันที่</th><th>สถานี</th><th>ประเภทงาน</th><th>ผู้ติดต่อ</th></tr></thead><tbody id="cssJobsRows"><tr><td colspan="5">เลือกช่วงวันที่และกดค้นหา</td></tr></tbody></table></div><div id="cssContactResult" role="status" aria-live="polite" style="padding:14px;margin-top:12px;background:#f4f8fd;border:1px solid #dce5f0;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere">ยังไม่ได้เลือก JOB</div>`;
 const survey=$('surveyForm')?.closest('.card');if(survey)app.insertBefore(host,survey);else app.appendChild(host);
 const today=new Date(),prior=new Date(today);prior.setDate(today.getDate()-7);$('cssContactFrom').value=iso(prior);$('cssContactTo').value=iso(today);
 const rows=$('cssJobsRows');let selectedId='';
 function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 async function getToken(){
   const member=await CSSCloud.currentMember();if(!member?.active)throw Error('กรุณาเข้าสู่ระบบใหม่');
   const {data,error}=await CSSCloud.getClient().auth.getSession();if(error||!data.session?.access_token)throw Error('Session หมดอายุ');
   return data.session.access_token;
 }
 async function request(path,params){
   const token=await getToken();const r=await fetch('http://127.0.0.1:18766'+path+'?'+new URLSearchParams(params),{headers:{Authorization:'Bearer '+token},cache:'no-store'});
   const d=await r.json();if(!r.ok||!d.ok)throw Error(r.status===401?'ตรวจสอบสิทธิ์ไม่ผ่าน':r.status===404?'ไม่พบ JOB':r.status===502?'CSS V6.5 ไม่พร้อมใช้งาน':'HTTP '+r.status);
   return d;
 }
 function dates(){const from=$('cssContactFrom').value,to=$('cssContactTo').value;const days=Math.round((new Date(to+'T00:00:00')-new Date(from+'T00:00:00'))/86400000);if(!from||!to||!Number.isFinite(days)||days<0||days>31)throw Error('กรุณาเลือกช่วงวันที่ไม่เกิน 31 วัน');return {from,to}}
 $('cssContactClear').addEventListener('click',()=>{clear();selectedId='';rows.innerHTML='<tr><td colspan="5">เลือกช่วงวันที่และกดค้นหา</td></tr>';$('cssJobsCount').textContent=''});
 $('cssJobsSearch').addEventListener('click',async()=>{
   const run=++seq,btn=$('cssJobsSearch');btn.disabled=true;rows.innerHTML='<tr><td colspan="5">กำลังค้นหา JOB…</td></tr>';clear();
   try{const range=dates();const d=await request('/api/jobs-list',range);if(run+1!==seq)return;
     const list=Array.isArray(d.jobs)?d.jobs:[];$('cssJobsCount').textContent='JOB '+list.length.toLocaleString()+' รายการ';
     rows.innerHTML=list.map(x=>'<tr><td>'+escapeHTML(x.JOB_ID)+'</td><td>'+escapeHTML(x.CloseDate||x.Opendate)+'</td><td>'+escapeHTML(x.xStation||x.STA_ID)+'</td><td>'+escapeHTML(x.WorkType)+'</td><td><button type="button" class="cssShowContact" data-job="'+escapeHTML(x.JOB_ID)+'">ดูผู้ติดต่อ</button></td></tr>').join('')||'<tr><td colspan="5">ไม่พบ JOB ในช่วงวันที่</td></tr>';
   }catch(e){rows.innerHTML='<tr><td colspan="5">'+escapeHTML(e instanceof TypeError?'เชื่อมต่อ Internal Bridge ไม่ได้':e.message)+'</td></tr>'}finally{btn.disabled=false}
 });
 rows.addEventListener('click',async event=>{
   const btn=event.target.closest('button.cssShowContact');if(!btn)return;
   const jobId=btn.dataset.job,run=++seq;selectedId=jobId;btn.disabled=true;$('cssContactResult').textContent='กำลังอ่านข้อมูลผู้ติดต่อ…';
   try{const d=await request('/api/contact',{job_id:jobId,...dates()});if(run!==seq)return;const c=d.contact||{};
     $('cssContactResult').textContent=[['JOB ID',c.JOB_ID],['ชื่อผู้แจ้ง',c.Informer],['เบอร์โทรศัพท์',c.InPhone],['สถานี',c.xStation||c.STA_ID],['ประเภทงาน',c.WorkType],['รายละเอียด',c.JobFailure_Detail]].map(([k,v])=>k+': '+(v||'-')).join('\n');
   }catch(e){if(run===seq)$('cssContactResult').textContent='ไม่สามารถแสดงข้อมูล: '+(e instanceof TypeError?'ติดต่อ Internal Bridge ไม่ได้':e.message)}finally{btn.disabled=false}
 });
 $('logout')?.addEventListener('click',()=>{$('cssContactClear').click()},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
