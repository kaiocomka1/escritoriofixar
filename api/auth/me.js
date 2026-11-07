import {requireAdmin} from '../_lib/admin.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
 const user=await requireAdmin(req,res);
 if(!user)return;
 return res.status(200).json({authenticated:true,role:'admin',userId:user.id});
}
