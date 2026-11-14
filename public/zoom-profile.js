(function(){'use strict';
function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var ZICO='<span class="zoom-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/></svg></span>',ZUSER='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/></svg>';
function banner(user){return user && user.zoomName ? '<section class="zoom-alert zoom-ready" role="status">'+ZICO+'<span class="zoom-status-chip">● Profile submitted</span><h3>Zoom display name</h3><p>Your Zoom name: <b>'+escapeHtml(user.zoomName)+'</b>. Use this exact name when joining a live class.</p><button class="btn btn-ghost btn-sm" type="button" data-zoom-setup>Change Zoom name</button></section>' : '<section class="zoom-alert" role="alert">'+ZICO+'<span class="zoom-status-chip">● Setup needed</span><h3>Connect your Zoom display name</h3><p>You must submit the exact name on your Zoom account before you can join any DEBONE live class. This helps instructors identify paid students in the Waiting Room.</p><button class="btn btn-solid btn-sm" type="button" data-zoom-setup>Register Zoom display name</button></section>';}
/* Alert sound: reuses the pop-up chime (made in the browser). Loads the pop-up script first if this page has not yet. */
function chime(kind){try{if(window.DNotify&&DNotify.chime){DNotify.chime(kind||'update');return;}if(document.querySelector('script[data-zp-np]'))return;var s=document.createElement('script');s.src='notify-pop.js?v=51';s.setAttribute('data-zp-np','1');s.onload=function(){if(window.DNotify)DNotify.chime(kind||'update');};document.head.appendChild(s);}catch(e){}}
function show(){
  if(document.getElementById('zoom-profile-form')||!window.DModal)return;
  var current=document.querySelector('.zoom-ready b');
  var body='<div class="zoom-pop"><div class="zoom-hero">'+ZICO+'<p class="zoom-modal-kicker">Live classes · Waiting Room check</p></div>'+
    '<p class="zoom-lead">Enter the exact display name you will use in the Zoom Waiting Room. Your instructor checks it alongside your active enrollment.</p>'+
    '<div class="zoom-steps"><span><b>1</b> Check Zoom name</span><span><b>2</b> Save here</span><span><b>3</b> Join class</span></div>'+
    '<details><summary>I do not have Zoom — how do I create an account?</summary><ol><li>Visit <a href="https://zoom.us/signup" target="_blank" rel="noopener">Zoom Free sign up</a>.</li><li>Sign up and verify your email.</li><li>Choose a display name and return here.</li></ol></details>'+
    '<details><summary>I have Zoom — how do I find or change my name?</summary><ol><li>Sign in to <a href="https://zoom.us/profile" target="_blank" rel="noopener">your Zoom profile</a>.</li><li>Find your display name, choose Edit if needed, then Save.</li><li>Enter the exact same name below. On mobile, open Zoom and check your profile settings.</li></ol></details>'+
    '<form id="zoom-profile-form" novalidate><div class="zoom-field"><label for="zoom-profile-name">Your exact Zoom display name</label>'+ZUSER+'<input id="zoom-profile-name" name="zoomName" maxlength="80" minlength="3" required autocomplete="name" placeholder="e.g. Emmanuel Chidi"></div>'+
    '<p class="zoom-hint">Do not enter your email address, meeting link or passcode. Another student cannot register the same Zoom name.</p>'+
    '<p class="zoom-error" role="alert" hidden></p><button type="submit" class="btn btn-solid zoom-save"><span>Save Zoom display name</span></button></form>'+
    '<p class="zoom-hint zoom-note">A name match alone does not prove identity. The instructor must still verify and admit students in the Zoom Waiting Room.</p></div>';
  DModal.open({size:'md',eyebrow:'DEBONE Digital Academy',title:'Set up your Zoom profile',body:body,onMount:function(box,inst){
    var form=box.querySelector('form'),input=box.querySelector('input'),error=box.querySelector('.zoom-error'),btn=box.querySelector('.zoom-save');
    if(current)input.value=current.textContent;
    chime('update');
    form.addEventListener('submit',async function(e){
      e.preventDefault();var v=input.value.trim();error.hidden=true;
      if(v.length<3){error.textContent='Enter the exact name shown on your Zoom account (at least 3 characters).';error.hidden=false;box.classList.remove('zoom-shake');void box.offsetWidth;box.classList.add('zoom-shake');input.focus();return;}
      btn.disabled=true;btn.classList.add('is-busy');btn.firstChild.textContent='Saving…';
      try{
        var res=await fetch('/api/me/zoom-name',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({zoomName:v})});
        var data=await res.json().catch(function(){return{};});
        if(!res.ok)throw Error(data.error||'Could not save your Zoom name.');
        chime('graded');btn.classList.remove('is-busy');btn.classList.add('is-done');btn.firstChild.textContent='Saved ✓';
        setTimeout(function(){inst.close();setTimeout(function(){location.reload();},350);},900);
      }catch(ex){
        error.textContent=ex.message;error.hidden=false;btn.disabled=false;btn.classList.remove('is-busy');btn.firstChild.textContent='Save Zoom display name';
        box.classList.remove('zoom-shake');void box.offsetWidth;box.classList.add('zoom-shake');
      }
    });
  }});
}
document.addEventListener('click',function(e){if(e.target.closest('[data-zoom-setup]'))show();});window.DeboneZoomProfile={banner:banner,show:show,chime:chime};})();