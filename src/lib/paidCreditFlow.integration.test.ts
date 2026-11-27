import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Opt-in: only run against a disposable account with 25 explicitly granted test credits.
// Missing image guarantees failure before any paid AI provider request is made.
const path=process.env.LOVABLE_TEST_SESSION_FILE;
const enabled=process.env.LOVABLE_TEST_CREDIT_FLOW==="true" && !!path;
describe.skipIf(!enabled)("real atomic charge, retry and refund", () => {
  it("two simultaneous retries deduct once, refund once, and never overspend", async () => {
    if(!path) throw Error("Disposable test session required");
    const token=JSON.parse(readFileSync(path,"utf8")).session?.access_token;
    const client=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user}}=await client.auth.getUser(token);
    if(!user || !user.email?.startsWith("agent-test+")) throw Error("Requires a disposable agent test user");
    const {data:account,error:ae}=await client.rpc("effective_account",{_user:user.id});
    expect(ae).toBeNull();
    expect(account).toMatchObject({balance:25,canGenerate:true});
    const {data:video,error:ve}=await client.from("videos").insert({user_id:user.id,title:"Credit enforcement test",topic:"Credit enforcement test",style:"Documentary",voice:"Kore",target_seconds:60}).select("id").single();
    expect(ve).toBeNull();
    if(!video) throw Error("Missing test video");
    try {
      const {data:scene,error:se}=await client.from("video_scenes").insert({user_id:user.id,video_id:video.id,position:0,heading:"Test scene",narration:"A test scene.",visual_prompt:"A test scene.",image_path:`${user.id}/${video.id}/intentionally-missing-test.png`}).select("id").single();
      expect(se).toBeNull();
      if(!scene) throw Error("Missing test scene");
      const {data:before}=await client.from("credit_ledger").select("id").eq("user_id",user.id);
      const key=crypto.randomUUID();
      const call=()=>client.functions.invoke("animate-scene",{body:{sceneId:scene.id,action:"start"},headers:{"X-Idempotency-Key":key}});
      const responses=await Promise.all([call(),call()]);
      expect(responses.map((r)=>r.error?.context?.status).sort()).toEqual([409,500]);
      const {data:after}=await client.from("credit_ledger").select("id,amount,reason").eq("user_id",user.id);
      const ids=new Set(before?.map((r)=>r.id));
      expect(after?.filter((r)=>!ids.has(r.id)).map((r)=>({amount:r.amount,reason:r.reason})).sort((a,b)=>a.amount-b.amount)).toEqual([{amount:-25,reason:"animate_scene"},{amount:25,reason:"refund_animate"}]);
      const {data:finalAccount,error:finalError}=await client.rpc("effective_account",{_user:user.id});
      expect(finalError).toBeNull();
      expect(finalAccount).toMatchObject({balance:25,canGenerate:true});
      const concurrent=await Promise.all(Array.from({length:8},()=>client.functions.invoke("animate-scene",{body:{sceneId:scene.id,action:"start"},headers:{"X-Idempotency-Key":crypto.randomUUID()}})));
      for(const response of concurrent) expect([402,500]).toContain(response.error?.context?.status);
      const {data:history,error:historyError}=await client.from("credit_ledger").select("amount").eq("user_id",user.id).order("created_at");
      expect(historyError).toBeNull();
      let running=0;
      for(const row of history ?? []) { running+=row.amount; expect(running).toBeGreaterThanOrEqual(0); }
      expect(running).toBe(25);
    } finally {
      const {error}=await client.from("videos").delete().eq("id",video.id);
      expect(error).toBeNull();
    }
  },30000);
});