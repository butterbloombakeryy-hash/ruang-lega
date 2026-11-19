
(function(){
'use strict';
const $=id=>document.getElementById(id);
const state={files:[],duplicates:[],duplicateBytes:0,installPrompt:null,guide:'windows'};
function bytes(n){if(!Number.isFinite(n)||n<0)return '—';if(n===0)return '0 B';const u=['B','KB','MB','GB','TB'];const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1);return (n/Math.pow(1024,i)).toLocaleString('id-ID',{maximumFractionDigits:i?1:0})+' '+u[i]}
function fileKind(f){const e=(f.name.split('.').pop()||'').toLowerCase();if(/^(jpg|jpeg|png|gif|webp|heic|svg)$/.test(e))return 'Gambar';if(/^(mp4|mov|mkv|avi|webm)$/.test(e))return 'Video';if(/^(mp3|wav|m4a|aac|flac)$/.test(e))return 'Audio';if(/^(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)$/.test(e))return 'Dokumen';if(/^(zip|rar|7z|tar|gz)$/.test(e))return 'Arsip';return 'Lainnya'}
function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,2800)}
function updateSummary(){const total=state.files.reduce((n,x)=>n+x.file.size,0);$('fileCount').textContent=state.files.length.toLocaleString('id-ID');$('totalSize').textContent=bytes(total);$('duplicateSize').textContent=bytes(state.duplicateBytes);$('scanDuplicates').disabled=state.files.length<2;$('exportCsv').disabled=!state.files.length;$('clearList').disabled=!state.files.length;$('fileSummary').textContent=state.files.length?state.files.length+' file · '+bytes(total):'Belum ada file dipilih'}
function renderFiles(){const root=$('fileRows');root.textContent='';const q=$('fileSearch').value.trim().toLowerCase();const sorted=state.files.filter(x=>x.file.name.toLowerCase().includes(q)).slice().sort((a,b)=>b.file.size-a.file.size);if(!sorted.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.className='empty';td.textContent=state.files.length?'Tidak ada nama file yang cocok dengan pencarian.':'Pilih file atau folder untuk memulai pemeriksaan.';tr.append(td);root.append(tr);updateSummary();return}const dupIds=new Set(state.duplicates.flatMap(g=>g.ids));for(const x of sorted){const tr=document.createElement('tr'),name=document.createElement('td'),type=document.createElement('td'),size=document.createElement('td'),nm=document.createElement('div'),meta=document.createElement('div'),tag=document.createElement('span');nm.className='fileName';nm.textContent=x.file.name;meta.className='fileMeta';meta.textContent=x.file.webkitRelativePath||x.file.type||'File lokal';name.append(nm,meta);tag.className='fileType';tag.textContent=fileKind(x.file);type.append(tag);if(dupIds.has(x.id)){const d=document.createElement('span');d.className='dupTag';d.textContent='Duplikat';type.append(d)}size.className='sizeCell';size.textContent=bytes(x.file.size);tr.append(name,type,size);root.append(tr)}updateSummary()}
function addFiles(files){let added=0;for(const f of files){const key=f.name+'|'+f.size+'|'+f.lastModified+'|'+(f.webkitRelativePath||'');if(state.files.some(x=>x.key===key))continue;state.files.push({id:String(Date.now())+Math.random().toString(36).slice(2),key,file:f,hash:null});added++}if(added){state.duplicates=[];state.duplicateBytes=0;$('scanStatus').textContent=added+' file ditambahkan. Pilih “Cari file kembar” untuk memeriksa salinan identik.';renderFiles();toast(added+' file ditambahkan')}else if(files.length)toast('File yang dipilih sudah ada di daftar')}
$('chooseFiles').addEventListener('click',()=>$('fileInput').click());$('chooseFolder').addEventListener('click',()=>{if('webkitdirectory'in $('folderInput'))$('folderInput').click();else toast('Browser ini belum mendukung pemilihan folder. Gunakan Pilih file.')});
$('fileInput').addEventListener('change',e=>{addFiles(Array.from(e.target.files||[]));e.target.value=''});
$('folderInput').addEventListener('change',e=>{addFiles(Array.from(e.target.files||[]));e.target.value=''});
$('clearList').addEventListener('click',()=>{state.files=[];state.duplicates=[];state.duplicateBytes=0;$('scanStatus').textContent='Daftar analisis dikosongkan. File asli pada perangkatmu tidak berubah.';renderFiles()});
$('fileSearch').addEventListener('input',renderFiles);
const drop=$('dropZone');['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));drop.addEventListener('drop',e=>addFiles(Array.from(e.dataTransfer.files||[])));
async function digest(file){const buffer=await file.arrayBuffer();const hash=await crypto.subtle.digest('SHA-256',buffer);return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('')}
$('scanDuplicates').addEventListener('click',async()=>{if(!crypto.subtle){$('scanStatus').textContent='Browser tidak menyediakan SHA-256. Buka website melalui HTTPS atau gunakan browser terbaru.';return}const btn=$('scanDuplicates');btn.disabled=true;btn.textContent='Memeriksa…';state.duplicates=[];state.duplicateBytes=0;const eligible=state.files.filter(x=>x.file.size<=50*1024*1024);let hashedBytes=0;try{for(let i=0;i<eligible.length;i++){const x=eligible[i];if(!x.hash){if(hashedBytes+x.file.size>300*1024*1024)continue;x.hash=await digest(x.file);hashedBytes+=x.file.size}$('scanStatus').textContent='Memeriksa sidik file '+(i+1)+' dari '+eligible.length+'…'}const groups=new Map();for(const x of eligible){if(!x.hash)continue;const key=x.file.size+':'+x.hash;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x.id)}for(const ids of groups.values()){if(ids.length>1){state.duplicates.push({ids});state.duplicateBytes+=ids.slice(1).reduce((n,id)=>n+state.files.find(x=>x.id===id).file.size,0)}}const skipped=state.files.length-eligible.length;$('scanStatus').textContent=state.duplicates.length?'Ditemukan '+state.duplicates.length+' kelompok file identik. Potensi ruang berulang '+bytes(state.duplicateBytes)+'. Tinjau file sebelum menghapus.':'Tidak ditemukan file identik pada file yang berhasil diperiksa.';if(skipped)$('scanStatus').textContent+=' '+skipped+' file lebih dari 50 MB dilewati.';renderFiles();toast('Pemeriksaan file selesai')}catch(err){$('scanStatus').textContent='Pemeriksaan gagal. Coba kurangi jumlah file atau gunakan browser yang lebih baru.'}finally{btn.disabled=state.files.length<2;btn.textContent='⌕ Cari file kembar'}});
$('exportCsv').addEventListener('click',()=>{const rows=[['Nama file','Lokasi relatif','Ukuran byte','Jenis','SHA-256','Status']];const dupIds=new Set(state.duplicates.flatMap(g=>g.ids));for(const x of state.files)rows.push([x.file.name,x.file.webkitRelativePath||'',x.file.size,fileKind(x.file),x.hash||'',dupIds.has(x.id)?'Duplikat':'Tidak terdeteksi']);const csv='\uFEFF'+rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='laporan-ruang-lega-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);toast('Laporan CSV berhasil dibuat')});
async function refreshStorage(){try{if(!navigator.storage||!navigator.storage.estimate)throw 0;const e=await navigator.storage.estimate(),u=e.usage||0,q=e.quota||0,p=q?Math.min(100,u/q*100):0;$('storageRing').style.setProperty('--pct',p);$('storagePercent').textContent=p.toLocaleString('id-ID',{maximumFractionDigits:1})+'%';$('storageUsed').textContent=bytes(u)+' digunakan';$('storageQuota').textContent='Dari estimasi kuota '+bytes(q)+' untuk situs ini';$('storageBar').style.width=p+'%'}catch(e){$('storagePercent').textContent='—%';$('storageUsed').textContent='Tidak tersedia';$('storageQuota').textContent='Browser tidak menyediakan estimasi penyimpanan situs.';$('storageBar').style.width='0%'}}
$('refreshStorage').addEventListener('click',()=>{refreshStorage();toast('Estimasi penyimpanan diperbarui')});refreshStorage();
function deviceInfo(){const ua=navigator.userAgent||'';let type='Desktop';if(/Android|iPhone|iPad|iPod|Mobile/i.test(ua))type=/iPad|Tablet/i.test(ua)?'Tablet':'HP';$('deviceType').textContent=type;$('folderSupport').textContent='webkitdirectory'in document.createElement('input')?'Didukung':'Pilih file';$('onlineState').textContent=navigator.onLine?'Online':'Offline'}
deviceInfo();window.addEventListener('online',deviceInfo);window.addEventListener('offline',deviceInfo);

/* v1.6 safe folder cleanup */
const cleanupState={root:null,items:[],scanned:0,capped:false};
const skipCleanupFolders=new Set(['RECYCLE.BIN','SYSTEM VOLUME INFORMATION','WINDOWS','PROGRAM FILES','PROGRAM FILES (X86)','PROGRAMDATA','SYSTEM','LIBRARY','.GIT','NODE_MODULES','ANDROID','ANDROID DATA','ANDROID OBB']);
function trashRule(name,lastModified){
 const lower=name.toLowerCase();
 const ageDays=(Date.now()-(Number(lastModified)||Date.now()))/86400000;
 if(['.ds_store','thumbs.db','desktop.ini'].includes(lower))return 'Metadata sistem folder';
 if(name.charCodeAt(0)===126&&name.charCodeAt(1)===36&&ageDays>=2)return 'File kunci Office lama (2+ hari)';
 if(/\.(tmp|temp|part|partial|crdownload|download)$/i.test(lower)&&ageDays>=7)return 'File sementara/unduhan tidak lengkap (7+ hari)';
 return '';
}
function updateTrashStats(){
 const selected=cleanupState.items.filter(x=>x.selected);
 $('trashScanned').textContent=cleanupState.scanned.toLocaleString('id-ID');
 $('trashFound').textContent=cleanupState.items.length.toLocaleString('id-ID');
 $('trashBytes').textContent=bytes(cleanupState.items.reduce((n,x)=>n+x.size,0));
 $('cleanTrashBtn').disabled=!selected.length||!cleanupState.root;
 $('selectAllTrashBtn').disabled=!cleanupState.items.length;
 $('clearTrashSelectionBtn').disabled=!selected.length;
}
function renderTrashList(){
 const root=$('trashList');root.textContent='';
 if(!cleanupState.items.length){
  const empty=document.createElement('div');empty.className='empty';
  empty.textContent=cleanupState.root?'Tidak ditemukan kandidat berdasarkan aturan sampah aman. Tidak ada file yang diubah.':'Tekan “Pindai Sampah” lalu pilih folder yang ingin diperiksa.';
  root.append(empty);updateTrashStats();return;
 }
 cleanupState.items.forEach(item=>{
  const row=document.createElement('label');row.className='cleanupRow';
  const check=document.createElement('input');check.type='checkbox';check.checked=!!item.selected;
  check.addEventListener('change',()=>{item.selected=check.checked;updateTrashStats()});
  const main=document.createElement('span');main.className='cleanupRowMain';
  const name=document.createElement('span');name.className='cleanupRowName';name.textContent=item.name;
  const path=document.createElement('span');path.className='cleanupRowPath';path.textContent=item.path+' · '+item.reason;
  main.append(name,path);
  const size=document.createElement('span');size.className='cleanupRowSize';size.textContent=bytes(item.size);
  row.append(check,main,size);root.append(row);
 });
 updateTrashStats();
}
async function walkCleanupFolder(dir,path){
 for await(const [name,handle] of dir.entries()){
  if(cleanupState.scanned>=5000){cleanupState.capped=true;return}
  const nextPath=path?path+'/'+name:name;
  if(handle.kind==='directory'){
   if(skipCleanupFolders.has(name.toUpperCase()))continue;
   await walkCleanupFolder(handle,nextPath);
   if(cleanupState.capped)return;
  }else if(handle.kind==='file'){
   cleanupState.scanned++;
   try{
    const file=await handle.getFile();
    const reason=trashRule(name,file.lastModified);
    if(reason)cleanupState.items.push({id:cleanupState.items.length,name,path:nextPath,size:file.size,reason,parent:dir,selected:false});
   }catch(_){}
  }
 }
}
$('scanTrashBtn').addEventListener('click',async()=>{
 if(!window.isSecureContext||typeof window.showDirectoryPicker!=='function'){
  $('trashStatus').textContent='Browser ini belum mendukung pemindaian folder yang dapat dihapus. Gunakan Chrome atau Edge terbaru di komputer melalui HTTPS. Pemilih file biasa tetap tersedia untuk analisis tanpa penghapusan.';
  toast('Pemindaian folder memerlukan browser desktop yang mendukung izin folder.');return;
 }
 try{
  const root=await window.showDirectoryPicker({id:'ruang-lega-cleanup',mode:'readwrite'});
  let permission=await root.queryPermission({mode:'readwrite'});
  if(permission!=='granted')permission=await root.requestPermission({mode:'readwrite'});
  if(permission!=='granted'){$('trashStatus').textContent='Izin baca dan tulis folder tidak diberikan. Tidak ada file yang diubah.';return}
  cleanupState.root=root;cleanupState.items=[];cleanupState.scanned=0;cleanupState.capped=false;
  $('trashFolderLabel').textContent='Folder diperiksa: '+root.name;
  $('trashStatus').textContent='Memindai nama dan ukuran file… hanya folder yang kamu pilih yang diperiksa.';
  $('scanTrashBtn').disabled=true;$('scanTrashBtn').textContent='Memindai…';
  await walkCleanupFolder(root,'');
  renderTrashList();
  $('trashStatus').textContent='Pemindaian selesai. '+cleanupState.items.length+' kandidat ditemukan dari '+cleanupState.scanned+' file. Pilih hanya file yang kamu yakin tidak dibutuhkan.';
  if(cleanupState.capped)$('trashStatus').textContent+=' Batas 5.000 file tercapai; sebagian isi folder mungkin belum dipindai.';
  toast('Pemindaian sampah selesai');
 }catch(error){
  if(error&&error.name==='AbortError')$('trashStatus').textContent='Pemilihan folder dibatalkan. Tidak ada perubahan.';
  else $('trashStatus').textContent='Folder tidak dapat dipindai. Pastikan izin diberikan dan coba folder lain.';
 }finally{$('scanTrashBtn').disabled=false;$('scanTrashBtn').textContent='⌕ Pindai Sampah'}
});
$('selectAllTrashBtn').addEventListener('click',()=>{cleanupState.items.forEach(x=>x.selected=true);renderTrashList()});
$('clearTrashSelectionBtn').addEventListener('click',()=>{cleanupState.items.forEach(x=>x.selected=false);renderTrashList()});
$('cleanTrashBtn').addEventListener('click',async()=>{
 const selected=cleanupState.items.filter(x=>x.selected);
 if(!selected.length||!cleanupState.root)return;
 const estimated=selected.reduce((n,x)=>n+x.size,0);
 if(!confirm('Hapus '+selected.length+' file kandidat dari folder “'+cleanupState.root.name+'”?\nEstimasi ruang yang dapat dibebaskan: '+bytes(estimated)+'.\n\nPenghapusan tidak selalu dapat dibatalkan. Pastikan daftar sudah diperiksa.'))return;
 try{
  let permission=await cleanupState.root.queryPermission({mode:'readwrite'});
  if(permission!=='granted')permission=await cleanupState.root.requestPermission({mode:'readwrite'});
  if(permission!=='granted'){$('trashStatus').textContent='Izin tulis folder tidak tersedia. Tidak ada file yang dihapus.';return}
  $('cleanTrashBtn').disabled=true;$('cleanTrashBtn').textContent='Membersihkan…';
  let removed=0,freed=0;const failed=[];
  for(const item of selected){
   try{await item.parent.removeEntry(item.name);removed++;freed+=item.size}
   catch(_){failed.push(item)}
  }
  cleanupState.items=cleanupState.items.filter(x=>!selected.includes(x)||failed.includes(x));
  cleanupState.items.forEach(x=>x.selected=false);
  renderTrashList();
  $('trashStatus').textContent='Selesai: '+removed+' file dihapus, estimasi '+bytes(freed)+' dibebaskan.'+(failed.length?' '+failed.length+' file gagal dihapus atau sudah berubah.':'');
  toast(removed+' file sampah dibersihkan');
 }catch(error){$('trashStatus').textContent='Pembersihan tidak dapat dilanjutkan. Periksa izin folder dan coba lagi.'}
 finally{$('cleanTrashBtn').textContent='✦ Bersihkan yang dipilih';updateTrashStats()}
});

/* Native Android cache tools */
function hasNativeAndroid(){return !!(window.AndroidBridge&&typeof AndroidBridge.getDeviceStorageSnapshot==='function')}
function refreshNativeAndroid(){
 const panel=$('nativeAndroidCleanup');if(!panel||!hasNativeAndroid())return;
 panel.hidden=false;
 let usage=false,allFiles=false;
 try{usage=AndroidBridge.hasUsageAccess();allFiles=AndroidBridge.hasAllFilesAccess()}catch(_){}
 $('nativePermissionStatus').textContent=usage?(allFiles?'Izin siap':'Usage access aktif'):'Perlu izin';
}
window.RuangLegaNativeRefreshPermissions=refreshNativeAndroid;
window.RuangLegaNativeCacheResult=function(result){
 $('nativeCleanupStatus').textContent=result===-1?'Android melaporkan kesalahan saat membersihkan cache.':result===0?'Pembersihan dibatalkan atau tidak disetujui.':'Permintaan pembersihan selesai. Pindai ulang untuk memeriksa ukuran cache.';
};
$('nativeScanAppsBtn').addEventListener('click',()=>{
 if(!hasNativeAndroid())return;
 if(!AndroidBridge.hasUsageAccess()){
  $('nativeCleanupStatus').textContent='Aktifkan Usage access di Pengaturan Android, lalu kembali dan tekan Pindai lagi.';
  AndroidBridge.requestUsageAccess();return;
 }
 $('nativeScanAppsBtn').disabled=true;$('nativeCleanupStatus').textContent='Membaca statistik aplikasi dari Android…';
 try{
  const result=JSON.parse(AndroidBridge.scanInstalledApps());
  if(!result.ok){$('nativeCleanupStatus').textContent='Pemindaian belum bisa dilakukan: '+(result.error||'kesalahan tidak diketahui');return}
  const apps=Array.isArray(result.apps)?result.apps:[],sum=apps.reduce((n,a)=>n+(Number(a.cacheBytes)||0),0);
  $('nativeAppCount').textContent=apps.length.toLocaleString('id-ID');$('nativeCacheTotal').textContent=bytes(sum);
  const root=$('nativeCacheList');root.textContent='';
  if(!apps.length){const e=document.createElement('div');e.className='empty';e.textContent='Android tidak memberikan daftar aplikasi yang dapat ditampilkan.';root.append(e)}
  apps.slice(0,100).forEach(app=>{
   const row=document.createElement('div');row.className='cleanupRow';
   const main=document.createElement('span');main.className='cleanupRowMain';
   const name=document.createElement('span');name.className='cleanupRowName';name.textContent=app.appName||app.packageName;
   const pkg=document.createElement('span');pkg.className='cleanupRowPath';pkg.textContent=app.packageName+' · Data '+bytes(Number(app.dataBytes)||0);
   main.append(name,pkg);
   const size=document.createElement('span');size.className='cleanupRowSize';size.textContent='Cache '+bytes(Number(app.cacheBytes)||0);
   const open=document.createElement('button');open.className='btn outline';open.textContent='Kelola';open.addEventListener('click',()=>AndroidBridge.openAppSettings(app.packageName));
   row.append(main,size,open);root.append(row);
  });
  $('nativeCleanupStatus').textContent='Selesai memeriksa '+apps.length+' aplikasi. Ini adalah ukuran cache yang dilaporkan Android, bukan bukti semua cache aman dihapus.';
 }catch(_){$('nativeCleanupStatus').textContent='Pemindaian gagal. Coba tutup dan buka kembali aplikasi.'}
 finally{$('nativeScanAppsBtn').disabled=false;refreshNativeAndroid()}
});
$('nativeClearCacheBtn').addEventListener('click',()=>{
 if(!hasNativeAndroid())return;
 if(!AndroidBridge.hasAllFilesAccess()){
  $('nativeCleanupStatus').textContent='Android meminta izin khusus sebelum menampilkan konfirmasi pembersihan cache.';
  AndroidBridge.requestAllFilesAccess();return;
 }
 if(!confirm('Minta Android membersihkan cache aplikasi yang diizinkan? Android akan menampilkan konfirmasi sistem. Data pribadi aplikasi tidak diminta untuk dihapus.'))return;
 const response=AndroidBridge.requestClearExternalCaches();
 $('nativeCleanupStatus').textContent=response==='system_confirmation_requested'?'Layar konfirmasi Android sedang dibuka. Setujui hanya bila ingin melanjutkan.':response==='unsupported'?'Fitur massal memerlukan Android 11 atau lebih baru.':'Android belum mengizinkan permintaan ini. Periksa izin dan kompatibilitas perangkat.';
});
$('nativeClearOwnCacheBtn').addEventListener('click',()=>{
 if(!hasNativeAndroid())return;
 if(confirm('Bersihkan file cache sementara milik aplikasi RUANG LEGA saja? Data dan file aplikasi lain tidak akan dihapus.')){AndroidBridge.clearOwnCache();$('nativeCleanupStatus').textContent='Pembersihan cache RUANG LEGA diminta. Periksa notifikasi Android.'}
});
refreshNativeAndroid();

let nativeAutoCleanupEnabled=true;
function niceTime(value){
 if(!value)return 'Belum ada';
 try{return new Date(Number(value)).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}catch(_){return 'Tidak tersedia'}
}
function renderNativeAutoCleanup(){
 if(!hasNativeAndroid())return;
 try{
  const info=JSON.parse(AndroidBridge.getAutoCacheCleanupStatus());
  nativeAutoCleanupEnabled=!!info.enabled;
  $('nativeAutoCleanupToggle').textContent=nativeAutoCleanupEnabled?'Otomatis aktif':'Otomatis nonaktif';
  $('nativeAutoCleanupToggle').className=nativeAutoCleanupEnabled?'btn primary autoCleanupToggle':'btn outline autoCleanupToggle';
  $('nativeAutoCleanupInterval').textContent=(info.intervalHours||24)+' jam';
  $('nativeAutoCleanupLast').textContent=niceTime(info.lastRunMillis);
  $('nativeAutoCleanupFreed').textContent=bytes(Number(info.lastFreedBytes)||0);
  $('nativeAutoCleanupStatus').textContent=nativeAutoCleanupEnabled
   ?'Aktif: berjalan saat diperlukan ketika aplikasi dibuka, setelah versi berubah, dan dijadwalkan setiap 24 jam.'
   :'Nonaktif: pembersihan otomatis dijeda. Pembersihan manual tetap tersedia.';
  const root=$('nativeAutoCleanupLogs');root.textContent='';
  const logs=Array.isArray(info.logs)?info.logs.slice(-8).reverse():[];
  if(!logs.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Belum ada riwayat pembersihan.';root.append(empty)}
  logs.forEach(log=>{
   const row=document.createElement('div');row.className='autoCleanupLog';
   const dot=document.createElement('span');dot.className='autoCleanupDot'+(log.status==='gagal'?' warn':'');
   const body=document.createElement('span');body.style.minWidth='0';body.style.flex='1';
   const title=document.createElement('b');title.textContent=(log.trigger||'Pembersihan')+' · '+(log.status||'');
   const detail=document.createElement('small');detail.textContent=niceTime(log.time)+' · '+bytes(Number(log.freedBytes)||0)+' · '+(log.details||'');
   body.append(title,detail);row.append(dot,body);root.append(row);
  });
 }catch(_){$('nativeAutoCleanupStatus').textContent='Log pembersihan belum dapat dibaca.'}
}
window.RuangLegaNativeRefreshAutoCleanup=renderNativeAutoCleanup;
$('nativeAutoCleanupToggle').addEventListener('click',()=>{
 if(!hasNativeAndroid())return;
 AndroidBridge.setAutoCacheCleanupEnabled(!nativeAutoCleanupEnabled);
});
renderNativeAutoCleanup();

const WEB_CLEANUP_VERSION='1.9.0';
const WEB_CLEANUP_CACHE='ruang-lega-v1-9-auto';
const WEB_CLEANUP_LOG_KEY='ruang-lega-web-cleanup-logs';
const WEB_CLEANUP_LAST_KEY='ruang-lega-web-cleanup-last';
const WEB_CLEANUP_VERSION_KEY='ruang-lega-web-cleanup-version';
function addWebCleanupLog(trigger,status,removed,details){
 try{
  const logs=JSON.parse(localStorage.getItem(WEB_CLEANUP_LOG_KEY)||'[]');
  logs.push({time:Date.now(),trigger,status,removed,details});
  localStorage.setItem(WEB_CLEANUP_LOG_KEY,JSON.stringify(logs.slice(-20)));
 }catch(_){}
}
function renderWebCleanupLogs(){
 const root=$('webAutoCleanupLogs');if(!root)return;
 root.textContent='';
 let logs=[];
 try{logs=JSON.parse(localStorage.getItem(WEB_CLEANUP_LOG_KEY)||'[]')}catch(_){}
 if(!logs.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Belum ada log.';root.append(empty);return}
 logs.slice(-6).reverse().forEach(log=>{
  const row=document.createElement('div');row.className='autoCleanupLog';
  const dot=document.createElement('span');dot.className='autoCleanupDot'+(log.status==='gagal'?' warn':'');
  const body=document.createElement('span');body.style.minWidth='0';body.style.flex='1';
  const title=document.createElement('b');title.textContent=(log.trigger||'Pemeriksaan')+' · '+(log.status||'');
  const detail=document.createElement('small');detail.textContent=niceTime(log.time)+' · '+(log.removed||0)+' cache lama · '+(log.details||'');
  body.append(title,detail);row.append(dot,body);root.append(row);
 });
}
async function runWebAutoCleanup(force=false,trigger='Saat website dibuka'){
 const status=$('webAutoCleanupStatus');
 const now=Date.now();
 let prior=0,oldVersion='';
 try{prior=Number(localStorage.getItem(WEB_CLEANUP_LAST_KEY)||0);oldVersion=localStorage.getItem(WEB_CLEANUP_VERSION_KEY)||''}catch(_){}
 const versionChanged=oldVersion!==WEB_CLEANUP_VERSION;
 if(!force&&!versionChanged&&prior>0&&(now-prior)<24*60*60*1000){
  if(status)status.textContent='Pemeriksaan otomatis terakhir masih dalam 24 jam terakhir. Cache versi terbaru dipertahankan.';
  renderWebCleanupLogs();return;
 }
 if(status)status.textContent='Pembersihan cache offline versi lama sedang berjalan…';
 try{
  let removed=0;
  if('caches'in window){
   const keys=await caches.keys();
   const obsolete=keys.filter(key=>key.startsWith('ruang-lega-temp-')&&key!==WEB_CLEANUP_CACHE);
   for(const key of obsolete){if(await caches.delete(key))removed++}
   const activeCache=await caches.open(WEB_CLEANUP_CACHE);
   const keepUrls=new Set([
    new URL('./',location.href).href,
    new URL('./index.html',location.href).href,
    new URL('./manifest.webmanifest',location.href).href,
    new URL('./icons/ruang-lega.svg',location.href).href
   ]);
   const requests=await activeCache.keys();
   for(const request of requests){
    if(!keepUrls.has(request.url)&&await activeCache.delete(request))removed++;
   }
  }
  const details=removed
    ?'Cache sementara/runtime lama milik RUANG LEGA dihapus; shell offline, manifest, dan ikon inti dipertahankan.'
    :'Tidak ada cache runtime lama yang perlu dibuang. Shell offline tetap dipertahankan; cache versi lama dibersihkan saat Service Worker baru aktif.';
  addWebCleanupLog(trigger,removed?'selesai':'diperiksa',removed,details);
  try{
   localStorage.setItem(WEB_CLEANUP_LAST_KEY,String(now));
   localStorage.setItem(WEB_CLEANUP_VERSION_KEY,WEB_CLEANUP_VERSION);
  }catch(_){}
  if(status)status.textContent='Pemeriksaan selesai. '+removed+' cache versi lama dibersihkan. File pengguna dan data situs tetap aman.';
  if(removed)toast(removed+' cache offline versi lama dibersihkan.');
 }catch(error){
  addWebCleanupLog(trigger,'gagal',0,'Browser tidak mengizinkan pembersihan Cache Storage: '+String(error&&error.message||error));
  if(status)status.textContent='Pembersihan cache web tidak dapat dilakukan pada browser ini.';
 }
 renderWebCleanupLogs();
}
$('webAutoCleanupNow').addEventListener('click',()=>runWebAutoCleanup(true,'Pembersihan manual'));
let savedWebVersion='';try{savedWebVersion=localStorage.getItem(WEB_CLEANUP_VERSION_KEY)||''}catch(_){}
runWebAutoCleanup(false,savedWebVersion!==WEB_CLEANUP_VERSION?'Pembaruan versi website':'Saat website dibuka');


async function registerWebPeriodicCleanup(){
 if(!('serviceWorker'in navigator))return;
 try{
  const registration=await navigator.serviceWorker.ready;
  if(!registration.periodicSync||typeof registration.periodicSync.register!=='function'){
   const el=$('webAutoCleanupStatus');
   if(el)el.textContent='Pembersihan otomatis berjalan saat website dibuka. Browser ini tidak mendukung jadwal background 24 jam.';
   return;
  }
  const tags=await registration.periodicSync.getTags();
  if(!tags.includes('ruang-lega-cache-cleanup')){
   await registration.periodicSync.register('ruang-lega-cache-cleanup',{minInterval:24*60*60*1000});
  }
  const el=$('webAutoCleanupStatus');
  if(el)el.textContent='Jadwal background 24 jam terdaftar (jika browser mengizinkan). Pemeriksaan saat website dibuka tetap aktif sebagai cadangan.';
 }catch(error){
  const el=$('webAutoCleanupStatus');
  if(el)el.textContent='Jadwal background tidak diizinkan browser. Pembersihan tetap berjalan saat website dibuka.';
 }
}
if('serviceWorker'in navigator){
 navigator.serviceWorker.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type!=='RUANG_LEGA_AUTO_CACHE_CLEANUP')return;
  addWebCleanupLog(data.trigger||'Jadwal background 24 jam','selesai',Number(data.removed)||0,'Cache sementara/runtime dibersihkan; shell offline utama dipertahankan.');
  renderWebCleanupLogs();
  const status=$('webAutoCleanupStatus');
  if(status)status.textContent='Pembersihan background selesai. '+(Number(data.removed)||0)+' entri cache lama dibersihkan; shell offline dipertahankan.';
 });
 registerWebPeriodicCleanup();
}

const guides={windows:{steps:['Buka Settings → System → Storage untuk melihat kategori penggunaan ruang.','Pilih Temporary files untuk meninjau file sementara yang dapat dibersihkan.','Buka File Explorer → Downloads dan urutkan berdasarkan Size untuk mencari file besar.','Periksa Recycle Bin dan cadangkan dokumen penting sebelum menghapus.'],note:'Hindari menghapus folder Windows, Program Files, atau file sistem yang tidak dikenal.'},
mac:{steps:['Buka menu Apple → System Settings → General → Storage.','Tinjau kategori Documents, Applications, dan Trash.','Buka Finder dan gunakan Sort by Size untuk menemukan file besar.','Kosongkan Trash hanya setelah memastikan file tidak lagi dibutuhkan.'],note:'Jangan menghapus Library atau folder sistem secara manual jika tidak memahami fungsinya.'},
android:{steps:['Buka Pengaturan → Penyimpanan untuk melihat ruang perangkat.','Masuk ke Pengaturan → Aplikasi → pilih aplikasi terkait.','Pilih Penyimpanan → Hapus cache jika ingin membersihkan file sementara.','Periksa folder Downloads dan media yang sudah dicadangkan.'],note:'Jangan pilih Hapus data/Clear storage kecuali siap kehilangan data lokal atau harus masuk ulang.'},
iphone:{steps:['Buka Pengaturan → Umum → Penyimpanan iPhone/iPad.','Tinjau aplikasi yang menggunakan ruang paling besar.','Gunakan Offload App jika ingin melepas aplikasi sambil mempertahankan dokumen dan data.','Tinjau Foto, Pesan, dan Unduhan setelah memastikan ada cadangan.'],note:'Offload App berbeda dari Delete App. iOS tidak menyediakan tombol hapus cache untuk semua aplikasi.'}
};
function renderGuide(which){state.guide=which;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.guide===which));const g=guides[which],root=$('guideContent');root.textContent='';const ol=document.createElement('ol');g.steps.forEach(s=>{const li=document.createElement('li');li.textContent=s;ol.append(li)});const note=document.createElement('div');note.className='safety';note.textContent=g.note;root.append(ol,note)}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>renderGuide(b.dataset.guide)));renderGuide('windows');
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>{const el=$(b.dataset.jump);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})}));
document.querySelectorAll('.nav a,.mobileDock a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.nav a,.mobileDock a').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.nav a[href="'+a.getAttribute('href')+'"],.mobileDock a[href="'+a.getAttribute('href')+'"]').forEach(x=>x.classList.add('active'))}));
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;$('installBtn').hidden=false});
$('installBtn').addEventListener('click',async()=>{if(!state.installPrompt)return;state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;$('installBtn').hidden=true});
if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{}));
})();
