// Intentionally disabled: no public OAuth entrypoint until admin
// authentication, CSRF protection, and persistent encrypted token storage exist.
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  return res.status(503).json({
    status:'not_enabled',
    message:'Conexao Shopee ainda nao habilitada. Configure o backend seguro antes de autorizar a loja.'
  });
}
