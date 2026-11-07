// Diagnostic endpoint. Never returns credentials or seller data.
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  return res.status(200).json({
    service:'fixar-shopee-backend',
    status:'ready_for_configuration',
    environment:process.env.SHOPEE_ENV==='live'?'live':'sandbox',
    configured:{
      partnerId:Boolean(process.env.SHOPEE_PARTNER_ID),
      partnerKey:Boolean(process.env.SHOPEE_PARTNER_KEY),
      redirectUrl:Boolean(process.env.SHOPEE_REDIRECT_URL),
      adminToken:Boolean(process.env.FIXAR_ADMIN_TOKEN)
    },
    authorizationEnabled:false,
    message:'Backend inicial instalado. OAuth e consulta de pedidos ainda nao estao habilitados.'
  });
}
