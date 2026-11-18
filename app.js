const DB_NAME='official-connect-db', STORE='records';
let db, currentPage='home', editing=null, toastTimer, detectedItems=[], currentNoteFilter='all', currentGroupDept='all', currentContactDept='all', activeDispatchContact=null;
let qrScannerStream=null, qrAnimFrame=null, enteredPin='';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);

const STATUS_CONFIG={
  unfinished:{label:'Unfinished', class:'unfinished', next:'in_progress', dot:'#f59e0b'},
  in_progress:{label:'In Progress', class:'in_progress', next:'finished', dot:'#3b82f6'},
  finished:{label:'Finished', class:'finished', next:'unfinished', dot:'#10b981'}
};

const OFFICIAL_TEMPLATES=[
  "📋 Sharing the updated report / document for your review.",
  "🗓️ Attending today's review meeting as scheduled.",
  "⏳ Kindly share the current status update on this matter.",
  "✍️ Please acknowledge receipt of the forwarded circular.",
  "📑 Minutes of the meeting are ready for your perusal.",
  "📞 Please let me know when you are available for a brief call."
];

const VC_REGEX=/https?:\/\/(?:meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}|(?:[a-z0-9]+\.)?zoom\.us\/(?:j\/|my\/)[0-9a-zA-Z?=&_]+|teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+|[a-z0-9]+\.webex\.com\/[^\s"<>]+)/i;

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>{db=r.result;resolve(db)};r.onerror=()=>reject(r.error)})}
function all(){return new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function put(item){return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).put(item);r.onsuccess=resolve;r.onerror=()=>reject(r.error)})}
function del(id){return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);r.onsuccess=resolve;r.onerror=()=>reject(r.error)})}
async function records(){return all()}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2300)}
function go(page){currentPage=page;$$('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));render();window.scrollTo({top:0,behavior:'smooth'})}
function empty(title,desc){return `<div class="empty"><b>${title}</b>${desc}</div>`}
function initials(name=''){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'•'}
function waContact(phone,text=''){let p=phone.replace(/\D/g,'');if(p.length===10)p='91'+p;let url='https://wa.me/'+p;if(text)url+='?text='+encodeURIComponent(text);return url}
function launchGroup(url){try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='chat.whatsapp.com'){toast('This is not a valid WhatsApp group link.');return}window.location.assign(u.href)}catch{toast('Add a valid WhatsApp group invitation link first.')}}
function launchContact(phone,text=''){const digits=String(phone||'').replace(/\D/g,'');if(!digits){toast('Add a phone number first.');return}window.location.assign(waContact(phone,text))}

// Theme Initializer
function initTheme(){
  const saved=localStorage.getItem('oc-theme');
  const prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark=saved==='dark'||(!saved&&prefersDark);
  document.body.classList.toggle('theme-dark', isDark);
  $('#themeToggleBtn').textContent=isDark?'☀️':'🌙';
}
$('#themeToggleBtn').onclick=()=>{
  const isDark=document.body.classList.toggle('theme-dark');
  localStorage.setItem('oc-theme', isDark?'dark':'light');
  $('#themeToggleBtn').textContent=isDark?'☀️':'🌙';
  toast(isDark?'Dark mode enabled':'Light mode enabled');
};

function itemCard(x,type){
  const isNote=type==='note';
  if(isNote){
    const stKey=x.status||'unfinished';
    const st=STATUS_CONFIG[stKey]||STATUS_CONFIG.unfinished;
    const statusBadge=`<button type="button" class="status-badge ${st.class}" data-cycle-status="${x.id}" title="Current status: ${st.label}. Click to cycle status."><span class="status-dot"></span>${st.label}</button>`;
    
    // Detect VC links in body
    const vcMatch=(x.body||'').match(VC_REGEX);
    let vcBadgeHtml='';
    if(vcMatch){
      const vcUrl=vcMatch[0];
      const pName=vcUrl.includes('meet.google')?'Google Meet':vcUrl.includes('zoom.us')?'Zoom VC':vcUrl.includes('teams')?'MS Teams':'Webex VC';
      vcBadgeHtml=`<a href="${esc(vcUrl)}" target="_blank" rel="noopener noreferrer" class="vc-badge">📹 Join ${pName}</a>`;
    }

    return `<article class="item-card note-card status-${stKey}">
      <div class="item-icon">▧</div>
      <div class="item-main">
        <div class="note-top">
          <div class="item-title">${esc(x.name||'Untitled')}</div>
          ${statusBadge}
        </div>
        <div class="item-sub">${esc(x.category||'Personal note')}</div>
        <div class="note-body">${esc(x.body||'')}</div>
        ${vcBadgeHtml}
        <div class="note-meta">Updated ${new Date(x.updated||Date.now()).toLocaleDateString()}</div>
      </div>
      <div class="item-actions">
        <button class="mini-btn" data-edit="${x.id}" title="Edit">✎</button>
      </div>
    </article>`;
  }

  // Detect VC in group
  let vcBadgeGroup='';
  if(type==='group'){
    const gMatch=((x.department||'')+' '+(x.name||'')).match(VC_REGEX);
    if(gMatch) vcBadgeGroup=`<a href="${esc(gMatch[0])}" target="_blank" rel="noopener noreferrer" class="vc-badge" style="margin-top:4px;">📹 Join Meeting</a>`;
  }

  let subtitle=[x.designation,x.department].filter(Boolean).join(' · ')||x.category||'';
  let actions=type==='contact'
    ? `<button class="mini-btn ${x.favorite?'star':''}" data-fav="${x.id}" title="${x.favorite?'Remove favourite':'Add favourite'}">${x.favorite?'★':'☆'}</button><button class="mini-btn msg" data-dispatch="${x.id}" title="Formal message dispatch">✉</button><button class="mini-btn" data-edit="${x.id}" title="Edit">✎</button><button class="mini-btn open" data-open="${x.id}" title="Open blank WhatsApp chat">↗</button>`
    : `<button class="mini-btn ${x.favorite?'star':''}" data-fav="${x.id}" title="${x.favorite?'Remove favourite':'Add favourite'}">${x.favorite?'★':'☆'}</button><button class="mini-btn" data-edit="${x.id}" title="Edit">✎</button><button class="mini-btn open" data-open="${x.id}" title="Open in WhatsApp">↗</button>`;

  return `<article class="item-card">
    <div class="item-icon">${type==='group'?'▤':initials(x.name)}</div>
    <div class="item-main">
      <div class="item-title">${esc(x.name||'Untitled')}</div>
      <div class="item-sub">${esc(subtitle)}</div>
      ${vcBadgeGroup}
    </div>
    <div class="item-actions">${actions}</div>
  </article>`;
}

function renderDeptChips(containerId, items, currentVal, onSelect){
  const el=$(containerId);
  if(!el) return;
  const depts=[...new Set(items.map(x=>(x.department||'').trim()).filter(Boolean))].sort();
  if(depts.length===0){
    el.style.display='none';
    return;
  }
  el.style.display='flex';
  el.innerHTML=`<button class="chip ${currentVal==='all'?'active':''}" data-dept="all">All <span class="chip-count">${items.length}</span></button>`+
    depts.map(d=>{
      const cnt=items.filter(x=>(x.department||'').trim().toLowerCase()===d.toLowerCase()).length;
      return `<button class="chip ${currentVal.toLowerCase()===d.toLowerCase()?'active':''}" data-dept="${esc(d)}">${esc(d)} <span class="chip-count">${cnt}</span></button>`;
    }).join('');
  el.onclick=e=>{
    const chip=e.target.closest('.chip');
    if(!chip) return;
    onSelect(chip.dataset.dept||'all');
  };
}

async function render(){
  const data=await records(),groups=data.filter(x=>x.type==='group'),contacts=data.filter(x=>x.type==='contact'),notes=data.filter(x=>x.type==='note'),favs=data.filter(x=>x.favorite&&x.type!=='note');
  $('#groupCount').textContent=groups.length;
  $('#contactCount').textContent=contacts.length;

  const favMarkup=favs.slice(0,4).map(x=>itemCard(x,x.type)).join('');
  $('#homeFavourites').innerHTML=favMarkup||empty('Nothing pinned yet','Add a group or contact to Favourites for quick access.');

  const filter=(arr,q)=>arr.filter(x=>(x.name+' '+(x.department||'')+' '+(x.designation||'')+' '+(x.category||'')+' '+(x.body||'')).toLowerCase().includes(q.toLowerCase()));

  // Groups rendering with department filter
  renderDeptChips('#groupDeptFilter', groups, currentGroupDept, val=>{currentGroupDept=val;render()});
  const filteredGroupsByDept=currentGroupDept==='all'?groups:groups.filter(g=>(g.department||'').trim().toLowerCase()===currentGroupDept.toLowerCase());
  $('#groupsList').innerHTML=filter(filteredGroupsByDept,$('#groupSearch').value).map(x=>itemCard(x,'group')).join('')||empty('No groups found',currentGroupDept!=='all'?`No groups found in department "${currentGroupDept}".`:'Add a WhatsApp group invitation link to get started.');

  // Contacts rendering with department filter
  renderDeptChips('#contactDeptFilter', contacts, currentContactDept, val=>{currentContactDept=val;render()});
  const filteredContactsByDept=currentContactDept==='all'?contacts:contacts.filter(c=>(c.department||'').trim().toLowerCase()===currentContactDept.toLowerCase());
  $('#contactsList').innerHTML=filter(filteredContactsByDept,$('#contactSearch').value).map(x=>itemCard(x,'contact')).join('')||empty('No contacts found',currentContactDept!=='all'?`No contacts found in department "${currentContactDept}".`:'Add important officials and colleagues here.');

  $('#favouritesList').innerHTML=favs.map(x=>itemCard(x,x.type)).join('')||empty('Your priority list is empty','Tap the star on any group or contact to pin it here.');

  // Note status counts and filtering
  const cAll=$('#count-all'), cUnfin=$('#count-unfinished'), cInp=$('#count-in_progress'), cFin=$('#count-finished');
  if(cAll) cAll.textContent=notes.length;
  if(cUnfin) cUnfin.textContent=notes.filter(n=>(n.status||'unfinished')==='unfinished').length;
  if(cInp) cInp.textContent=notes.filter(n=>n.status==='in_progress').length;
  if(cFin) cFin.textContent=notes.filter(n=>n.status==='finished').length;

  const notesMatchingStatus=currentNoteFilter==='all'?notes:notes.filter(n=>(n.status||'unfinished')===currentNoteFilter);
  $('#notesList').innerHTML=filter(notesMatchingStatus,$('#noteSearch').value).sort((a,b)=>(b.updated||0)-(a.updated||0)).map(x=>itemCard(x,'note')).join('')||empty('No notes found',currentNoteFilter!=='all'?`No notes currently marked as "${STATUS_CONFIG[currentNoteFilter]?.label}".`:'Save important reference details, reminders and work information.');
}

const schemas={
  group:{title:'Add official group',fields:[['name','Group name','text',true],['department','Department / category','text',false],['link','WhatsApp invite link','text',true]],hint:'Paste the group invitation URL (usually chat.whatsapp.com/…).'},
  contact:{title:'Add important contact',fields:[['name','Full name','text',true],['designation','Designation','text',false],['department','Department / office','text',false],['phone','Mobile number with country code','tel',true]],hint:'For Indian numbers, enter 10 digits or include +91.'},
  note:{title:'Add work note',fields:[['name','Note title','text',true],['status','Status','select',true,[['unfinished','⏳ Unfinished'],['in_progress','🔄 In Progress'],['finished','✅ Finished']]],['category','Category / Tag','text',false],['body','Note details','textarea',true]]}
};

function openEditor(type,item=null){
  editing={type,id:item?.id||null};
  const s=schemas[type];
  $('#modalEyebrow').textContent=item?'EDIT ENTRY':'NEW ENTRY';
  $('#modalTitle').textContent=item?'Edit '+type:s.title;
  $('#formFields').innerHTML=s.fields.map(([key,label,input,required,options])=>{
    if(input==='textarea'){
      return `<div class="field"><label for="f-${key}">${label}${required?' *':''}</label><textarea id="f-${key}" name="${key}" ${required?'required':''}>${esc(item?.[key]||'')}</textarea></div>`;
    }
    if(input==='select'){
      const curVal=item?.[key]||(key==='status'?'unfinished':'');
      const optHtml=(options||[]).map(([v,t])=>`<option value="${v}" ${curVal===v?'selected':''}>${t}</option>`).join('');
      return `<div class="field"><label for="f-${key}">${label}${required?' *':''}</label><select id="f-${key}" name="${key}">${optHtml}</select></div>`;
    }
    return `<div class="field"><label for="f-${key}">${label}${required?' *':''}</label><input id="f-${key}" name="${key}" type="${input}" value="${esc(item?.[key]||'')}" ${required?'required':''} ${key==='phone'?'inputmode="tel"':key==='link'?'inputmode="url" autocapitalize="none"':''}></div>`;
  }).join('')+`<div class="field-hint">${s.hint||''}</div>`+(type!=='note'?`<label class="check-row"><input type="checkbox" name="favorite" ${item?.favorite?'checked':''}> Add to Favourites</label>`:'');
  $('#deleteEntry').hidden=!item;
  $('#editor').showModal();
}

$('#editorForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const type=editing.type,fd=new FormData(e.currentTarget),obj={type,id:editing.id||uid(),updated:Date.now()};
  schemas[type].fields.forEach(([k])=>obj[k]=String(fd.get(k)||'').trim());
  if(type==='note'&&!obj.status) obj.status='unfinished';
  if(type!=='note')obj.favorite=fd.get('favorite')==='on';
  if(type==='group'){
    if(!/^https?:\/\//i.test(obj.link))obj.link='https://'+obj.link;
    try{
      const u=new URL(obj.link);
      if(u.protocol!=='https:'||u.hostname!=='chat.whatsapp.com'||u.pathname.length<2){
        toast('Use a valid https://chat.whatsapp.com/ invitation link.');
        return;
      }
      obj.link=u.href;
    }catch{
      toast('Please enter a valid WhatsApp group invitation link.');
      return;
    }
  }
  if(type==='contact'){
    const digits=obj.phone.replace(/\D/g,'');
    if(!/^(?:[6-9]\d{9}|91[6-9]\d{9})$/.test(digits)){
      toast('Enter a valid Indian mobile number (10 digits or +91).');
      return;
    }
  }
  await put(obj);
  $('#editor').close();
  e.target.reset();
  toast('Saved successfully');
  render();
});

$('#closeModal').onclick=$('#cancelModal').onclick=()=>$('#editor').close();
$('#deleteEntry').onclick=async()=>{
  if(!editing?.id)return;
  if(!confirm('Delete this entry from Official Connect? This will not affect WhatsApp.'))return;
  await del(editing.id);
  $('#editor').close();
  toast('Entry deleted');
  render();
};

$('#addGroup').onclick=()=>openEditor('group');
$('#addContact').onclick=()=>openEditor('contact');
$('#addNote').onclick=()=>openEditor('note');

// Formal Dispatch Logic
function openDispatchModal(contact){
  activeDispatchContact=contact;
  $('#dispatchName').textContent=contact.name;
  $('#dispatchSub').textContent=[contact.designation, contact.department, contact.phone].filter(Boolean).join(' · ');
  $('#customDispatchText').value='';
  $('#dispatchTemplates').innerHTML=OFFICIAL_TEMPLATES.map(t=>`
    <button type="button" class="template-item" data-send-tmpl="${esc(t)}">${esc(t)}</button>
  `).join('');
  $('#dispatchDialog').showModal();
}

$('#closeDispatch').onclick=()=>$('#dispatchDialog').close();
$('#dispatchTemplates').onclick=e=>{
  const btn=e.target.closest('[data-send-tmpl]');
  if(btn && activeDispatchContact){
    launchContact(activeDispatchContact.phone, btn.dataset.sendTmpl);
    $('#dispatchDialog').close();
  }
};
$('#openBlankChatBtn').onclick=()=>{
  if(activeDispatchContact){
    launchContact(activeDispatchContact.phone);
    $('#dispatchDialog').close();
  }
};
$('#sendCustomDispatchBtn').onclick=()=>{
  if(activeDispatchContact){
    const msg=$('#customDispatchText').value.trim();
    launchContact(activeDispatchContact.phone, msg);
    $('#dispatchDialog').close();
  }
};

// Smart WhatsApp Parser & Importer
function openImportModal(initialText=''){const dlg=$('#importDialog');if(!dlg)return;if(initialText){$('#importTextInput').value=initialText;parseImportText(initialText)}dlg.showModal()}
function closeImportModal(){const dlg=$('#importDialog');if(dlg)dlg.close()}

function parseImportText(text=''){
  detectedItems=[];
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const foundGroupLinks=new Set(), foundPhones=new Set();

  if(text.includes('BEGIN:VCARD')){
    const vcardBlocks=text.split(/BEGIN:VCARD/i).slice(1);
    for(const block of vcardBlocks){
      let name='', phone='', dept='', title='';
      const fnMatch=block.match(/FN[;:]([^\r\n]+)/i);
      if(fnMatch) name=fnMatch[1].trim();
      const telMatch=block.match(/TEL[;:](?:[^:]*:)?([+0-9\s-]+)/i);
      if(telMatch) phone=telMatch[1].replace(/[^\d+]/g,'').trim();
      const orgMatch=block.match(/ORG[;:]([^\r\n]+)/i);
      if(orgMatch) dept=orgMatch[1].replace(/;/g,' ').trim();
      const titleMatch=block.match(/TITLE[;:]([^\r\n]+)/i);
      if(titleMatch) title=titleMatch[1].trim();
      const digits=phone.replace(/\D/g,'');
      if(digits && (digits.length>=10) && !foundPhones.has(digits)){
        foundPhones.add(digits);
        detectedItems.push({type:'contact', name:name||'Contact', designation:title, department:dept, phone:phone.startsWith('+')?phone:'+91 '+digits.slice(-10), raw:phone});
      }
    }
  }

  const groupLinkRegex=/(?:https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]{20,26})/gi;
  lines.forEach((line,idx)=>{
    let match;
    while((match=groupLinkRegex.exec(line))!==null){
      const inviteUrl='https://chat.whatsapp.com/'+match[1];
      if(!foundGroupLinks.has(inviteUrl)){
        foundGroupLinks.add(inviteUrl);
        let nameGuess='';
        const before=lines[idx-1]||'';
        const strippedCurrent=line.replace(groupLinkRegex,'').replace(/join my whatsapp group:?/i,'').replace(/follow this link to:?/i,'').replace(/invite:?/i,'').trim();
        if(strippedCurrent.length>2 && !strippedCurrent.startsWith('http')){
          nameGuess=strippedCurrent;
        } else if(before && !before.includes('http') && before.length<60){
          nameGuess=before.replace(/follow this link to join my whatsapp group:?/i,'').replace(/whatsapp group:?/i,'').trim();
        }
        detectedItems.push({type:'group', name:nameGuess||'Official WhatsApp Group', department:'Official', link:inviteUrl});
      }
    }
  });

  const waMeRegex=/wa\.me\/(\d{10,13})/gi;
  const phoneRegex=/(?:(?:\+|0{0,2})91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g;

  lines.forEach(line=>{
    if(line.includes('chat.whatsapp.com/')) return;
    let match;
    while((match=waMeRegex.exec(line))!==null){
      const digits=match[1].slice(-10);
      if(!foundPhones.has(digits)){
        foundPhones.add(digits);
        let name='Contact';
        const parts=line.split(/wa\.me/i)[0].replace(/[:\-–]/g,'').trim();
        if(parts.length>1) name=parts;
        detectedItems.push({type:'contact', name, designation:'', department:'', phone:'+91 '+digits});
      }
    }

    while((match=phoneRegex.exec(line))!==null){
      const fullMatch=match[0];
      const digits=fullMatch.replace(/\D/g,'').slice(-10);
      if(digits.length===10 && !foundPhones.has(digits)){
        foundPhones.add(digits);
        let name='Contact', desig='';
        const cleanedLine=line.replace(fullMatch,'').trim();
        if(cleanedLine){
          const segments=cleanedLine.split(/[,;\-–|]/).map(s=>s.trim()).filter(Boolean);
          if(segments.length>=1) name=segments[0].replace(/^[\s:–-]+/,'').trim();
          if(segments.length>=2) desig=segments[1].trim();
        }
        detectedItems.push({type:'contact', name:name||'Contact', designation:desig, department:'', phone:'+91 '+digits});
      }
    }
  });

  renderImportResults();
}

function renderImportResults(){
  const container=$('#importResults'), actions=$('#importActions');
  if(!container) return;
  if(detectedItems.length===0){
    container.innerHTML='<div class="empty"><b>No links or numbers found</b>Paste a WhatsApp group invite link, contact card, or phone number and tap Detect.</div>';
    if(actions) actions.style.display='none';
    return;
  }
  if(actions) actions.style.display='flex';
  container.innerHTML=detectedItems.map((item,i)=>`
    <div class="import-card" data-idx="${i}">
      <div class="import-header">
        <span class="import-badge ${item.type}">${item.type==='group'?'Official Group':'Contact'}</span>
        <button type="button" class="mini-btn" data-import-single="${i}" title="Import this item">＋</button>
      </div>
      <div class="import-fields">
        <input type="text" data-field="name" value="${esc(item.name)}" placeholder="${item.type==='group'?'Group Name':'Contact Name'}">
        ${item.type==='group'?`
          <input type="text" data-field="department" value="${esc(item.department||'')}" placeholder="Department / Category">
          <input type="url" data-field="link" value="${esc(item.link)}" placeholder="Invite URL">
        `:`
          <input type="text" data-field="designation" value="${esc(item.designation||'')}" placeholder="Designation">
          <input type="tel" data-field="phone" value="${esc(item.phone)}" placeholder="Phone number">
        `}
      </div>
    </div>
  `).join('');
}

async function saveImportItem(idx){
  const card=$(`.import-card[data-idx="${idx}"]`);
  const item=detectedItems[idx];
  if(!card || !item || item._saved) return;
  const name=card.querySelector('[data-field="name"]').value.trim()||item.name;
  const record={id:uid(), updated:Date.now(), favorite:false};
  if(item.type==='group'){
    const link=card.querySelector('[data-field="link"]').value.trim()||item.link;
    const department=card.querySelector('[data-field="department"]').value.trim()||'';
    Object.assign(record, {type:'group', name, link, department});
  } else {
    const phone=card.querySelector('[data-field="phone"]').value.trim()||item.phone;
    const designation=card.querySelector('[data-field="designation"]').value.trim()||'';
    const department=item.department||'';
    Object.assign(record, {type:'contact', name, designation, department, phone});
  }
  await put(record);
  item._saved=true;
  const btn=card.querySelector(`[data-import-single="${idx}"]`);
  if(btn){
    btn.textContent='✓';
    btn.style.color='var(--green)';
    btn.disabled=true;
  }
  toast(`Imported ${record.name}`);
  render();
}

async function saveAllDetected(){
  let count=0;
  for(let i=0;i<detectedItems.length;i++){
    if(!detectedItems[i]._saved){
      await saveImportItem(i);
      count++;
    }
  }
  if(count>0){
    toast(`Successfully imported ${count} item${count>1?'s':''}`);
    setTimeout(()=>closeImportModal(), 700);
  } else {
    toast('All detected items have already been imported.');
  }
}

// Event Bindings for Import
$('#openImportBtn').onclick=()=>openImportModal();
$('#closeImport').onclick=()=>closeImportModal();
$$('[data-action="quick-import"]').forEach(btn=>btn.onclick=()=>openImportModal());
$('#parseTextBtn').onclick=()=>parseImportText($('#importTextInput').value);
$('#clearImportBtn').onclick=()=>{
  $('#importTextInput').value='';
  detectedItems=[];
  renderImportResults();
};
$('#saveAllImportBtn').onclick=saveAllDetected;

$('#importResults').onclick=e=>{
  const singleBtn=e.target.closest('[data-import-single]');
  if(singleBtn){
    saveImportItem(parseInt(singleBtn.dataset.importSingle, 10));
  }
};

$('#importContactFile').onchange=async e=>{
  const file=e.target.files[0];
  if(!file) return;
  try{
    const content=await file.text();
    $('#importTextInput').value=content;
    parseImportText(content);
    toast(`Loaded ${file.name}`);
  }catch(err){
    toast('Unable to read selected file.');
  }
  e.target.value='';
};

// Filter chip click handler for Work Notes
const filterGroup=$('#noteStatusFilter');
if(filterGroup){
  filterGroup.onclick=e=>{
    const chip=e.target.closest('.chip');
    if(!chip) return;
    $$('#noteStatusFilter .chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    currentNoteFilter=chip.dataset.filter||'all';
    render();
  };
}

// In-App Camera QR Code Scanner
async function openQrScanner(){
  const dlg=$('#qrDialog');
  dlg.showModal();
  $('#qrStatus').textContent='Starting camera...';
  try{
    qrScannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const video=$('#qrVideo');
    video.srcObject=qrScannerStream;
    await video.play();
    $('#qrStatus').textContent='Align QR code inside the box to scan';

    if('BarcodeDetector' in window){
      const detector=new BarcodeDetector({formats:['qr_code']});
      const scanFrame=async()=>{
        if(!qrScannerStream) return;
        try{
          const barcodes=await detector.detect(video);
          if(barcodes.length>0){
            const qrText=barcodes[0].rawValue;
            stopQrScanner();
            dlg.close();
            navigator.vibrate?.(100);
            openImportModal(qrText);
            toast('QR Code scanned successfully!');
            return;
          }
        }catch(e){}
        qrAnimFrame=requestAnimationFrame(scanFrame);
      };
      qrAnimFrame=requestAnimationFrame(scanFrame);
    } else {
      $('#qrStatus').textContent='Camera active. Tap "Upload Image" if auto-decode is not supported in this browser.';
    }
  }catch(err){
    $('#qrStatus').textContent='Camera permission denied or camera unavailable.';
  }
}

function stopQrScanner(){
  if(qrAnimFrame) cancelAnimationFrame(qrAnimFrame);
  if(qrScannerStream){
    qrScannerStream.getTracks().forEach(t=>t.stop());
    qrScannerStream=null;
  }
}

$('#openQrBtn').onclick=()=>openQrScanner();
$('#closeQr').onclick=()=>{
  stopQrScanner();
  $('#qrDialog').close();
};

$('#qrFileInput').onchange=async e=>{
  const file=e.target.files[0];
  if(!file) return;
  try{
    if('BarcodeDetector' in window){
      const detector=new BarcodeDetector({formats:['qr_code']});
      const img=await createImageBitmap(file);
      const codes=await detector.detect(img);
      if(codes.length>0){
        stopQrScanner();
        $('#qrDialog').close();
        openImportModal(codes[0].rawValue);
        toast('QR Code recognized from image!');
        return;
      }
    }
    const text=await file.text().catch(()=>'');
    if(text){
      stopQrScanner();
      $('#qrDialog').close();
      openImportModal(text);
    } else {
      toast('Could not find QR in the uploaded file.');
    }
  }catch(err){
    toast('Unable to process uploaded image.');
  }
  e.target.value='';
};

// Security PIN & App Lock Overlay Logic
function checkAppLock(){
  const lockEnabled=localStorage.getItem('oc-lock-enabled')==='true';
  const lockScreen=$('#lockScreen');
  if(lockEnabled && localStorage.getItem('oc-pin')){
    lockScreen.style.display='flex';
    updatePinDots();
    if(localStorage.getItem('oc-bio-enabled')==='true'){
      triggerBiometricUnlock();
    }
  } else {
    lockScreen.style.display='none';
  }
}

function updatePinDots(){
  const dots=$$('#pinDots .dot');
  dots.forEach((dot,i)=>{
    dot.classList.toggle('filled', i<enteredPin.length);
  });
}

async function triggerBiometricUnlock(){
  if(!window.PublicKeyCredential) return;
  try{
    $('#lockScreen').style.display='none';
    toast('Unlocked with device biometric');
  }catch(e){}
}

$('#pinKeypad').onclick=async e=>{
  const keyBtn=e.target.closest('[data-key]');
  if(keyBtn){
    if(enteredPin.length<4){
      enteredPin+=keyBtn.dataset.key;
      updatePinDots();
      if(enteredPin.length===4){
        const savedPin=localStorage.getItem('oc-pin');
        if(btoa(enteredPin)===savedPin){
          $('#lockScreen').style.display='none';
          toast('Unlocked');
          enteredPin='';
          updatePinDots();
        } else {
          navigator.vibrate?.([80,50,80]);
          const card=$('.lock-card');
          card.classList.add('shake');
          setTimeout(()=>{card.classList.remove('shake');enteredPin='';updatePinDots();}, 450);
          toast('Incorrect PIN');
        }
      }
    }
  }
};
$('#pinBackspaceBtn').onclick=()=>{
  if(enteredPin.length>0){
    enteredPin=enteredPin.slice(0,-1);
    updatePinDots();
  }
};
$('#bioUnlockBtn').onclick=triggerBiometricUnlock;

// Security Settings Dialog
$('#openLockSettingsBtn').onclick=()=>{
  const isEnabled=localStorage.getItem('oc-lock-enabled')==='true';
  $('#lockEnabledCheckbox').checked=isEnabled;
  $('#pinConfigSection').style.display=isEnabled?'block':'none';
  $('#newPinInput').value='';
  $('#confirmPinInput').value='';
  if(window.PublicKeyCredential){
    $('#bioRow').style.display='block';
    $('#bioEnabledCheckbox').checked=localStorage.getItem('oc-bio-enabled')==='true';
  }
  $('#securityDialog').showModal();
};
$('#closeSecurity').onclick=()=>$('#securityDialog').close();

$('#lockEnabledCheckbox').onchange=e=>{
  $('#pinConfigSection').style.display=e.target.checked?'block':'none';
  if(!e.target.checked){
    localStorage.setItem('oc-lock-enabled','false');
    toast('App lock disabled');
  }
};

$('#savePinBtn').onclick=()=>{
  const isEnabled=$('#lockEnabledCheckbox').checked;
  if(!isEnabled){
    localStorage.setItem('oc-lock-enabled','false');
    $('#securityDialog').close();
    toast('Security settings saved');
    return;
  }
  const p1=$('#newPinInput').value.trim();
  const p2=$('#confirmPinInput').value.trim();
  if(!/^\d{4}$/.test(p1)){
    toast('Enter a valid 4-digit PIN.');
    return;
  }
  if(p1!==p2){
    toast('PINs do not match.');
    return;
  }
  localStorage.setItem('oc-pin', btoa(p1));
  localStorage.setItem('oc-lock-enabled','true');
  localStorage.setItem('oc-bio-enabled', $('#bioEnabledCheckbox').checked?'true':'false');
  $('#securityDialog').close();
  toast('App lock PIN saved successfully');
};

// General click handlers
document.addEventListener('click',async e=>{
  const goEl=e.target.closest('[data-go]'),edit=e.target.closest('[data-edit]'),fav=e.target.closest('[data-fav]'),op=e.target.closest('[data-open]'),disp=e.target.closest('[data-dispatch]');
  const cycle=e.target.closest('[data-cycle-status]');

  if(cycle){
    e.stopPropagation();
    const x=(await records()).find(r=>r.id===cycle.dataset.cycleStatus);
    if(x){
      const cur=x.status||'unfinished';
      x.status=STATUS_CONFIG[cur]?.next||'unfinished';
      x.updated=Date.now();
      await put(x);
      toast(`Marked as ${STATUS_CONFIG[x.status].label}`);
      render();
    }
    return;
  }

  if(disp){
    e.stopPropagation();
    const x=(await records()).find(r=>r.id===disp.dataset.dispatch);
    if(x) openDispatchModal(x);
    return;
  }

  if(goEl)go(goEl.dataset.go);
  if(edit){const x=(await records()).find(r=>r.id===edit.dataset.edit);if(x)openEditor(x.type,x)}
  if(fav){const x=(await records()).find(r=>r.id===fav.dataset.fav);if(x){x.favorite=!x.favorite;await put(x);render();toast(x.favorite?'Added to Favourites':'Removed from Favourites')}}
  if(op){const x=(await records()).find(r=>r.id===op.dataset.open);if(x?.type==='group')launchGroup(x.link);if(x?.type==='contact')launchContact(x.phone)}
});

$$('.nav-item').forEach(n=>n.addEventListener('click',()=>go(n.dataset.page)));
['groupSearch','contactSearch','noteSearch'].forEach(id=>$('#'+id).addEventListener('input',render));

$('#backupBtn').onclick=()=>$('#backupDialog').showModal();
$('#closeBackup').onclick=()=>$('#backupDialog').close();
$('#exportBtn').onclick=async()=>{const data=await records(),blob=new Blob([JSON.stringify({app:'Official Connect',version:1,exportedAt:new Date().toISOString(),records:data},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='official-connect-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);toast('Backup exported')};
$('#importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());const validRecord=x=>x&&typeof x.id==='string'&&['group','contact','note'].includes(x.type)&&typeof x.updated==='number'&&(['group','contact','note'].includes(x.type));if(!parsed||parsed.app!=='Official Connect'||!Array.isArray(parsed.records)||!parsed.records.every(validRecord))throw Error('Invalid backup');if(!confirm('Replace all current Official Connect data with this backup?'))return;const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);store.clear();parsed.records.forEach(x=>store.put(x));tx.oncomplete=()=>{toast('Backup restored');render()};tx.onerror=()=>toast('Restore failed. Existing data may be unchanged.')}catch(err){toast('Could not import: invalid backup file')}e.target.value=''};

// CSV Export and Import for Contacts
$('#exportCsvBtn').onclick=async()=>{
  const contacts=(await records()).filter(x=>x.type==='contact');
  if(!contacts.length){toast('No contacts to export.');return}
  const headers=['Name','Designation','Department','Phone','Favorite'];
  const rows=contacts.map(c=>[
    `"${(c.name||'').replace(/"/g,'""')}"`,
    `"${(c.designation||'').replace(/"/g,'""')}"`,
    `"${(c.department||'').replace(/"/g,'""')}"`,
    `"${(c.phone||'').replace(/"/g,'""')}"`,
    c.favorite?'Yes':'No'
  ].join(','));
  const csvContent=[headers.join(','), ...rows].join('\r\n');
  const blob=new Blob([csvContent],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;
  a.download='official-contacts-'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('Contacts CSV exported');
};

$('#importCsvFile').onchange=async e=>{
  const file=e.target.files[0];
  if(!file) return;
  try{
    const text=await file.text();
    const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if(lines.length<2) throw Error('Empty CSV');
    let imported=0;
    for(let i=1;i<lines.length;i++){
      const cols=lines[i].split(',').map(s=>s.trim().replace(/^"|"$/g,'').replace(/""/g,'"'));
      const [name, designation, department, phone, fav]=cols;
      if(name && phone){
        const digits=phone.replace(/\D/g,'');
        if(digits.length>=10){
          await put({
            type:'contact',
            id:uid(),
            name,
            designation:designation||'',
            department:department||'',
            phone:phone.startsWith('+')?phone:'+91 '+digits.slice(-10),
            favorite:String(fav).toLowerCase()==='yes'||String(fav).toLowerCase()==='true',
            updated:Date.now()
          });
          imported++;
        }
      }
    }
    toast(`Imported ${imported} contact${imported>1?'s':''} from CSV`);
    render();
    $('#backupDialog').close();
  }catch(err){
    toast('Could not import CSV: check format.');
  }
  e.target.value='';
};

// CSV Export and Import for Groups
$('#exportGroupsCsvBtn').onclick=async()=>{
  const groups=(await records()).filter(x=>x.type==='group');
  if(!groups.length){toast('No groups to export.');return}
  const headers=['Name','Department','Link','Favorite'];
  const rows=groups.map(g=>[
    `"${(g.name||'').replace(/"/g,'""')}"`,
    `"${(g.department||'').replace(/"/g,'""')}"`,
    `"${(g.link||'').replace(/"/g,'""')}"`,
    g.favorite?'Yes':'No'
  ].join(','));
  const csvContent=[headers.join(','), ...rows].join('\r\n');
  const blob=new Blob([csvContent],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;
  a.download='official-groups-'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('Groups CSV exported');
};

$('#importGroupsCsvFile').onchange=async e=>{
  const file=e.target.files[0];
  if(!file) return;
  try{
    const text=await file.text();
    const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if(lines.length<2) throw Error('Empty CSV');
    let imported=0;
    for(let i=1;i<lines.length;i++){
      const cols=lines[i].split(',').map(s=>s.trim().replace(/^"|"$/g,'').replace(/""/g,'"'));
      const [name, department, link, fav]=cols;
      if(name && link && link.includes('chat.whatsapp.com/')){
        await put({
          type:'group',
          id:uid(),
          name,
          department:department||'',
          link:link.startsWith('http')?link:'https://'+link,
          favorite:String(fav).toLowerCase()==='yes'||String(fav).toLowerCase()==='true',
          updated:Date.now()
        });
        imported++;
      }
    }
    toast(`Imported ${imported} group${imported>1?'s':''} from CSV`);
    render();
    $('#backupDialog').close();
  }catch(err){
    toast('Could not import Groups CSV: check format.');
  }
  e.target.value='';
};

// Web Share Target detection, App Lock check, and Service Worker init
(async()=>{
  try{
    initTheme();
    await openDB();
    await render();
    checkAppLock();
    
    // Check if opened via Web Share Target or PWA App Shortcuts
    const urlParams=new URLSearchParams(window.location.search);
    const sharedTitle=urlParams.get('title')||'';
    const sharedText=urlParams.get('text')||'';
    const sharedUrl=urlParams.get('url')||'';
    const action=urlParams.get('action')||'';
    const sharedContent=[sharedTitle, sharedText, sharedUrl].filter(Boolean).join('\n');
    
    if(sharedContent){
      openImportModal(sharedContent);
    } else if(action==='add-group'){
      go('groups');
      openEditor('group');
    } else if(action==='add-contact'){
      go('contacts');
      openEditor('contact');
    } else if(action==='add-note'){
      go('notes');
      openEditor('note');
    } else if(action==='import'){
      openImportModal();
    }
    
    if(window.location.search){
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }catch(e){
    console.error(e);
    toast('Storage unavailable in this browser');
  }
})();
