import { Clock } from "lucide-react";

/* Placeholder — the Activity Log module is built in Batch 3. Present so the
   sidebar link resolves instead of 404-ing during the migration. */
export default function ActivityPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Activity Log</h1>
      <div className="mt-8 flex items-center gap-4 rounded-xl border border-dashed border-line bg-card/60 p-8 text-muted-foreground">
        <Clock size={22} className="text-primary/70" />
        <p className="text-sm">The activity history arrives in Batch&nbsp;3.</p>
      </div>
    </div>
  );
}
