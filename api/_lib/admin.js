// Verify Supabase access token and administrator role on the server.
// Use this guard before any future Shopee order or financial endpoint.
export async function requireAdmin(req,res){
 const auth=req.headers.authorization||'';
 const token=auth.startsWith('Bearer ')?auth.slice(7):'';
 if(!token){res.status(401).json({error:'authentication_required'});return null;}
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key){res.status(503).json({error:'server_not_configured'});return null;}
 try{
  const userResp=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)});
  if(!userResp.ok){res.status(401).json({error:'invalid_session'});return null;}
  const user=await userResp.json();
  if(!user.id){res.status(401).json({error:'invalid_session'});return null;}
  const roleResp=await fetch(url+'/rest/v1/profiles?user_id=eq.'+encodeURIComponent(user.id)+'&select=role&limit=1',{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(8000)});
  if(!roleResp.ok){res.status(503).json({error:'authorization_unavailable'});return null;}
  const rows=await roleResp.json();
  if(!Array.isArray(rows)||rows[0]?.role!=='admin'){res.status(403).json({error:'admin_required'});return null;}
  return {id:user.id,email:user.email};
 }catch{res.status(503).json({error:'authorization_unavailable'});return null;}
}
