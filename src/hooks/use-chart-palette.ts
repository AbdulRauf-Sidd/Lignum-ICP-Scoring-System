"use client";

import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/use-mounted";
import {
  CATEGORICAL_LIGHT,
  CATEGORICAL_DARK,
  ORDINAL_LIGHT,
  ORDINAL_DARK,
  CHART_INK_LIGHT,
  CHART_INK_DARK,
} from "@/lib/chart-colors";

export function useChartPalette() {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";

  return {
    categorical: dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
    ordinal: dark ? ORDINAL_DARK : ORDINAL_LIGHT,
    ink: dark ? CHART_INK_DARK : CHART_INK_LIGHT,
  };
}
