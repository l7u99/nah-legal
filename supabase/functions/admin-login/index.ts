import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});try{
 const {username}=await req.json(); if(!username)return Response.json({error:"unauthorized"},{status:401,headers:cors});
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const {data}=await db.from("admin_users").select("user_id,active").eq("username",username).single();
 if(!data?.active)return Response.json({error:"unauthorized"},{status:401,headers:cors});
 const {data:user,error}=await db.auth.admin.getUserById(data.user_id);
 if(error||!user.user?.email)return Response.json({error:"unauthorized"},{status:401,headers:cors});
 return Response.json({email:user.user.email},{headers:cors});
}catch{return Response.json({error:"unauthorized"},{status:401,headers:cors});}});