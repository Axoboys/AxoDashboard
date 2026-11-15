const platformData = {
  youtube: { connected: false, subscribers: 0, views: 0, likes: 0, videos: 0, title: "Non connecté", items: [] },
  tiktok: { connected: false, subscribers: 0, views: 0, likes: 0, videos: 0, title: "Non connecté", items: [] },
  instagram: { connected: false, subscribers: 0, views: 0, likes: 0, videos: 0, title: "Non connecté", items: [] }
};
let youtubeData = null;
let youtubeVideos = [];
const GOALS_STORAGE_KEY = "axo-analytics-goals-v1";
function readGoals() {
  try {
    const saved = JSON.parse(localStorage.getItem(GOALS_STORAGE_KEY) || "{}");
    return {
      subscribers: Number.isSafeInteger(saved.subscribers) && saved.subscribers > 0 ? saved.subscribers : null,
      views: Number.isSafeInteger(saved.views) && saved.views > 0 ? saved.views : null
    };
  } catch { return { subscribers: null, views: null }; }
}
let creatorGoals = readGoals();
function renderGoal(type, current, target) {
  const prefix = type === "subscribers" ? "subGoal" : "viewsGoal";
  const set = (suffix, value) => { const el=document.getElementById(prefix+suffix); if(el) el.textContent=value; };
  const bar=document.getElementById(prefix+"Progress");
  const status=document.getElementById(prefix+"Status");
  const message=document.getElementById(prefix+"Message");
  set("Current", current == null ? "Masqué" : fmt(current));
  set("Target", target ? fmt(target) : "objectif à définir");
  const percent = target && current != null ? Math.min(100, current / target * 100) : 0;
  if(bar) bar.style.width=percent.toFixed(2)+"%";
  set("Percent", target && current != null ? Math.floor(percent)+" %" : "—");
  if(status) status.textContent=!target ? "À définir" : current == null ? "Données masquées" : current>=target ? "Objectif atteint" : "En cours";
  set("Remaining", !target ? "Définis ton prochain palier" : current == null ? "Donnée indisponible" : current>=target ? "Palier atteint !" : fmt(target-current)+" restant"+(target-current>1?"s":""));
  if(message) message.textContent=!target ? "Ajoute un objectif pour suivre ta progression." : current == null ? "La plateforme masque cette statistique, le calcul ne peut pas être effectué." : current>=target ? "Bravo ! Tu as atteint cet objectif. Tu peux définir un nouveau palier quand tu le souhaites." : "Tu as atteint "+Math.floor(percent)+" % de ton objectif.";
}
function renderGoals() {
  const platforms=Object.values(platformData);
  const subscribersKnown=platforms.every(p=>p.subscribers!==null);
  const subscribers=subscribersKnown ? platforms.reduce((sum,p)=>sum+(Number(p.subscribers)||0),0) : null;
  const views=platforms.reduce((sum,p)=>sum+(Number(p.views)||0),0);
  renderGoal("subscribers",subscribers,creatorGoals.subscribers);
  renderGoal("views",views,creatorGoals.views);
}
function openGoalEditor() {
  document.getElementById("goalSubscribersInput").value=creatorGoals.subscribers ?? "";
  document.getElementById("goalViewsInput").value=creatorGoals.views ?? "";
  document.getElementById("modal").classList.add("show");
}


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
  set("insightYoutubeViews",fmt(platformData.youtube.views));
  const insightBar=document.getElementById("insightYoutubeBar");
  if(insightBar) insightBar.style.width=totals.views ? (platformData.youtube.views/totals.views*100)+"%" : "0%";
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
  renderGoals();
  renderInsights(days);
  renderChart(youtubeData?.daily||[]);
  const live=document.querySelector(".live-status");
  if(live) live.innerHTML='<span class="pulse"></span>'+(platforms.some(p=>p.connected)?"DONNÉES RÉELLES":"EN ATTENTE DE CONNEXION");
}
function renderInsights(days) {
  const a=youtubeData?.analytics||{};
  const views=Number(a.views||0), likes=Number(a.likes||0), comments=Number(a.comments||0);
  const interactions=likes+comments;
  const engagement=views>0 ? interactions/views*100 : null;
  const netSubs=Number(a.subscribersGained||0)-Number(a.subscribersLost||0);
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  set("insightPeriodLabel",days+" derniers jours");
  set("insightViewsMetric",fmt(views)+" vues");
  set("insightSubsMetric",youtubeData ? (netSubs>0?"+":"")+fmt(netSubs)+" abonnés" : "— non disponible");
  set("insightEngagementMetric",engagement===null?"—":engagement.toFixed(2).replace(".",",")+" %");
  set("insightLikes",fmt(likes));set("insightComments",fmt(comments));
  set("insightWatchTime",fmt(Math.round(Number(a.estimatedMinutesWatched||0)/60))+" h");
  set("insightDailyAverage",fmt(Math.round(views/Math.max(1,Number(days)||30))));
  set("insightViewsDescription",youtubeData?"Vues YouTube sur les "+days+" derniers jours.":"Connecte YouTube pour obtenir cette mesure.");
  set("insightSubsDescription",youtubeData?"Gagnés ("+fmt(a.subscribersGained||0)+") moins perdus ("+fmt(a.subscribersLost||0)+") sur la période.":"Cette mesure sera disponible après connexion.");
  set("insightEngagementDescription",views>0?fmt(interactions)+" likes et commentaires pour "+fmt(views)+" vues.":"Le taux sera calculé dès que des vues seront disponibles.");
  const summary=!youtubeData?"Connecte YouTube pour générer une analyse basée sur tes statistiques réelles.":views===0?"Aucune vue n'a été remontée pour cette période. Essaie une autre période ou vérifie les autorisations Analytics.":"Sur les "+days+" derniers jours, ta chaîne a obtenu "+fmt(views)+" vues et "+fmt(interactions)+" interactions ("+(engagement===null?"taux indisponible":engagement.toFixed(2).replace(".",",")+" % d'engagement") +"). La moyenne est de "+fmt(Math.round(views/Math.max(1,Number(days)||30)))+" vues par jour.";
  set("insightSummary",summary);
  const values={youtube:platformData.youtube.views||0,tiktok:platformData.tiktok.views||0,instagram:platformData.instagram.views||0};
  const max=Math.max(1,...Object.values(values));
  for(const [key,value] of Object.entries(values)){
    set("insight"+key[0].toUpperCase()+key.slice(1)+"Views",fmt(value));
    const bar=document.getElementById("insight"+key[0].toUpperCase()+key.slice(1)+"Bar");
    if(bar)bar.style.width=(value/max*100)+"%";
  }
  set("insightDataStatus",Object.values(platformData).some(p=>p.connected)?"Données connectées":"Aucune connexion");
}
function renderChart(daily) {
  const svg=document.getElementById("mainChart");
  if(!svg) return;
  const rows=(daily||[]).filter(r=>Number.isFinite(Number(r.views)));
  if(!rows.length) {
    svg.innerHTML='<defs><linearGradient id="fillPurple" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#9c76ff" stop-opacity=".28"/><stop offset="1" stop-color="#9c76ff" stop-opacity="0"/></linearGradient></defs><g class="grid-lines"><path d="M0 10H700 M0 75H700 M0 140H700 M0 205H700"/></g>';
    const labels=document.querySelector(".x-labels"); if(labels) labels.innerHTML="<span>Aucune donnée historique</span>";
    const y=document.querySelector(".y-labels"); if(y) y.innerHTML="<span>—</span><span>—</span><span>—</span><span>0</span>";
    return;
  }
  const vals=rows.map(r=>Math.max(0,Number(r.views)||0)), max=Math.max(1,...vals), min=Math.min(0,...vals);
  const x=i=>rows.length===1?350:i*700/(rows.length-1);
  const y=v=>205-(v-min)/(max-min||1)*185;
  const points=vals.map((v,i)=>[x(i),y(v)]);
  const line=points.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  const area=line+" L700 205 L0 205 Z";
  svg.innerHTML='<defs><linearGradient id="fillPurple" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#9c76ff" stop-opacity=".28"/><stop offset="1" stop-color="#9c76ff" stop-opacity="0"/></linearGradient></defs><g class="grid-lines"><path d="M0 10H700 M0 75H700 M0 140H700 M0 205H700"/></g><path class="area-path" d="'+area+'"/><path class="line-path" d="'+line+'"/>';
  const labels=document.querySelector(".x-labels");
  if(labels) {
    const indexes=[0,Math.floor((rows.length-1)/3),Math.floor(2*(rows.length-1)/3),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i);
    labels.innerHTML=indexes.map(i=>"<span>"+new Date(rows[i].date+"T12:00:00").toLocaleDateString("fr-BE",{day:"2-digit",month:"short"})+"</span>").join("");
  }
  const ylabels=document.querySelector(".y-labels");
  if(ylabels) ylabels.innerHTML=[max,max*.66,max*.33,0].map(v=>"<span>"+fmt(Math.round(v))+"</span>").join("");
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
    renderInsights(days);
    renderChart(data.daily||[]);
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
    renderChart([]);
    if(statusLine) statusLine.textContent=error.message;
    if(!error.message.includes("Session")&&!error.message.includes("Reconnecte")) toast(error.message);
    updateOverview(days);
    renderInsights(days);
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
document.getElementById("modalClose").onclick=()=>modal.classList.remove("show");

modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("show")});
document.getElementById("addGoal").onclick=openGoalEditor;
document.getElementById("goalCancel").onclick=()=>modal.classList.remove("show");
document.getElementById("goalForm").addEventListener("submit",e=>{
  e.preventDefault();
  const subscribersRaw=document.getElementById("goalSubscribersInput").value.trim();
  const viewsRaw=document.getElementById("goalViewsInput").value.trim();
  const subscribers=subscribersRaw ? Number(subscribersRaw) : null;
  const views=viewsRaw ? Number(viewsRaw) : null;
  if((subscribersRaw && (!Number.isSafeInteger(subscribers)||subscribers<1)) || (viewsRaw && (!Number.isSafeInteger(views)||views<1))) {
    toast("Entre des objectifs entiers supérieurs à zéro.");return;
  }
  if(!subscribers && !views){toast("Définis au moins un objectif.");return;}
  creatorGoals={subscribers,views};
  localStorage.setItem(GOALS_STORAGE_KEY,JSON.stringify(creatorGoals));
  modal.classList.remove("show");renderGoals();toast("Objectifs enregistrés !");
});
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