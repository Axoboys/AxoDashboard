const COOKIE = "axo_oauth_state";
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
async function encryptToken(value, secret) {
  const raw = Uint8Array.from(atob(secret), c=>c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY doit être une clé base64 de 32 octets.");
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, data);
  return JSON.stringify({iv:b64(iv),data:b64(encrypted)});
}
async function googleFetch(url, options={}) {
  const r = await fetch(url, options);
  const body = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(body.error_description || body.error?.message || body.error || "Erreur Google");
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
    const tokens = await googleFetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code:url.searchParams.get("code"),client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:env.GOOGLE_REDIRECT_URI,grant_type:"authorization_code"})});
    const channel = await googleFetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",{headers:{Authorization:"Bearer "+tokens.access_token}});
    const item = channel.items?.[0];
    if (!item) throw new Error("Aucune chaîne YouTube n'a été trouvée sur ce compte Google.");
    if (!env.DB || !env.TOKEN_ENCRYPTION_KEY) throw new Error("Base D1 ou clé de chiffrement non configurée dans Cloudflare.");
    const encrypted = await encryptToken(tokens,env.TOKEN_ENCRYPTION_KEY);
    await env.DB.prepare("INSERT INTO social_accounts (platform, platform_user_id, display_name, avatar_url, token_ciphertext, scopes, updated_at) VALUES ('youtube', ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(platform, platform_user_id) DO UPDATE SET display_name=excluded.display_name, avatar_url=excluded.avatar_url, token_ciphertext=excluded.token_ciphertext, scopes=excluded.scopes, updated_at=datetime('now')")
      .bind(item.id,item.snippet?.title || "Chaîne YouTube",item.snippet?.thumbnails?.default?.url || null,encrypted,GOOGLE_SCOPES).run();
    const target = new URL("/",url.origin);
    target.searchParams.set("youtube_connected","1");
    target.searchParams.set("channel",item.snippet?.title || "YouTube");
    return new Response(null,{status:302,headers:{Location:target.toString(),"Set-Cookie":clear,"Cache-Control":"no-store"}});
  } catch (e) {
    return new Response("Impossible de terminer la connexion YouTube : "+e.message,{status:500,headers:{"Set-Cookie":clear,"content-type":"text/plain; charset=utf-8"}});
  }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/auth/youtube/connect") return connect(request,env);
    if (url.pathname === "/api/auth/youtube/callback") return callback(request,env);
    if (url.pathname === "/api/health") return json({ok:true,service:"axo-analytics"});
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("AXO ANALYTICS : liaison ASSETS Cloudflare manquante.",{status:500});
  }
};
