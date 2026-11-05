import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers:cors });
  try {
    const body = await req.json();
    const { full_name, phone, question_set_id, answers } = body;
    if (!full_name || full_name.trim().split(/\s+/).length < 3 || !/^05\d{8}$/.test(phone || "") || !question_set_id || !Array.isArray(answers) || answers.length !== 3)
      return Response.json({error:"بيانات المشاركة غير مكتملة أو غير صحيحة"},{status:400,headers:cors});
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data:set,error:setErr}=await admin.from("question_sets").select("id,status,starts_at,ends_at").eq("id",question_set_id).single();
    const now = new Date();
    if(setErr || set.status!=="published" || (set.starts_at && now < new Date(set.starts_at)) || (set.ends_at && now > new Date(set.ends_at)))
      return Response.json({error:"المجموعة غير متاحة حاليًا"},{status:409,headers:cors});
    const {data:qs,error:qErr}=await admin.from("questions").select("id,body,correct_option_id,explanation,law_name,article_number,source_name,source_url").eq("question_set_id",question_set_id);
    if(qErr || qs.length!==3) return Response.json({error:"مجموعة الأسئلة غير مكتملة"},{status:500,headers:cors});
    const qmap=new Map(qs.map(q=>[q.id,q]));
    if(answers.some((a:any)=>!qmap.has(a.question_id)) || new Set(answers.map((a:any)=>a.question_id)).size!==3)
      return Response.json({error:"الإجابات لا تطابق أسئلة المجموعة"},{status:400,headers:cors});
    const {data:opts,error:oErr}=await admin.from("options").select("id,question_id").in("id",answers.map((a:any)=>a.option_id));
    if(oErr || opts.length!==3 || answers.some((a:any)=>!opts.some((o:any)=>o.id===a.option_id&&o.question_id===a.question_id)))
      return Response.json({error:"اختيارات غير صالحة"},{status:400,headers:cors});
    const pepper=Deno.env.get("PHONE_HASH_PEPPER")!;
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(pepper+phone));
    const phone_hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
    const {data:existing}=await admin.from("participants").select("id").eq("phone_hash",phone_hash).maybeSingle();
    let participantId=existing?.id;
    if(!participantId){
      const {data:p,error}=await admin.from("participants").insert({full_name:full_name.trim(),phone,phone_hash}).select("id").single();
      if(error) throw error; participantId=p.id;
    }
    const {data:prior}=await admin.from("participations").select("id").eq("participant_id",participantId).eq("question_set_id",question_set_id).maybeSingle();
    if(prior) return Response.json({error:"تم تسجيل مشاركة بهذا الرقم لهذا الأسبوع مسبقًا"},{status:409,headers:cors});
    const score=answers.reduce((n:number,a:any)=>n+(qmap.get(a.question_id).correct_option_id===a.option_id?1:0),0);
    const {data:part,error:pErr}=await admin.from("participations").insert({participant_id:participantId,question_set_id,score,total:3,completed_at:new Date().toISOString()}).select("id").single();
    if(pErr) throw pErr;
    const rows=answers.map((a:any)=>({participation_id:part.id,question_id:a.question_id,selected_option_id:a.option_id,is_correct:qmap.get(a.question_id).correct_option_id===a.option_id}));
    const {error:aErr}=await admin.from("participation_answers").insert(rows); if(aErr) throw aErr;
    const details = await Promise.all(answers.map(async (a:any) => {
      const q:any=qmap.get(a.question_id);
      const {data:optsForQ,error:optErr}=await admin.from("options").select("id,label").eq("question_id",a.question_id);
      if(optErr) throw optErr;
      const selected=optsForQ.find((o:any)=>o.id===a.option_id);
      const correct=optsForQ.find((o:any)=>o.id===q.correct_option_id);
      return {question:q.body,selected:selected?.label||"",correct:correct?.label||"",is_correct:a.option_id===q.correct_option_id,
        explanation:q.explanation,law_name:q.law_name,article_number:q.article_number,source_name:q.source_name,source_url:q.source_url};
    }));
    return Response.json({participation_id:part.id,result:{score,total:3,answer_details:details}},{headers:cors});
  } catch(e) { return Response.json({error:"تعذر حفظ المشاركة"},{status:500,headers:cors}); }
});