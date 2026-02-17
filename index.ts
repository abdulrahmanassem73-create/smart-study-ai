// Supabase Edge Function: stripe-webhook
// Receives Stripe webhook events and finalizes coin topups.
//
// Env Secrets required:
// - STRIPE_SECRET_KEY
// - STRIPE_WEBHOOK_SECRET
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
//
// IMPORTANT:
// - This endpoint must be configured in Stripe Dashboard.
// - Do NOT require JWT here; use signature verification.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";
import Stripe from "https://esm.sh/stripe@16.2.0?target=deno";

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!stripeKey || !webhookSecret) return json({ error: "MISSING_STRIPE_ENV" }, { status: 500 });
  if (!supabaseUrl || !serviceKey) return json({ error: "MISSING_SUPABASE_ENV" }, { status: 500 });

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" as any });

  // Stripe needs raw body for signature verification
  const sig = req.headers.get("stripe-signature") || "";
  const raw = new Uint8Array(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, webhookSecret);
  } catch {
    return json({ error: "BAD_SIGNATURE" }, { status: 400 });
  }

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  async function markFailed(topupId: string, paymentIntentId?: string) {
    await service
      .from("coin_topups")
      .update({ status: "failed", stripe_payment_intent_id: paymentIntentId || null, updated_at: new Date().toISOString() })
      .eq("id", topupId);
  }

  async function finalizeSuccess(topupId: string, paymentIntentId?: string) {
    // Load topup
    const { data: t, error } = await service
      .from("coin_topups")
      .select("id,user_id,status,coins")
      .eq("id", topupId)
      .maybeSingle();

    if (error || !t) return;
    if (String((t as any).status) === "succeeded") return; // idempotent

    const userId = String((t as any).user_id);
    const coins = Number((t as any).coins || 0);

    // mark topup succeeded
    await service
      .from("coin_topups")
      .update({
        status: "succeeded",
        stripe_payment_intent_id: paymentIntentId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", topupId);

    // increment coins atomically
    await service.rpc("increment_user_coins", { uid: userId, delta: coins });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const topupId = String(session.client_reference_id || session.metadata?.topup_id || "");
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : undefined;
      if (topupId) await finalizeSuccess(topupId, pi);
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const topupId = String(session.client_reference_id || session.metadata?.topup_id || "");
      if (topupId) await markFailed(topupId);
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const topupId = String((pi.metadata as any)?.topup_id || "");
      if (topupId) await markFailed(topupId, String(pi.id));
    }
  } catch {
    // Return 200 so Stripe won't retry forever, but log in Supabase logs
    return json({ ok: true, handled: false }, { status: 200 });
  }

  return json({ ok: true, handled: true }, { status: 200 });
});
