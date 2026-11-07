// Publishable project settings only. Never send the Supabase secret key.
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return res.status(503).json({error:'auth_not_configured'});
 return res.status(200).json({url,key});
}