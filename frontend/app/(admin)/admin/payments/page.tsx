import { Wallet } from "lucide-react";

/* Placeholder — the Payment History module is built in Batch 3. Present so the
   sidebar link resolves instead of 404-ing during the migration. */
export default function PaymentsPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Payment History</h1>
      <div className="mt-8 flex items-center gap-4 rounded-xl border border-dashed border-line bg-card/60 p-8 text-muted-foreground">
        <Wallet size={22} className="text-primary/70" />
        <p className="text-sm">The payment-history ledger arrives in Batch&nbsp;3.</p>
      </div>
    </div>
  );
}
