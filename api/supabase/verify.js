// Server-side verification of Supabase connectivity and schema.
// Does not expose credentials, rows, or database errors to the caller.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)return res.status(503).json({connected:false,schemaVerified:false,reason:'missing_configuration'});
  let base;
  try{
    base=new URL(url);
    if(base.protocol!=='https:'||!base.hostname.endsWith('.supabase.co'))throw Error('invalid');
  }catch{return res.status(503).json({connected:false,schemaVerified:false,reason:'invalid_configuration'});}
  const tables=['profiles','marketplace_stores','integration_credentials','integration_events'];
  try{
    const results=await Promise.all(tables.map(async table=>{
      const response=await fetch(new URL('/rest/v1/'+table+'?select=*&limit=0',base),{
        method:'GET',
        headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'},
        signal:AbortSignal.timeout(8000)
      });
      return response.ok;
    }));
    const all=results.every(Boolean);
    return res.status(all?200:503).json({connected:all,schemaVerified:all,checkedTables:tables.length,reason:all?null:'schema_or_permission_error'});
  }catch{
    return res.status(503).json({connected:false,schemaVerified:false,reason:'connection_failed'});
  }
}
