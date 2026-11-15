const platformData = {
  youtube: { connected: false, subscribers: 0, views: 0, likes: 0, videos: 0, title: "Non connecté", items: [] },
  tiktok: { connected: false, subscribers: 0, views: 0, likes: 0, videos: 0, title: "Non connecté", items: [] },
  instagram: { connected: false, subscribers: 0, views: 0, likes: 0, videos: 0, title: "Non connecté", items: [] }
};
let youtubeData = null;
let youtubeVideos = [];

const escapeHTML = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const fmt = n => {
  n = Number(n || 0);
  return n >= 1e6 ? (n/1e6).toFixed(2).replace(".",",")+" M" : n >= 1e3 ? (n/1e3).toFixed(n>=1e5?0:1).replace(".",",")+" K" : n.toLocaleString("fr-BE");
};
const platformClass = p => p === "YouTube" ? "yt" : p === "TikTok" ? "tt" : "ig";
function currentVideos() {
  return [...platformData.youtube.items, ...platformData.tiktok.items, ...platformData.instagram.items];
}
function row(v, full=false) {
  const engagement = Number(v.engagement || 0).toFixed(1).replace(".",",");
  return "<tr><td><div class=\"video-cell\"><div class=\"video-thumb\">"+(v.platform==="YouTube"?"▶":v.platform==="TikTok"?"♪":"◎")+"</div><div><b>"+escapeHTML(v.title)+"</b><small>"+escapeHTML(v.type || "Vidéo")+"</small></div></div></td>"+
    (full ? "<td><span class=\"platform-tag\">"+escapeHTML(v.platform)+"</span></td><td>"+(v.date ? new Date(v.date+"T12:00:00").toLocaleDateString("fr-BE",{day:"2-digit",month:"short"}) : "—")+"</td>" : "<td><span class=\"platform-tag\">"+escapeHTML(v.platform)+"</span></td>")+
    "<td>"+fmt(v.views)+"</td><td>"+fmt(v.likes)+"</td>"+(full ? "<td>"+engagement+" %</td>" : "<td>"+Number(v.comments||0).toLocaleString("fr-BE")+"</td>")+"</tr>";
}
function renderTables() {
  const all = currentVideos();
  const top = document.querySelector("#topVideos");
  if (top) top.innerHTML = all.length ? [...all].sort((a,b)=>b.views-a.views).slice(0,4).map(v=>row(v)).join("") : '<tr><td colspan="4">Aucune publication réelle disponible pour le moment.</td></tr>';
  ["YouTube","TikTok","Instagram"].forEach(p => {
    const target = document.getElementById(p.toLowerCase()+"Videos");
    if (!target) return;
    const list = platformData[p.toLowerCase()].items;
    target.innerHTML = list.length ? list.map(v=>row(v)).join("") : '<tr><td colspan="5">Aucune donnée réelle disponible. Connecte cette plateforme pour afficher tes publications.</td></tr>';
  });
  renderAllVideos();
}
function updateOverview(days) {
  const platforms = Object.values(platformData);
  const subscribersKnown = platforms.every(p=>p.subscribers !== null);
  const totals = {
    subscribers: platforms.reduce((n,p)=>n+(Number(p.subscribers)||0),0),
    views: platforms.reduce((n,p)=>n+(Number(p.views)||0),0),
    likes: platforms.reduce((n,p)=>n+(Number(p.likes)||0),0),
    videos: platforms.reduce((n,p)=>n+(Number(p.videos)||0),0)
  };
  const set = (id,value) => { const el=document.getElementById(id); if(el) el.textContent=value; };
  set("overviewYoutubeSubscribers", subscribersKnown ? fmt(totals.subscribers) : "Partiel");
  set("overviewYoutubeViews", fmt(totals.views));
  set("overviewYoutubeLikes", fmt(totals.likes));
  set("overviewYoutubeVideoCount", fmt(totals.videos));
  set("overviewYoutubeViewsPeriod","sur "+days+" jours");
  set("overviewYoutubeLikesPeriod","sur "+days+" jours");
  set("chartTotal",fmt(totals.views));
  set("donutTotal",fmt(totals.views));
  set("breakdownYoutube",fmt(platformData.youtube.views));
  set("breakdownTiktok",fmt(platformData.tiktok.views));
  set("breakdownInstagram",fmt(platformData.instagram.views));
  set("breakdownYoutubePercent",totals.views ? (platformData.youtube.views/totals.views*100).toFixed(1).replace(".",",")+" %" : "0 %");
  set("breakdownTiktokPercent",totals.views ? (platformData.tiktok.views/totals.views*100).toFixed(1).replace(".",",")+" %" : "0 %");
  set("breakdownInstagramPercent",totals.views ? (platformData.instagram.views/totals.views*100).toFixed(1).replace(".",",")+" %" : "0 %");
  const donut=document.querySelector(".donut");
  if(donut) {
    const yt=totals.views ? platformData.youtube.views/totals.views*100 : 0;
    const tt=totals.views ? platformData.tiktok.views/totals.views*100 : 0;
    const ig=totals.views ? platformData.instagram.views/totals.views*100 : 0;
    donut.style.background="conic-gradient(#9c7bff 0 "+yt+"%,#ed83bd "+yt+"% "+(yt+tt)+"%,#eea36c "+(yt+tt)+"% 100%)";
  }
  const updated=document.getElementById("overviewUpdated");
  if(updated) updated.textContent=platformData.youtube.connected ? "◷ YouTube synchronisé · "+new Date(youtubeData.syncedAt).toLocaleString("fr-BE") : "◷ En attente de données";
  const viewsLabel=document.getElementById("overviewViewsLabel");
  if(viewsLabel) viewsLabel.textContent=platforms.some(p=>p.connected) ? "Vues réelles · toutes plateformes connectées" : "Aucune plateforme connectée";
  const connection = (id, badgeId, platform) => {
    const data=platformData[platform], label=document.getElementById(id), badge=document.getElementById(badgeId);
    if(label) label.textContent=data.connected ? "Connecté · "+data.title : "Non connecté · 0 donnée";
    if(badge) badge.textContent=data.connected ? "Connecté" : "Non connecté";
  };
  connection("overviewYoutubeConnection","overviewYoutubeBadge","youtube");
  connection("overviewTiktokConnection","overviewTiktokBadge","tiktok");
  connection("overviewInstagramConnection","overviewInstagramBadge","instagram");
  const live=document.querySelector(".live-status");
  if(live) live.innerHTML='<span class="pulse"></span>'+(platforms.some(p=>p.connected)?"DONNÉES RÉELLES":"EN ATTENTE DE CONNEXION");
}
function setPlatformPageStats(platform, values, captions) {
  const cards=document.querySelectorAll("#page-"+platform+" .compact-stats .stat-card");
  cards.forEach((card,i)=>{
    const value=card.querySelector(".stat-value"), foot=card.querySelector(".stat-bottom");
    if(value) value.textContent=values[i] ?? "0";
    if(foot) foot.innerHTML='<span class="trend">Non connecté</span><span>'+(captions[i]||"donnée")+"</span>";
  });
}
async function loadYoutube() {
  const days=document.getElementById("dateRange")?.value||"30";
  const statusLine=document.getElementById("youtubeDataStatus");
  try {
    const response=await fetch("/api/youtube/dashboard?days="+encodeURIComponent(days),{credentials:"same-origin",cache:"no-store"});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||"Erreur de synchronisation YouTube.");
    youtubeData=data;
    platformData.youtube={
      connected:true,
      subscribers:data.channel?.subscribers==null ? null : Number(data.channel.subscribers),
      views:Number(data.analytics?.views||0),
      likes:Number(data.analytics?.likes||0),
      videos:Number(data.channel?.videoCount||0),
      title:data.channel?.title||"Chaîne YouTube",
      items:(data.videos||[]).map(v=>({
        title:v.title,platform:"YouTube",type:"Vidéo",date:v.date||"",
        views:Number(v.views||0),likes:Number(v.likes||0),comments:Number(v.comments||0),
        engagement:v.views?((Number(v.likes||0)+Number(v.comments||0))/Number(v.views)*100):0
      }))
    };
    youtubeVideos=platformData.youtube.items;
    updateOverview(days);
    const status=document.getElementById("youtubeStatus"),button=document.getElementById("connectYoutube");
    if(status){status.textContent="Connecté";status.classList.add("connected")}
    if(button){button.textContent="Compte connecté";button.disabled=true}
    const cards=document.querySelectorAll("#page-youtube .compact-stats .stat-card");
    const values=[platformData.youtube.subscribers==null?"Masqué":fmt(platformData.youtube.subscribers),fmt(platformData.youtube.views),fmt(platformData.youtube.likes),fmt((data.analytics?.estimatedMinutesWatched||0)/60)+" h"];
    const captions=["abonnés actuels","vues sur "+days+" jours","likes sur "+days+" jours","heures sur "+days+" jours"];
    cards.forEach((card,i)=>{
      const value=card.querySelector(".stat-value"),foot=card.querySelector(".stat-bottom");
      if(value) value.textContent=values[i];
      if(foot) foot.innerHTML='<span class="trend positive">Données réelles</span><span>'+captions[i]+"</span>";
    });
    const title=document.querySelector("#page-youtube h1");
    if(title) title.textContent=(data.channel?.title||"YouTube")+" Analytics.";
    const note=document.querySelector("#page-youtube .platform-note p");
    if(note) note.textContent=data.analyticsWarning||("Chaîne connectée : "+(data.channel?.title||"YouTube")+". "+(data.channel?.videoCount||0)+" vidéos au total. Synchronisé le "+new Date(data.syncedAt).toLocaleString("fr-BE")+".");
    const noteTitle=document.querySelector("#page-youtube .platform-note b");
    if(noteTitle) noteTitle.textContent="Chaîne YouTube connectée";
    const updated=document.querySelector(".updated-label");
    if(updated) updated.textContent="◷ Données YouTube synchronisées";
    const syncTitle=document.querySelector(".sync-top b");
    if(syncTitle) syncTitle.textContent="Données réelles uniquement";
    const syncText=document.querySelector(".sync-card p");
    if(syncText) syncText.textContent="Les chiffres proviennent uniquement des comptes connectés. Les plateformes non connectées restent à zéro.";
    const listCaption=document.querySelector("#page-youtube .panel:last-child .panel-heading p");
    if(listCaption) listCaption.textContent=youtubeVideos.length+" vidéos récentes récupérées depuis ta chaîne";
    if(statusLine) statusLine.textContent=data.analyticsWarning||"Statistiques actualisées.";
    renderTables();
  } catch(error) {
    if(statusLine) statusLine.textContent=error.message;
    if(!error.message.includes("Session")&&!error.message.includes("Reconnecte")) toast(error.message);
    updateOverview(days);
  }
}
function renderAllVideos() {
  let list=currentVideos(),q=(document.querySelector("#videoSearch")?.value||"").toLowerCase();
  const p=document.querySelector("#platformFilter")?.value||"all",s=document.querySelector("#sortFilter")?.value||"views";
  list=list.filter(v=>v.title.toLowerCase().includes(q)&&(p==="all"||v.platform===p));
  list.sort((a,b)=>s==="likes"?b.likes-a.likes:s==="recent"?b.date.localeCompare(a.date):b.views-a.views);
  const target=document.querySelector("#allVideos");
  if(target) target.innerHTML=list.length?list.map(v=>row(v,true)).join():'<tr><td colspan="6">Aucune publication réelle disponible.</td></tr>';
  const count=document.querySelector("#videoCount");
  if(count) count.textContent=list.length+" publication"+(list.length>1?"s":"");
}
function toast(msg) {
  const t=document.getElementById("toast");
  if(!t)return;
  t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600);
}
function navigate(page) {
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
  document.getElementById("page-"+page)?.classList.add("active");
  document.querySelectorAll(".nav-link").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  const labels={overview:"Vue générale",youtube:"YouTube",tiktok:"TikTok",instagram:"Instagram",videos:"Mes vidéos",insights:"Analyses avancées",goals:"Mes objectifs",settings:"Paramètres"};
  document.getElementById("breadcrumb").textContent=labels[page]||"Workspace";
  document.getElementById("sidebar").classList.remove("open");window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-page]").forEach(el=>el.addEventListener("click",()=>navigate(el.dataset.page)));
document.getElementById("mobileMenu").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
document.querySelector("#videoSearch").addEventListener("input",renderAllVideos);
document.querySelector("#platformFilter").addEventListener("change",renderAllVideos);
document.querySelector("#sortFilter").addEventListener("change",renderAllVideos);
document.getElementById("dateRange").addEventListener("change",e=>loadYoutube());
function exportCSV() {
  const header=["Titre","Plateforme","Type","Date","Vues","Likes","Commentaires","Engagement (%)"];
  const lines=currentVideos().map(v=>[v.title,v.platform,v.type,v.date,v.views,v.likes,v.comments,v.engagement].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(";"));
  const blob=new Blob(["\ufeff"+[header.join(";"),...lines].join("\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="axo-analytics-publications.csv";a.click();URL.revokeObjectURL(url);
  toast("Export CSV téléchargé");
}
document.getElementById("exportBtn").addEventListener("click",exportCSV);
document.getElementById("videoExport").addEventListener("click",exportCSV);
const modal=document.getElementById("modal");
function showModal(title,text){document.getElementById("modalTitle").textContent=title;document.getElementById("modalText").textContent=text;modal.classList.add("show")}
document.getElementById("modalClose").onclick=()=>modal.classList.remove("show");
document.getElementById("modalOk").onclick=()=>modal.classList.remove("show");
modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("show")});
document.getElementById("addGoal").onclick=()=>showModal("Objectifs personnalisés","La création et le suivi des objectifs personnalisés seront ajoutés dans une prochaine version.");
document.querySelectorAll(".settings-tab").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".settings-tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".settings-section").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");document.getElementById("tab-"+btn.dataset.tab).classList.add("active");
}));
function setTheme(light) {
  document.body.classList.toggle("light-mode",light);document.documentElement.classList.toggle("light",light);
  document.getElementById("darkSwitch").checked=!light;localStorage.setItem("axo-light",String(light));
}
document.getElementById("themeToggle").onclick=()=>setTheme(!document.body.classList.contains("light-mode"));
document.getElementById("darkSwitch").addEventListener("change",e=>setTheme(!e.target.checked));
document.getElementById("motionSwitch").addEventListener("change",e=>document.body.classList.toggle("no-motion",!e.target.checked));
document.getElementById("saveProfile").onclick=()=>{
  const name=document.getElementById("profileName").value.trim();
  if(name){document.querySelector(".profile b").textContent=name;toast("Profil enregistré localement")}else toast("Entre un nom valide");
};
document.getElementById("resetDemo").onclick=()=>{
  localStorage.removeItem("axo-light");setTheme(false);document.body.classList.remove("no-motion");
  document.getElementById("motionSwitch").checked=true;toast("Préférences réinitialisées");
};
renderTables();
updateOverview(document.getElementById("dateRange")?.value||"30");
setPlatformPageStats("tiktok",["0","0","0","0"],["abonnés","vues sur 30 jours","likes sur 30 jours","partages"]);
setPlatformPageStats("instagram",["0","0","0","0"],["abonnés","vues sur 30 jours","interactions","comptes touchés"]);
if(localStorage.getItem("axo-light")==="true")setTheme(true);
const youtubeConnectButton=document.getElementById("connectYoutube");
if(youtubeConnectButton)youtubeConnectButton.addEventListener("click",()=>window.location.assign("/api/auth/youtube/connect"));
const query=new URLSearchParams(window.location.search);
if(query.get("youtube_connected")==="1") {
  const status=document.getElementById("youtubeStatus");
  if(status){status.textContent="Connecté";status.classList.add("connected")}
  const button=document.getElementById("connectYoutube");
  if(button){button.textContent="Compte connecté";button.disabled=true}
  toast("Chaîne YouTube connectée : "+(query.get("channel")||"YouTube"));
  history.replaceState({},"",window.location.pathname);
}
loadYoutube();