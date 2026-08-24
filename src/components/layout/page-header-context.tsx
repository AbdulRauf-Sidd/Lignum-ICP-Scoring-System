"use client";

import * as React from "react";

interface HeaderContent {
  title: string;
  description?: string;
}

interface PageHeaderContextValue {
  content: HeaderContent | null;
  setContent: (content: HeaderContent | null) => void;
}

const PageHeaderContext = React.createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = React.useState<HeaderContent | null>(null);
  const value = React.useMemo(() => ({ content, setContent }), [content]);
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

export function usePageHeaderContent() {
  const ctx = React.useContext(PageHeaderContext);
  if (!ctx) throw new Error("usePageHeaderContent must be used within a PageHeaderProvider");
  return ctx;
}
