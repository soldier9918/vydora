import { useEffect, useState } from "react";
import { CREDIT_NOTICE_EVENT, type CreditNotice } from "@/lib/creditNotice";
import { useAccount } from "@/lib/account";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import CreditsRequired from "@/components/CreditsRequired";

export default function CreditNoticeHost() {
  const [notice, setNotice] = useState<CreditNotice | null>(null);
  const { data: account } = useAccount();
  useEffect(() => {
    const receive = (event: Event) => setNotice((event as CustomEvent<CreditNotice>).detail);
    window.addEventListener(CREDIT_NOTICE_EVENT, receive);
    return () => window.removeEventListener(CREDIT_NOTICE_EVENT, receive);
  }, []);
  return <Dialog open={notice !== null} onOpenChange={(open) => { if (!open) setNotice(null); }}>
    <DialogContent onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setNotice(null); }}>
      <DialogTitle className="sr-only">Credits Required</DialogTitle>
      <DialogDescription className="sr-only">Purchase credits or choose a subscription.</DialogDescription>
      <CreditsRequired balance={account?.balance ?? 0} required={notice?.required} />
    </DialogContent>
  </Dialog>;
}