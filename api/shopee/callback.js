// Safe placeholder: do not exchange or expose Shopee authorization codes
// until a secure state validator and encrypted token storage are installed.
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  // Never echo code, shop_id, or any query parameter.
  return res.status(503).json({
    status:'not_enabled',
    message:'O callback Shopee esta reservado, mas o OAuth aguarda armazenamento seguro e validacao de state.'
  });
}
