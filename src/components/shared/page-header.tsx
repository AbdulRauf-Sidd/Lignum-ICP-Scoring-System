"use client";

import * as React from "react";
import { usePageHeaderContent } from "@/components/layout/page-header-context";

export function PageHeader({ title, description }: { title: string; description?: string }) {
  const { setContent } = usePageHeaderContent();

  React.useEffect(() => {
    setContent({ title, description });
  }, [title, description, setContent]);

  return null;
}
