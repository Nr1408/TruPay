import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ShortcutOverlayProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

const SHORTCUTS: Array<{ section: string; rows: Array<{ keys: string; action: string }> }> = [
  {
    section: "Navigation",
    rows: [
      { keys: "J / K", action: "Move transaction selection down/up" },
      { keys: "Enter", action: "Expand/collapse highlighted transaction" },
      { keys: "Space", action: "Expand/collapse transaction details" },
      { keys: "?", action: "Open keyboard shortcut overlay" },
      { keys: "Esc", action: "Close any open drawer or modal" },
    ],
  },
  {
    section: "Transaction Actions",
    rows: [
      { keys: "F", action: "Flag active case" },
      { keys: "E", action: "Escalate active case" },
      { keys: "D", action: "Dismiss active case" },
      { keys: "N", action: "Open note input for active case" },
    ],
  },
  {
    section: "Panel Controls",
    rows: [
      { keys: "Click Node", action: "Open node detail drawer" },
      { keys: "Esc", action: "Close open drawers and modals" },
    ],
  },
  {
    section: "Case Management",
    rows: [
      { keys: "Bulk Toolbar", action: "Run bulk dismiss/escalate/export" },
      { keys: "Select All", action: "Toggle all visible transactions" },
    ],
  },
];

export function ShortcutOverlay({ open, onOpenChange }: ShortcutOverlayProps) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(true)}
        className="fixed bottom-5 right-5 z-40 h-9 w-9 rounded-full border-zinc-700 bg-zinc-900/90 p-0 text-zinc-300 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:bg-zinc-800"
      >
        <Keyboard className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl border-zinc-700 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-[0.2em]">
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {SHORTCUTS.map((section) => (
              <div key={section.section} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-400">
                  {section.section}
                </h3>
                <div className="space-y-2">
                  {section.rows.map((row) => (
                    <div key={`${section.section}-${row.keys}`} className="flex items-center justify-between gap-3 text-sm">
                      <span className="rounded-md border border-zinc-700 bg-black px-2 py-0.5 font-mono text-xs text-zinc-200">
                        {row.keys}
                      </span>
                      <span className="text-right text-zinc-400">{row.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
