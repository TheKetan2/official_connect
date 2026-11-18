const DB_NAME='official-connect-db', STORE='records';
let db, currentPage='home', editing=null, toastTimer, detectedItems=[];
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
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
function waContact(phone){let p=phone.replace(/\D/g,'');if(p.length===10)p='91'+p;return 'https://wa.me/'+p}
function launchGroup(url){try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='chat.whatsapp.com'){toast('This is not a valid WhatsApp group link.');return}window.location.assign(u.href)}catch{toast('Add a valid WhatsApp group invitation link first.')}}
function launchContact(phone){const digits=String(phone||'').replace(/\D/g,'');if(!digits){toast('Add a phone number first.');return}window.location.assign(waContact(phone))}
function itemCard(x,type){const isNote=type==='note';let subtitle=isNote?(x.category||'Personal note'):[x.designation,x.department].filter(Boolean).join(' · ')||x.category||'';let actions=isNote?`<button class="mini-btn" data-edit="${x.id}" title="Edit">✎</button>`:`<button class="mini-btn ${x.favorite?'star':''}" data-fav="${x.id}" title="${x.favorite?'Remove favourite':'Add favourite'}">${x.favorite?'★':'☆'}</button><button class="mini-btn" data-edit="${x.id}" title="Edit">✎</button><button class="mini-btn open" data-open="${x.id}" title="Open in WhatsApp">↗</button>`;return `<article class="item-card ${isNote?'note-card':''}"><div class="item-icon">${isNote?'▧':type==='group'?'▤':initials(x.name)}</div><div class="item-main"><div class="item-title">${esc(x.name||'Untitled')}</div><div class="item-sub">${esc(subtitle)}</div>${isNote?`<div class="note-body">${esc(x.body||'')}</div><div class="note-meta">Updated ${new Date(x.updated||Date.now()).toLocaleDateString()}</div>`:''}</div><div class="item-actions">${actions}</div></article>`}
async function render(){const data=await records(),groups=data.filter(x=>x.type==='group'),contacts=data.filter(x=>x.type==='contact'),notes=data.filter(x=>x.type==='note'),favs=data.filter(x=>x.favorite&&x.type!=='note');$('#groupCount').textContent=groups.length;$('#contactCount').textContent=contacts.length;
const favMarkup=favs.slice(0,4).map(x=>itemCard(x,x.type)).join('');$('#homeFavourites').innerHTML=favMarkup||empty('Nothing pinned yet','Add a group or contact to Favourites for quick access.');
const filter=(arr,q)=>arr.filter(x=>(x.name+' '+(x.department||'')+' '+(x.designation||'')+' '+(x.category||'')+' '+(x.body||'')).toLowerCase().includes(q.toLowerCase()));
$('#groupsList').innerHTML=filter(groups,$('#groupSearch').value).map(x=>itemCard(x,'group')).join('')||empty('No groups added','Add a WhatsApp group invitation link to get started.');
$('#contactsList').innerHTML=filter(contacts,$('#contactSearch').value).map(x=>itemCard(x,'contact')).join('')||empty('No contacts added','Add important officials and colleagues here.');
$('#favouritesList').innerHTML=favs.map(x=>itemCard(x,x.type)).join('')||empty('Your priority list is empty','Tap the star on any group or contact to pin it here.');
$('#notesList').innerHTML=filter(notes,$('#noteSearch').value).sort((a,b)=>(b.updated||0)-(a.updated||0)).map(x=>itemCard(x,'note')).join('')||empty('No notes yet','Save important reference details, reminders and work information.');}

const schemas={group:{title:'Add official group',fields:[['name','Group name','text',true],['department','Department / category','text',false],['link','WhatsApp invite link','text',true]],hint:'Paste the group invitation URL (usually chat.whatsapp.com/…).'},contact:{title:'Add important contact',fields:[['name','Full name','text',true],['designation','Designation','text',false],['department','Department / office','text',false],['phone','Mobile number with country code','tel',true]],hint:'For Indian numbers, enter 10 digits or include +91.'},note:{title:'Add work note',fields:[['name','Note title','text',true],['category','Category','text',false],['body','Note details','textarea',true]]}};

function openEditor(type,item=null){editing={type,id:item?.id||null};const s=schemas[type];$('#modalEyebrow').textContent=item?'EDIT ENTRY':'NEW ENTRY';$('#modalTitle').textContent=item?'Edit '+type:s.title;$('#formFields').innerHTML=s.fields.map(([key,label,input,required])=>`<div class="field"><label for="f-${key}">${label}${required?' *':''}</label>${input==='textarea'?`<textarea id="f-${key}" name="${key}" ${required?'required':''}>${esc(item?.[key]||'')}</textarea>`:`<input id="f-${key}" name="${key}" type="${input}" value="${esc(item?.[key]||'')}" ${required?'required':''} ${key==='phone'?'inputmode="tel"':key==='link'?'inputmode="url" autocapitalize="none"':''}>`}</div>`).join('')+`<div class="field-hint">${s.hint||''}</div>`+(type!=='note'?`<label class="check-row"><input type="checkbox" name="favorite" ${item?.favorite?'checked':''}> Add to Favourites</label>`:'');$('#deleteEntry').hidden=!item;$('#editor').showModal()}

$('#editorForm').addEventListener('submit',async e=>{e.preventDefault();const type=editing.type,fd=new FormData(e.currentTarget),obj={type,id:editing.id||uid(),updated:Date.now()};schemas[type].fields.forEach(([k])=>obj[k]=String(fd.get(k)||'').trim());if(type!=='note')obj.favorite=fd.get('favorite')==='on';if(type==='group'){if(!/^https?:\/\//i.test(obj.link))obj.link='https://'+obj.link;try{const u=new URL(obj.link);if(u.protocol!=='https:'||u.hostname!=='chat.whatsapp.com'||u.pathname.length<2){toast('Use a valid https://chat.whatsapp.com/ invitation link.');return}obj.link=u.href}catch{toast('Please enter a valid WhatsApp group invitation link.');return}}if(type==='contact'){const digits=obj.phone.replace(/\D/g,'');if(!/^(?:[6-9]\d{9}|91[6-9]\d{9})$/.test(digits)){toast('Enter a valid Indian mobile number (10 digits or +91).');return}}await put(obj);$('#editor').close();e.target.reset();toast('Saved successfully');render()});
$('#closeModal').onclick=$('#cancelModal').onclick=()=>$('#editor').close();
$('#deleteEntry').onclick=async()=>{if(!editing?.id)return;if(!confirm('Delete this entry from Official Connect? This will not affect WhatsApp.'))return;await del(editing.id);$('#editor').close();toast('Entry deleted');render()};
$('#addGroup').onclick=()=>openEditor('group');$('#addContact').onclick=()=>openEditor('contact');$('#addNote').onclick=()=>openEditor('note');

// Smart WhatsApp Parser & Importer
function openImportModal(initialText=''){const dlg=$('#importDialog');if(!dlg)return;if(initialText){$('#importTextInput').value=initialText;parseImportText(initialText)}dlg.showModal()}
function closeImportModal(){const dlg=$('#importDialog');if(dlg)dlg.close()}

function parseImportText(text=''){
  detectedItems=[];
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const foundGroupLinks=new Set(), foundPhones=new Set();

  // 1. Check for vCard entries
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

  // 2. Scan lines for WhatsApp group invite links
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

  // 3. Scan lines for Phone numbers / wa.me links
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

// General click handlers
document.addEventListener('click',async e=>{
  const goEl=e.target.closest('[data-go]'),edit=e.target.closest('[data-edit]'),fav=e.target.closest('[data-fav]'),op=e.target.closest('[data-open]');
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

// Web Share Target detection & Service Worker init
(async()=>{
  try{
    await openDB();
    await render();
    
    // Check if opened via Web Share Target (from Android / WhatsApp share sheet)
    const urlParams=new URLSearchParams(window.location.search);
    const sharedTitle=urlParams.get('title')||'';
    const sharedText=urlParams.get('text')||'';
    const sharedUrl=urlParams.get('url')||'';
    const sharedContent=[sharedTitle, sharedText, sharedUrl].filter(Boolean).join('\n');
    if(sharedContent){
      openImportModal(sharedContent);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }catch(e){
    console.error(e);
    toast('Storage unavailable in this browser');
  }
})();
