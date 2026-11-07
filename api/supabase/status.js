// Configuration-only health check; no secrets or database rows are exposed.
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  return res.status(200).json({
    service:'fixar-supabase',
    configuration:{
      url:Boolean(process.env.SUPABASE_URL),
      publishableKey:Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
      secretKey:Boolean(process.env.SUPABASE_SECRET_KEY)
    },
    databaseConnectionVerified:false,
    schemaInstalled:'not_checked',
    authenticationEnabled:false
  });
}
