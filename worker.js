const COOKIE = "axo_oauth_state";
const SESSION_COOKIE = "axo_dashboard_session";
const SESSION_TTL = 60 * 60 * 24 * 30;
const INSTAGRAM_STATE_COOKIE = "axo_instagram_oauth_state";
const INSTAGRAM_SESSION_COOKIE = "axo_instagram_session";
const META_GRAPH_VERSION = "v27.0";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly"
].join(" ");

function json(data, status=200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" } });
}
function cookieValue(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const part = raw.split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));
  return part ? decodeURIComponent(part.slice(name.length+1)) : null;
}
function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function b64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function unb64(value) { return Uint8Array.from(atob(value), c=>c.charCodeAt(0)); }
function base64url(bytes) { return b64(bytes).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
function fromBase64url(value) { return unb64(value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-value.length%4)%4)); }
async function encryptionKey(secret, usage) {
  const raw = unb64(secret);
  if (raw.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY doit être une clé base64 de 32 octets.");
  return crypto.subtle.importKey("raw", raw, usage==="encrypt" ? "AES-GCM" : "AES-GCM", false, [usage]);
}
async function encryptToken(value, secret) {
  const key = await encryptionKey(secret,"encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, data);
  return JSON.stringify({iv:b64(iv),data:b64(encrypted)});
}
async function decryptToken(ciphertext, secret) {
  const saved = JSON.parse(ciphertext);
  const key = await encryptionKey(secret,"decrypt");
  const decrypted = await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(saved.iv)}, key, unb64(saved.data));
  return JSON.parse(new TextDecoder().decode(decrypted));
}
async function signSession(payload, secret) {
  const key = await crypto.subtle.importKey("raw",unb64(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body));
  return body+"."+base64url(signature);
}
async function verifySession(request, secret, cookieName=SESSION_COOKIE) {
  const token = cookieValue(request,cookieName);
  if (!token || !secret) return null;
  try {
    const [body,signature] = token.split(".");
    if (!body || !signature) return null;
    const key = await crypto.subtle.importKey("raw",unb64(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    const valid = await crypto.subtle.verify("HMAC",key,fromBase64url(signature),new TextEncoder().encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body)));
    if (!payload.accountId || !payload.exp || payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch { return null; }
}
async function googleFetch(url, options={}) {
  const r = await fetch(url, options);
  const body = await r.json().catch(()=>({}));
  if (!r.ok) {
    const message = body.error_description || body.error?.message || body.error?.errors?.[0]?.message || body.error || "Erreur Google";
    throw new Error(typeof message==="string" ? message : JSON.stringify(message));
  }
  return body;
}
async function connect(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) return json({error:"Configuration Google incomplète : ajoute GOOGLE_CLIENT_ID et GOOGLE_REDIRECT_URI dans les variables Worker."},500);
  const state = randomState();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id:env.GOOGLE_CLIENT_ID, redirect_uri:env.GOOGLE_REDIRECT_URI,
    response_type:"code", scope:GOOGLE_SCOPES, access_type:"offline",
    prompt:"consent select_account", include_granted_scopes:"true", state
  });
  return new Response(null,{status:302,headers:{Location:url.toString(),"Set-Cookie":cookie(COOKIE,state,600),"Cache-Control":"no-store"}});
}
async function callback(request, env) {
  const url = new URL(request.url), state = url.searchParams.get("state");
  const expected = cookieValue(request,COOKIE);
  const clear = cookie(COOKIE,"",0);
  if (!state || !expected || state !== expected) return new Response("Connexion refusée : état OAuth invalide. Recommence depuis AXO ANALYTICS.",{status:400,headers:{"Set-Cookie":clear}});
  if (url.searchParams.has("error")) return new Response("Google n'a pas autorisé la connexion : "+url.searchParams.get("error"),{status:400,headers:{"Set-Cookie":clear}});
  try {
    if (!env.GOOGLE_CLIENT_SECRET || !env.DB || !env.TOKEN_ENCRYPTION_KEY) throw new Error("Configuration Google, base D1 ou clé de chiffrement manquante.");
    const tokens = await googleFetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code:url.searchParams.get("code"),client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:env.GOOGLE_REDIRECT_URI,grant_type:"authorization_code"})});
    tokens.expiry_date=Date.now()+(tokens.expires_in||3600)*1000;
    const channel = await googleFetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",{headers:{Authorization:"Bearer "+tokens.access_token}});
    const item = channel.items?.[0];
    if (!item) throw new Error("Aucune chaîne YouTube n'a été trouvée sur ce compte Google.");
    const encrypted = await encryptToken(tokens,env.TOKEN_ENCRYPTION_KEY);
    await env.DB.prepare("INSERT INTO social_accounts (platform, platform_user_id, display_name, avatar_url, token_ciphertext, scopes, updated_at) VALUES ('youtube', ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(platform, platform_user_id) DO UPDATE SET display_name=excluded.display_name, avatar_url=excluded.avatar_url, token_ciphertext=excluded.token_ciphertext, scopes=excluded.scopes, updated_at=datetime('now')")
      .bind(item.id,item.snippet?.title || "Chaîne YouTube",item.snippet?.thumbnails?.default?.url || null,encrypted,GOOGLE_SCOPES).run();
    const account = await env.DB.prepare("SELECT id FROM social_accounts WHERE platform='youtube' AND platform_user_id=?").bind(item.id).first();
    const session = await signSession({accountId:account.id,exp:Math.floor(Date.now()/1000)+SESSION_TTL},env.TOKEN_ENCRYPTION_KEY);
    const target = new URL("/",url.origin);
    target.searchParams.set("youtube_connected","1");
    target.searchParams.set("channel",item.snippet?.title || "YouTube");
    const headers = new Headers({Location:target.toString(),"Cache-Control":"no-store"});
    headers.append("Set-Cookie",clear);
    headers.append("Set-Cookie",cookie(SESSION_COOKIE,session,SESSION_TTL));
    return new Response(null,{status:302,headers});
  } catch (e) {
    return new Response("Impossible de terminer la connexion YouTube : "+e.message,{status:500,headers:{"Set-Cookie":clear,"content-type":"text/plain; charset=utf-8"}});
  }
}
async function authorizedTokens(request,env) {
  if (!env.DB || !env.TOKEN_ENCRYPTION_KEY) throw new Error("Base D1 ou clé de chiffrement non configurée.");
  const session = await verifySession(request,env.TOKEN_ENCRYPTION_KEY);
  if (!session) return {error:json({error:"Session expirée ou absente. Reconnecte ton compte YouTube depuis les paramètres."},401)};
  const account = await env.DB.prepare("SELECT id, platform_user_id, display_name, avatar_url, token_ciphertext FROM social_accounts WHERE id=? AND platform='youtube'").bind(session.accountId).first();
  if (!account) return {error:json({error:"Compte YouTube introuvable. Reconnecte-le depuis les paramètres."},401)};
  let tokens = await decryptToken(account.token_ciphertext,env.TOKEN_ENCRYPTION_KEY);
  if (!tokens.access_token) throw new Error("Jeton Google absent. Reconnecte ton compte YouTube.");
  if (!tokens.expiry_date || tokens.expiry_date <= Date.now()+60000) {
    if (!tokens.refresh_token) throw new Error("Le jeton de renouvellement Google est absent. Reconnecte ton compte YouTube.");
    const refreshed = await googleFetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:tokens.refresh_token,grant_type:"refresh_token"})});
    tokens = {...tokens,...refreshed,refresh_token:tokens.refresh_token,expiry_date:Date.now()+(refreshed.expires_in||3600)*1000};
    const encrypted = await encryptToken(tokens,env.TOKEN_ENCRYPTION_KEY);
    await env.DB.prepare("UPDATE social_accounts SET token_ciphertext=?, updated_at=datetime('now') WHERE id=?").bind(encrypted,account.id).run();
  }
  return {account,tokens};
}
async function youtubeDashboard(request,env) {
  try {
    const auth = await authorizedTokens(request,env);
    if (auth.error) return auth.error;
    const {account,tokens}=auth;
    const url = new URL(request.url);
    const days = Math.min(365,Math.max(7,Number.parseInt(url.searchParams.get("days")||"30",10)||30));
    const end = new Date();
    const start = new Date(end.getTime()-(days-1)*86400000);
    const date = d=>d.toISOString().slice(0,10);
    const startDate=date(start), endDate=date(end);
    const headers={Authorization:"Bearer "+tokens.access_token};
    const channelData=await googleFetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true",{headers});
    const channel=channelData.items?.find(x=>x.id===account.platform_user_id)||channelData.items?.[0];
    if (!channel) throw new Error("Impossible de retrouver la chaîne YouTube connectée.");
    const analyticsUrl=new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    analyticsUrl.search=new URLSearchParams({ids:"channel==MINE",startDate,endDate,metrics:"views,likes,comments,estimatedMinutesWatched,subscribersGained,subscribersLost"});
    let analytics={views:0,likes:0,comments:0,estimatedMinutesWatched:0,subscribersGained:0,subscribersLost:0};
    let analyticsWarning=null;
    try {
      const report=await googleFetch(analyticsUrl.toString(),{headers});
      const values=report.rows?.[0]||[];
      ["views","likes","comments","estimatedMinutesWatched","subscribersGained","subscribersLost"].forEach((k,i)=>analytics[k]=Number(values[i]||0));
    } catch(e) { analyticsWarning="Les statistiques détaillées de la période ne sont pas accessibles : "+e.message; }
    let daily=[];
    try {
      const dailyUrl=new URL("https://youtubeanalytics.googleapis.com/v2/reports");
      dailyUrl.search=new URLSearchParams({ids:"channel==MINE",startDate,endDate,metrics:"views",dimensions:"day",sort:"day"});
      const dailyReport=await googleFetch(dailyUrl.toString(),{headers});
      daily=(dailyReport.rows||[]).map(row=>({date:String(row[0]),views:Number(row[1]||0)}));
    } catch(e) {
      analyticsWarning=analyticsWarning||"L'historique quotidien n'est pas accessible : "+e.message;
    }
    const playlistId=channel.contentDetails?.relatedPlaylists?.uploads;
    let videoItems=[];
    if (playlistId) {
      const playlist=await googleFetch("https://www.googleapis.com/youtube/v3/playlistItems?"+new URLSearchParams({part:"snippet,contentDetails",playlistId,maxResults:"50"}),{headers});
      const ids=(playlist.items||[]).map(x=>x.contentDetails?.videoId).filter(Boolean);
      if (ids.length) {
        const details=await googleFetch("https://www.googleapis.com/youtube/v3/videos?"+new URLSearchParams({part:"snippet,statistics,contentDetails",id:ids.join(",")}),{headers});
        videoItems=details.items||[];
      }
    }
    const videos=videoItems.map(v=>({
      id:v.id,title:v.snippet?.title||"Vidéo sans titre",
      duration:v.contentDetails?.duration||"PT0S",
      durationSeconds:(()=>{const m=(v.contentDetails?.duration||"PT0S").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);return m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):0;})(),
      date:v.snippet?.publishedAt?.slice(0,10)||"",
      thumbnail:v.snippet?.thumbnails?.medium?.url||v.snippet?.thumbnails?.default?.url||null,
      views:Number(v.statistics?.viewCount||0),likes:Number(v.statistics?.likeCount||0),
      comments:Number(v.statistics?.commentCount||0),
      type:(v.snippet?.liveBroadcastContent==="live"?"Live":"Vidéo"),
      url:"https://www.youtube.com/watch?v="+v.id
    }));
    return json({
      ok:true,source:"youtube",syncedAt:new Date().toISOString(),period:{days,startDate,endDate},
      channel:{id:channel.id,title:channel.snippet?.title||account.display_name,avatar:channel.snippet?.thumbnails?.default?.url||account.avatar_url,subscribers:channel.statistics?.hiddenSubscriberCount?null:Number(channel.statistics?.subscriberCount||0),totalViews:Number(channel.statistics?.viewCount||0),videoCount:Number(channel.statistics?.videoCount||0)},
      analytics,analyticsWarning,daily,videos
    });
  } catch(e) { return json({error:"Impossible de récupérer les statistiques YouTube : "+e.message},500); }
}

async function metaFetch(url) {
  const response = await fetch(url);
  const body = await response.json().catch(()=>({}));
  if (!response.ok || body.error) {
    const detail=body.error?.error_user_msg||body.error?.message||body.error_description||"Erreur Meta Graph API";
    throw new Error(typeof detail==="string"?detail:JSON.stringify(detail));
  }
  return body;
}
async function metaGraph(path, token, params={}) {
  const url=new URL("https://graph.facebook.com/"+META_GRAPH_VERSION+"/"+path);
  url.search=new URLSearchParams({...params,access_token:token});
  return metaFetch(url.toString());
}
async function instagramConnect(request,env) {
  if(!env.META_APP_ID||!env.META_CONFIG_ID||!env.META_REDIRECT_URI||!env.META_APP_SECRET) return json({error:"Configuration Meta incomplète. Vérifie les variables META_APP_ID, META_CONFIG_ID, META_REDIRECT_URI et le secret META_APP_SECRET."},500);
  const state=randomState();
  const url=new URL("https://www.facebook.com/dialog/oauth");
  url.search=new URLSearchParams({client_id:env.META_APP_ID,config_id:env.META_CONFIG_ID,display:"popup",override_default_response_type:"true",redirect_uri:env.META_REDIRECT_URI,response_type:"code",state,prompt:"login"});
  return new Response(null,{status:302,headers:{Location:url.toString(),"Set-Cookie":cookie(INSTAGRAM_STATE_COOKIE,state,600),"Cache-Control":"no-store"}});
}
async function instagramCallback(request,env) {
  const url=new URL(request.url),state=url.searchParams.get("state"),expected=cookieValue(request,INSTAGRAM_STATE_COOKIE),clear=cookie(INSTAGRAM_STATE_COOKIE,"",0);
  if(!state||!expected||state!==expected) return new Response("Connexion Instagram refusée : état OAuth invalide. Recommence depuis AXO ANALYTICS.",{status:400,headers:{"Set-Cookie":clear}});
  if(url.searchParams.has("error")) return new Response("Meta n'a pas autorisé la connexion Instagram : "+(url.searchParams.get("error_description")||url.searchParams.get("error")),{status:400,headers:{"Set-Cookie":clear}});
  try {
    if(!env.META_APP_ID||!env.META_APP_SECRET||!env.META_REDIRECT_URI||!env.DB||!env.TOKEN_ENCRYPTION_KEY) throw new Error("Configuration Meta, base D1 ou clé de chiffrement manquante.");
    const code=url.searchParams.get("code");
    if(!code) throw new Error("Code d'autorisation Meta absent. Recommence la connexion.");
    const tokenUrl=new URL("https://graph.facebook.com/"+META_GRAPH_VERSION+"/oauth/access_token");
    tokenUrl.search=new URLSearchParams({client_id:env.META_APP_ID,client_secret:env.META_APP_SECRET,redirect_uri:env.META_REDIRECT_URI,code});
    const tokenResponse=await metaFetch(tokenUrl.toString());
    const accessToken=tokenResponse.access_token||tokenResponse.data?.[0]?.access_token;
    if(!accessToken) throw new Error("Meta n'a pas retourné de jeton d'accès utilisable.");
    const me=await metaGraph("me",accessToken,{fields:"id,name"});
    const assigned=await metaGraph(me.id+"/assigned_instagram_accounts",accessToken,{fields:"id,username,profile_picture_url"});
    const ig=assigned.data?.[0];
    if(!ig?.id) throw new Error("Aucun compte Instagram professionnel attribué à cette configuration Meta. Vérifie que ton compte Créateur est sélectionné comme actif dans Unified Login.");
    const tokens={access_token:accessToken,token_type:tokenResponse.token_type||"bearer",expires_in:tokenResponse.expires_in||null,expiry_date:tokenResponse.expires_in?Date.now()+Number(tokenResponse.expires_in)*1000:null};
    const encrypted=await encryptToken(tokens,env.TOKEN_ENCRYPTION_KEY),username=ig.username||"Compte Instagram";
    await env.DB.prepare("INSERT INTO social_accounts (platform, platform_user_id, display_name, avatar_url, token_ciphertext, scopes, updated_at) VALUES ('instagram', ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(platform, platform_user_id) DO UPDATE SET display_name=excluded.display_name, avatar_url=excluded.avatar_url, token_ciphertext=excluded.token_ciphertext, scopes=excluded.scopes, updated_at=datetime('now')").bind(ig.id,username,ig.profile_picture_url||null,encrypted,"instagram_basic,instagram_manage_insights").run();
    const account=await env.DB.prepare("SELECT id FROM social_accounts WHERE platform='instagram' AND platform_user_id=?").bind(ig.id).first();
    const session=await signSession({accountId:account.id,exp:Math.floor(Date.now()/1000)+SESSION_TTL},env.TOKEN_ENCRYPTION_KEY);
    const target=new URL("/",url.origin);
    target.searchParams.set("instagram_connected","1");target.searchParams.set("username",username);
    const headers=new Headers({Location:target.toString(),"Cache-Control":"no-store"});
    headers.append("Set-Cookie",clear);headers.append("Set-Cookie",cookie(INSTAGRAM_SESSION_COOKIE,session,SESSION_TTL));
    return new Response(null,{status:302,headers});
  } catch(e) {
    return new Response("Impossible de terminer la connexion Instagram : "+e.message,{status:500,headers:{"Set-Cookie":clear,"content-type":"text/plain; charset=utf-8"}});
  }
}
async function authorizedInstagramTokens(request,env) {
  if(!env.DB||!env.TOKEN_ENCRYPTION_KEY) throw new Error("Base D1 ou clé de chiffrement non configurée.");
  const session=await verifySession(request,env.TOKEN_ENCRYPTION_KEY,INSTAGRAM_SESSION_COOKIE);
  if(!session) return {error:json({error:"Session Instagram absente. Connecte ton compte Instagram depuis les paramètres."},401)};
  const account=await env.DB.prepare("SELECT id, platform_user_id, display_name, avatar_url, token_ciphertext FROM social_accounts WHERE id=? AND platform='instagram'").bind(session.accountId).first();
  if(!account) return {error:json({error:"Compte Instagram introuvable. Reconnecte-le depuis les paramètres."},401)};
  const tokens=await decryptToken(account.token_ciphertext,env.TOKEN_ENCRYPTION_KEY);
  if(!tokens.access_token) throw new Error("Jeton Meta absent. Reconnecte ton compte Instagram.");
  if(tokens.expiry_date&&tokens.expiry_date<=Date.now()) throw new Error("Le jeton Meta a expiré. Reconnecte ton compte Instagram.");
  return {account,tokens};
}
function metricTotal(data,name) {
  const metric=data.find(item=>item.name===name);
  return (metric?.values||[]).reduce((sum,item)=>sum+(Number(item.value)>0?Number(item.value):0),0);
}
async function instagramDashboard(request,env) {
  try {
    const auth=await authorizedInstagramTokens(request,env);
    if(auth.error) return auth.error;
    const {account,tokens}=auth,url=new URL(request.url);
    const days=Math.min(90,Math.max(1,Number.parseInt(url.searchParams.get("days")||"30",10)||30));
    const end=new Date(),start=new Date(end.getTime()-(days-1)*86400000),since=Math.floor(start.getTime()/1000),until=Math.floor(end.getTime()/1000);
    const profile=await metaGraph(account.platform_user_id,tokens.access_token,{fields:"id,username,profile_picture_url,followers_count,media_count"});
    let insightData=[],analyticsWarning=null;
    try {
      const insights=await metaGraph(account.platform_user_id+"/insights",tokens.access_token,{metric:"views,reach,total_interactions,accounts_engaged",period:"day",since:String(since),until:String(until)});
      insightData=insights.data||[];
    } catch(e) { analyticsWarning="Le profil est connecté, mais certaines statistiques ne sont pas accessibles : "+e.message; }
    let media=[];
    try {
      const result=await metaGraph(account.platform_user_id+"/media",tokens.access_token,{fields:"id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count,thumbnail_url,media_url",limit:"25"});
      media=await Promise.all((result.data||[]).map(async item=>{
        let metrics={};
        try {
          const r=await metaGraph(item.id+"/insights",tokens.access_token,{metric:"views,reach,saved,shares,total_interactions"});
          for(const m of r.data||[]) { const v=m.values?.[0]?.value??m.value; if(v!=null) metrics[m.name]=Number(v); }
        } catch {}
        const likes=Number(item.like_count||0),comments=Number(item.comments_count||0),views=metrics.views??metrics.reach??0,interactions=metrics.total_interactions??likes+comments;
        return {id:item.id,title:(item.caption||"Publication Instagram").slice(0,120),type:item.media_product_type==="REELS"?"Reel":item.media_type==="VIDEO"?"Vidéo":item.media_type==="CAROUSEL_ALBUM"?"Carrousel":"Publication",date:item.timestamp?item.timestamp.slice(0,10):"",views,likes,comments,engagement:views?interactions/views*100:0,url:item.permalink||null,thumbnail:item.thumbnail_url||item.media_url||null};
      }));
    } catch(e) { analyticsWarning=analyticsWarning||"Les publications Instagram ne sont pas accessibles : "+e.message; }
    const viewsMetric=insightData.find(item=>item.name==="views");
    const daily=(viewsMetric?.values||[]).map(item=>({date:item.end_time?.slice(0,10)||"",views:Number(item.value||0)})).filter(item=>item.date);
    return json({ok:true,source:"instagram",syncedAt:new Date().toISOString(),period:{days},account:{id:profile.id,username:profile.username||account.display_name,avatar:profile.profile_picture_url||account.avatar_url,followers:Number(profile.followers_count||0),mediaCount:Number(profile.media_count||media.length)},analytics:{views:metricTotal(insightData,"views"),reach:metricTotal(insightData,"reach"),interactions:metricTotal(insightData,"total_interactions"),accountsEngaged:metricTotal(insightData,"accounts_engaged")},analyticsWarning,daily,media});
  } catch(e) { return json({error:"Impossible de récupérer les statistiques Instagram : "+e.message},500); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/auth/youtube/connect") return connect(request,env);
    if (url.pathname === "/api/auth/youtube/callback") return callback(request,env);
    if (url.pathname === "/api/youtube/dashboard" && request.method==="GET") return youtubeDashboard(request,env);
    if (url.pathname === "/api/auth/instagram/connect") return instagramConnect(request,env);
    if (url.pathname === "/api/auth/instagram/callback") return instagramCallback(request,env);
    if (url.pathname === "/api/instagram/dashboard" && request.method==="GET") return instagramDashboard(request,env);
    if (url.pathname === "/api/auth/logout" && request.method==="POST") {
      const headers=new Headers({"Set-Cookie":cookie(SESSION_COOKIE,"",0),"Cache-Control":"no-store"});
      headers.append("Set-Cookie",cookie(INSTAGRAM_SESSION_COOKIE,"",0));
      return new Response(null,{status:204,headers});
    }
    if (url.pathname === "/api/health") return json({ok:true,service:"axo-analytics"});
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("AXO ANALYTICS : liaison ASSETS Cloudflare manquante.",{status:500});
  }
};
