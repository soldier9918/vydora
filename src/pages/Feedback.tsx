import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareHeart, Send } from "lucide-react";
import { toast } from "sonner";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const CATEGORIES = [
  { value: "general", label: "General feedback" },
  { value: "bug", label: "Something is broken" },
  { value: "idea", label: "Feature idea" },
  { value: "billing", label: "Billing or credits" },
  { value: "other", label: "Something else" },
] as const;

export default function Feedback() {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>("general");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const text = message.trim();
    if (text.length < 3) { toast.error("Write a little more first."); return; }
    if (text.length > 2000) { toast.error("Please keep it under 2,000 characters."); return; }
    if (!user) {
      const e = email.trim();
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast.error("That email address doesn't look right."); return; }
    }
    setBusy(true);
    const { error } = await supabase.from("feedback").insert({
      user_id: user?.id ?? null,
      email: user ? (user.email ?? null) : email.trim() || null,
      category,
      message: text,
    });
    setBusy(false);
    if (error) { toast.error("Couldn't send your feedback. Please try again."); return; }
    setSent(true);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container max-w-2xl py-12">
        <h1 className="flex items-center gap-3 text-4xl font-extrabold"><MessageSquareHeart className="h-9 w-9 text-primary" />Feedback</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us what you love, what's confusing, or what you'd like Vydora to do next. We read every message.
        </p>

        {sent ? (
          <div className="mt-8 rounded-xl border border-primary/40 bg-primary/5 p-6 text-center">
            <p className="text-lg font-bold">Thank you!</p>
            <p className="mt-1 text-sm text-muted-foreground">Your feedback has been sent. It genuinely shapes what we build next.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" onClick={() => { setSent(false); setMessage(""); }}>Send another</Button>
              <Button asChild><Link to="/dashboard">Back to my videos</Link></Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-6">
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">What's it about?
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>

            {!user && (
              <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Your email (optional — only if you'd like a reply)
                <Input type="email" maxLength={255} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
            )}

            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Your message
              <Textarea
                rows={6}
                maxLength={2000}
                placeholder="e.g. I wish I could change the caption font after the video is made…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <p className="text-right text-xs text-muted-foreground">{message.length}/2,000</p>

            <Button onClick={submit} disabled={busy || message.trim().length < 3}>
              <Send className="mr-2 h-4 w-4" />{busy ? "Sending…" : "Send feedback"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Prefer email? Write to <a className="font-semibold text-primary hover:underline" href="mailto:contact@vydora.ai">contact@vydora.ai</a>.
            </p>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
