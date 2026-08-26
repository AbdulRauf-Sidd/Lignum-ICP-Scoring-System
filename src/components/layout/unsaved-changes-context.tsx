"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GuardState {
  dirty: boolean;
  onSave: () => Promise<boolean>;
}

interface UnsavedChangesContextValue {
  setGuard: (state: GuardState | null) => void;
}

const UnsavedChangesContext = React.createContext<UnsavedChangesContextValue | null>(null);

// A page with a draft form registers itself here. `dirty` gates the
// document-level click interceptor below; `onSave` is called (via ref, so
// this doesn't need to be stable across renders) when the user chooses to
// save before leaving.
export function useUnsavedChangesGuard(dirty: boolean, onSave: () => Promise<boolean>) {
  const ctx = React.useContext(UnsavedChangesContext);
  const onSaveRef = React.useRef(onSave);
  onSaveRef.current = onSave;

  React.useEffect(() => {
    if (!ctx) return;
    ctx.setGuard({ dirty, onSave: () => onSaveRef.current() });
    return () => ctx.setGuard(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, dirty]);
}

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const guardRef = React.useRef<GuardState | null>(null);
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const setGuard = React.useCallback((state: GuardState | null) => {
    guardRef.current = state;
  }, []);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!guardRef.current?.dirty) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      // Capture-phase + stopPropagation here runs before Next.js's own Link
      // click handler (a bubble-phase listener further down the tree), so
      // this reliably intercepts client-side navigation before it starts.
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  React.useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!guardRef.current?.dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function cancel() {
    setPendingHref(null);
  }

  function discardAndLeave() {
    if (!pendingHref) return;
    guardRef.current = null;
    const href = pendingHref;
    setPendingHref(null);
    router.push(href);
  }

  async function saveAndLeave() {
    if (!guardRef.current || !pendingHref) return;
    setSaving(true);
    try {
      const ok = await guardRef.current.onSave();
      if (ok) {
        guardRef.current = null;
        const href = pendingHref;
        setPendingHref(null);
        router.push(href);
      }
    } finally {
      setSaving(false);
    }
  }

  const value = React.useMemo<UnsavedChangesContextValue>(() => ({ setGuard }), [setGuard]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <Dialog open={pendingHref !== null} onOpenChange={(open) => !open && cancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>
              You have unsaved changes on this page. They&apos;ll be lost if you leave without saving.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
            <Button variant="outline" onClick={discardAndLeave} disabled={saving}>
              Don&apos;t save
            </Button>
            <Button onClick={saveAndLeave} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UnsavedChangesContext.Provider>
  );
}
