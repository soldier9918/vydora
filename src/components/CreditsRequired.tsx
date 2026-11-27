import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const CREDITS_REQUIRED_MESSAGE = "Your account doesn't have enough credits to complete this action. Purchase credits starting from £5 or choose a subscription plan to start creating AI videos.";

export default function CreditsRequired({ balance, required }: { balance: number; required?: number }) {
  return <section role="alert" className="rounded-lg border border-primary/50 bg-primary/10 p-4 text-sm">
    <h2 className="font-semibold">Credits Required</h2>
    <p className="mt-1 text-muted-foreground">{CREDITS_REQUIRED_MESSAGE}</p>
    <p className="mt-2 font-semibold">Current balance: {balance} credits{required !== undefined ? ` · Required: ${required} credits` : ""}</p>
    <div className="mt-3 flex flex-wrap gap-3">
      <Button asChild size="sm"><Link to="/billing?topup=5#top-ups">Buy Credits — From £5</Link></Button>
      <Button asChild size="sm" variant="outline"><Link to="/billing#subscriptions">View Subscription Plans</Link></Button>
    </div>
  </section>;
}