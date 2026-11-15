const videos=[
 {title:'7 secrets de Minecraft que tu ignores sûrement',platform:'YouTube',type:'Short',date:'2026-11-07',views:186400,likes:14200,comments:684,engagement:8.4},
 {title:'Le mob le plus sous-coté du jeu ?',platform:'TikTok',type:'Vidéo',date:'2026-11-06',views:142800,likes:18300,comments:920,engagement:13.5},
 {title:'L’histoire mystérieuse de la pomme dorée',platform:'YouTube',type:'Short',date:'2026-11-04',views:98400,likes:8100,comments:402,engagement:8.7},
 {title:'3 détails cachés dans les villages',platform:'Instagram',type:'Reel',date:'2026-11-03',views:76500,likes:6200,comments:318,engagement:9.1},
 {title:'Top 10 des biomes Minecraft',platform:'YouTube',type:'Vidéo',date:'2026-10-31',views:62400,likes:4900,comments:270,engagement:8.3},
 {title:'Tu connaissais cette astuce ?',platform:'TikTok',type:'Vidéo',date:'2026-10-29',views:58900,likes:7100,comments:510,engagement:12.9},
 {title:'Patrick a encore fait n’importe quoi',platform:'Instagram',type:'Reel',date:'2026-10-27',views:48200,likes:3900,comments:221,engagement:8.5},
 {title:'Pourquoi cette structure est si rare',platform:'YouTube',type:'Short',date:'2026-10-25',views:43700,likes:3400,comments:188,engagement:8.2},
 {title:'Le secret des renards',platform:'TikTok',type:'Vidéo',date:'2026-10-22',views:39200,likes:5200,comments:380,engagement:14.2},
 {title:'Les sons les plus étranges',platform:'Instagram',type:'Reel',date:'2026-10-19',views:31400,likes:2500,comments:144,engagement:8.4},
 {title:'Une mécanique Create incroyable',platform:'YouTube',type:'Short',date:'2026-10-16',views:28900,likes:2100,comments:130,engagement:7.7},
 {title:'Le saviez-vous : les chèvres',platform:'TikTok',type:'Vidéo',date:'2026-10-12',views:21400,likes:2800,comments:170,engagement:13.9}
];
let youtubeData=null;
let youtubeVideos=[];
const escapeHTML=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');
const fmt=n=>n>=1e6?(n/1e6).toFixed(2).replace('.',',')+' M':n>=1e3?(n/1e3).toFixed(n>=1e5?0:1).replace('.',',')+' K':String(n);
const platformClass=p=>p==='YouTube'?'yt':p==='TikTok'?'tt':'ig';
function row(v,full=false){return `<tr><td><div class="video-cell"><div class="video-thumb">${v.platform==='YouTube'?'▶':v.platform==='TikTok'?'♪':'◎'}</div><div><b>${escapeHTML(v.title)}</b><small>${escapeHTML(v.type)}</small></div></div></td>${full?`<td><span class="platform-tag">${v.platform}</span></td><td>${new Date(v.date+'T12:00:00').toLocaleDateString('fr-BE',{day:'2-digit',month:'short'})}</td>`:`<td><span class="platform-tag">${v.platform}</span></td>`}<td>${fmt(v.views)}</td><td>${fmt(v.likes)}</td>${full?`<td>${v.engagement.toFixed(1).replace('.',',')} %</td>`:`<td>${v.comments.toLocaleString('fr-BE')}</td>`}</tr>`}
function currentVideos(){return [...videos.filter(v=>v.platform!=='YouTube'),...(youtubeData?youtubeVideos:videos.filter(v=>v.platform==='YouTube'))]}
function renderTables(){const all=currentVideos();document.querySelector('#topVideos').innerHTML=[...all].sort((a,b)=>b.views-a.views).slice(0,4).map(v=>row(v)).join('');['YouTube','TikTok','Instagram'].forEach(p=>{const id=p.toLowerCase()+'Videos';const source=p==='YouTube'&&youtubeData?youtubeVideos:videos.filter(v=>v.platform===p);document.getElementById(id).innerHTML=source.map(v=>row(v)).join('')});renderAllVideos()}

async function loadYoutube(){
 const days=document.getElementById('dateRange')?.value||'30';
 const statusLine=document.getElementById('youtubeDataStatus');
 try{
  const response=await fetch('/api/youtube/dashboard?days='+encodeURIComponent(days),{credentials:'same-origin',cache:'no-store'});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Erreur de synchronisation YouTube.');
  youtubeData=data;
  youtubeVideos=(data.videos||[]).map(v=>({title:v.title,platform:'YouTube',type:'Vidéo',date:v.date||'',views:v.views||0,likes:v.likes||0,comments:v.comments||0,engagement:v.views?((v.likes+v.comments)/v.views*100):0}));
  const status=document.getElementById('youtubeStatus'),button=document.getElementById('connectYoutube');
  if(status){status.textContent='Connecté';status.classList.add('connected')}
  if(button){button.textContent='Compte connecté';button.disabled=true}
  const cards=document.querySelectorAll('#page-youtube .compact-stats .stat-card');
  const values=[data.channel?.subscribers==null?'Masqué':fmt(data.channel.subscribers),fmt(data.analytics?.views||0),fmt(data.analytics?.likes||0),fmt((data.analytics?.estimatedMinutesWatched||0)/60)+' h'];
  const captions=['abonnés actuels','vues sur '+days+' jours','likes sur '+days+' jours','heures sur '+days+' jours'];
  cards.forEach((card,i)=>{if(values[i]!==undefined){card.querySelector('.stat-value').textContent=values[i];const foot=card.querySelector('.stat-bottom');if(foot)foot.innerHTML='<span class="trend positive">Données réelles</span><span>'+captions[i]+'</span>'}});
  const title=document.querySelector('#page-youtube h1');if(title)title.textContent=(data.channel?.title||'YouTube')+' Analytics.';
  const note=document.querySelector('#page-youtube .platform-note p');
  if(note)note.textContent=data.analyticsWarning||('Chaîne connectée : '+(data.channel?.title||'YouTube')+'. '+(data.channel?.videoCount||0)+' vidéos au total. Synchronisé le '+new Date(data.syncedAt).toLocaleString('fr-BE')+'.');
  const noteTitle=document.querySelector('#page-youtube .platform-note b');if(noteTitle)noteTitle.textContent='Chaîne YouTube connectée';
  const updated=document.querySelector('.updated-label');if(updated)updated.textContent='◷ YouTube synchronisé';
  const live=document.querySelector('.live-status');if(live)live.innerHTML='<span class="pulse"></span>YOUTUBE LIVE';
  const syncTitle=document.querySelector('.sync-top b');if(syncTitle)syncTitle.textContent='YouTube synchronisé';
  const syncText=document.querySelector('.sync-card p');if(syncText)syncText.textContent='Les statistiques YouTube sont importées depuis ton compte Google. TikTok et Instagram restent en démonstration.';
  const listCaption=document.querySelector('#page-youtube .panel:last-child .panel-heading p');if(listCaption)listCaption.textContent=youtubeVideos.length+' vidéos récentes récupérées depuis ta chaîne';
  if(statusLine)statusLine.textContent=data.analyticsWarning||'Statistiques actualisées.';
  renderTables();
 }catch(error){
  if(statusLine)statusLine.textContent=error.message;
  if(!error.message.includes('Session')&&!error.message.includes('Reconnecte'))toast(error.message);
 }
}

function renderAllVideos(){let list=currentVideos(),q=(document.querySelector('#videoSearch')?.value||'').toLowerCase(),p=document.querySelector('#platformFilter')?.value||'all',s=document.querySelector('#sortFilter')?.value||'views';list=list.filter(v=>v.title.toLowerCase().includes(q)&&(p==='all'||v.platform===p));list.sort((a,b)=>s==='likes'?b.likes-a.likes:s==='recent'?b.date.localeCompare(a.date):b.views-a.views);document.querySelector('#allVideos').innerHTML=list.map(v=>row(v,true)).join('')||'<tr><td colspan="6">Aucun résultat.</td></tr>';document.querySelector('#videoCount').textContent=`${list.length} publication${list.length>1?'s':''}`}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function navigate(page){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById('page-'+page)?.classList.add('active');document.querySelectorAll('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.page===page));const labels={overview:'Vue générale',youtube:'YouTube',tiktok:'TikTok',instagram:'Instagram',videos:'Mes vidéos',insights:'Analyses avancées',goals:'Mes objectifs',settings:'Paramètres'};document.getElementById('breadcrumb').textContent=labels[page]||'Workspace';document.getElementById('sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.page)));
document.getElementById('mobileMenu').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
document.querySelector('#videoSearch').addEventListener('input',renderAllVideos);document.querySelector('#platformFilter').addEventListener('change',renderAllVideos);document.querySelector('#sortFilter').addEventListener('change',renderAllVideos);
document.getElementById('dateRange').addEventListener('change',e=>{const ranges={'7':'7 derniers jours','30':'30 derniers jours','90':'90 derniers jours','365':'12 derniers mois'};if(youtubeData)loadYoutube();else toast('Période sélectionnée : '+ranges[e.target.value]+' · connecte YouTube pour importer les données')});
function exportCSV(){const header=['Titre','Plateforme','Type','Date','Vues','Likes','Commentaires','Engagement (%)'];const lines=currentVideos().map(v=>[v.title,v.platform,v.type,v.date,v.views,v.likes,v.comments,v.engagement].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(';'));const blob=new Blob(['\ufeff'+[header.join(';'),...lines].join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='axo-analytics-publications.csv';a.click();URL.revokeObjectURL(url);toast('Export CSV téléchargé')}
document.getElementById('exportBtn').addEventListener('click',exportCSV);document.getElementById('videoExport').addEventListener('click',exportCSV);
const modal=document.getElementById('modal');function showModal(title,text){document.getElementById('modalTitle').textContent=title;document.getElementById('modalText').textContent=text;modal.classList.add('show')}document.getElementById('modalClose').onclick=()=>modal.classList.remove('show');document.getElementById('modalOk').onclick=()=>modal.classList.remove('show');modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('show')});document.getElementById('addGoal').onclick=()=>showModal('Objectifs personnalisés','La création et le suivi d’objectifs personnalisés seront ajoutés dans une prochaine version.');
document.querySelectorAll('.settings-tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.settings-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.settings-section').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.getElementById('tab-'+btn.dataset.tab).classList.add('active')}));
function setTheme(light){document.body.classList.toggle('light-mode',light);document.documentElement.classList.toggle('light',light);document.getElementById('darkSwitch').checked=!light;localStorage.setItem('axo-light',String(light))}document.getElementById('themeToggle').onclick=()=>setTheme(!document.body.classList.contains('light-mode'));document.getElementById('darkSwitch').addEventListener('change',e=>setTheme(!e.target.checked));document.getElementById('motionSwitch').addEventListener('change',e=>document.body.classList.toggle('no-motion',!e.target.checked));document.getElementById('saveProfile').onclick=()=>{const name=document.getElementById('profileName').value.trim();if(name){document.querySelector('.profile b').textContent=name;toast('Profil enregistré localement')}else toast('Entre un nom valide')};document.getElementById('resetDemo').onclick=()=>{localStorage.removeItem('axo-light');setTheme(false);document.body.classList.remove('no-motion');document.getElementById('motionSwitch').checked=true;toast('Préférences réinitialisées')};
renderTables();if(localStorage.getItem('axo-light')==='true')setTheme(true);

const youtubeConnectButton=document.getElementById('connectYoutube');
if(youtubeConnectButton) youtubeConnectButton.addEventListener('click',()=>{window.location.assign('/api/auth/youtube/connect')});
const query=new URLSearchParams(window.location.search);
if(query.get('youtube_connected')==='1'){
  const status=document.getElementById('youtubeStatus');
  if(status){status.textContent='Connecté';status.classList.add('connected')}
  const button=document.getElementById('connectYoutube');
  if(button){button.textContent='Compte connecté';button.disabled=true}
  toast('Chaîne YouTube connectée : '+(query.get('channel')||'YouTube'));
  history.replaceState({},'',window.location.pathname);
}

// Recharge les données YouTube si une session Google est déjà active.
loadYoutube();
