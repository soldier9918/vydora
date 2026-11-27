import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  handler: null as null | ((r: Request) => Promise<Response>),
  event: {} as Record<string, any>,
  grants: [] as Record<string, any>[],
  events: new Set<string>(),
  checkout: vi.fn(),
  signature: vi.fn(),
}));

vi.mock("../../supabase/functions/_shared/common.ts", () => {
  const db = { from: (table: string) => {
    const filters: Record<string, unknown> = {};
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      maybeSingle: async () => ({data: table === "processed_stripe_events" ? (state.events.has(String(filters.event_id)) ? {event_id:filters.event_id} : null) : table === "user_subscriptions" ? {user_id:"test-user",stripe_customer_id:"cus_test",status:"incomplete"} : null,error:null}),
      insert: async (row: Record<string, any>) => {
        if(table === "credit_ledger") {
          if(state.grants.some((g) => g.stripe_invoice_id === row.stripe_invoice_id)) return {error:{code:"23505"}};
          state.grants.push(row);
        }
        if(table === "processed_stripe_events") state.events.add(row.event_id);
        return {error:null};
      },
    };
    return query;
  }};
  return {adminClient:() => db, getUserClient:async () => ({user:{id:"test-user",email:"test@example.com"}}),corsHeaders:{},json:(body:unknown,status=200)=>new Response(JSON.stringify(body),{status})};
});
vi.mock("../../supabase/functions/_shared/stripe.ts", () => ({
  LIVE:true, WEBHOOK_SECRET:"test-only", TOPUP_CREDITS_PER_GBP:25,
  PLANS:{price_creator:{tier:"creator",credits:600},price_pro:{tier:"pro",credits:2000}},
  TIER_PRICE:{creator:"price_creator",pro:"price_pro"},
  returnOrigin:() => "https://example.com",billingBlocked:async () => null,
  stripe:{webhooks:{constructEventAsync:state.signature},checkout:{sessions:{create:state.checkout}}},
}));
vi.stubGlobal("Deno", { serve: (handler: (r: Request) => Promise<Response>) => { state.handler=handler; } });
const webhookPath = "../../supabase/functions/stripe-webhook/index.ts";
await import(/* @vite-ignore */ webhookPath);
const webhook=state.handler;
const checkoutPath = "../../supabase/functions/create-checkout/index.ts";
await import(/* @vite-ignore */ checkoutPath);
const checkout=state.handler;

describe("real payment handlers with simulated Stripe confirmations", () => {
  beforeEach(() => {
    state.grants=[];state.events.clear();state.checkout.mockReset();state.signature.mockReset();
    state.signature.mockImplementation(async () => state.event);
    state.checkout.mockResolvedValue({url:"https://checkout.stripe.com/test-only"});
  });
  const send=async () => {
    if(!webhook) throw Error("Missing webhook handler");
    return webhook(new Request("https://example.com",{method:"POST",headers:{"stripe-signature":"test-only"},body:"simulated"}));
  };
  const topup=(payment_status:string) => ({id:"evt_test",livemode:true,type:"checkout.session.completed",data:{object:{id:"cs_test",mode:"payment",payment_status,invoice:"in_test",client_reference_id:"test-user",metadata:{app:"vydora",kind:"topup",credits:"125"}}}});
  it("a verified £5 top-up grants 125 credits only once across event retries", async () => {
    state.event=topup("paid");
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200);
    state.event={...state.event,id:"evt_second",type:"checkout.session.async_payment_succeeded"};
    expect((await send()).status).toBe(200);
    expect(state.grants).toHaveLength(1);
    expect(state.grants[0]).toMatchObject({amount:125,reason:"topup",livemode:true});
  });
  it("an unpaid checkout never grants credits", async () => {
    state.event=topup("unpaid");
    await send();
    expect(state.grants).toHaveLength(0);
  });
  it("invalid webhook signatures cannot grant credits", async () => {
    state.signature.mockRejectedValue(Error("invalid signature"));
    expect((await send()).status).toBe(400);
    expect(state.grants).toHaveLength(0);
  });
  for(const [tier,credits] of [["creator",600],["pro",2000]] as const) it(`${tier} renewals retain ${credits} monthly credits`, async () => {
    state.event={id:`evt_${tier}`,livemode:true,type:"invoice.paid",data:{object:{id:`in_${tier}`,status:"paid",subscription:"sub_test",customer:"cus_test",amount_paid:tier==="creator"?1900:4900,billing_reason:"subscription_cycle",lines:{data:[{amount:1900,price:{id:`price_${tier}`}}]}}}};
    await send(); await send();
    expect(state.grants).toHaveLength(1);
    expect(state.grants[0]).toMatchObject({amount:credits,reason:"subscription",billing_reason:"subscription_cycle"});
  });
  it("server checkout rejects £4.99 before contacting Stripe", async () => {
    if(!checkout) throw Error("Missing checkout handler");
    expect((await checkout(new Request("https://example.com",{method:"POST",body:JSON.stringify({amount_gbp:4.99})}))).status).toBe(400);
    expect(state.checkout).not.toHaveBeenCalled();
  });
  it("server checkout accepts £5 without a subscription and requests 125 credits", async () => {
    if(!checkout) throw Error("Missing checkout handler");
    const response=await checkout(new Request("https://example.com",{method:"POST",body:JSON.stringify({amount_gbp:5})}));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({credits:125});
    expect(state.checkout).toHaveBeenCalledWith(expect.objectContaining({mode:"payment",metadata:expect.objectContaining({credits:"125"}),line_items:[expect.objectContaining({price_data:expect.objectContaining({unit_amount:500,currency:"gbp"})})]}));
    expect(state.grants).toHaveLength(0);
  });
});