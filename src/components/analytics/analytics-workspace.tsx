"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useChartPalette } from "@/hooks/use-chart-palette";
import type { MonthlyScoredPoint, SectorPerformance, TierCount, SectorCompanyCount } from "@/lib/data/analytics";

export function AnalyticsWorkspace({
  trend,
  sectorPerf,
  tierDist,
  companiesBySector,
}: {
  trend: MonthlyScoredPoint[];
  sectorPerf: SectorPerformance[];
  tierDist: TierCount[];
  companiesBySector: SectorCompanyCount[];
}) {
  const palette = useChartPalette();
  const maxSectorCount = Math.max(1, ...companiesBySector.map((s) => s.count));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Companies by sector</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {companiesBySector.map((s, i) => (
            <div key={s.sector} className="flex items-center gap-3">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: palette.categorical[i % palette.categorical.length] }}
              />
              <span className="w-40 shrink-0 truncate text-sm">{s.sector}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(s.count / maxSectorCount) * 100}%`, background: palette.categorical[i % palette.categorical.length] }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">{s.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Companies scored per month</CardTitle>
          <CardDescription>Trailing 6 months.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} stroke={palette.ink.grid} />
                <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: palette.ink.axis }} tick={{ fill: palette.ink.text, fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: palette.ink.muted, fontSize: 11 }} width={32} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "transparent" }} />
                <Bar dataKey="scored" radius={[4, 4, 0, 0]} maxBarSize={48} fill={palette.categorical[0]} name="Scored" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scored companies by ICP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorPerf} layout="vertical" margin={{ left: 12, right: 20, top: 8 }}>
                  <CartesianGrid horizontal={false} stroke={palette.ink.grid} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: palette.ink.muted, fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="sector"
                    tickLine={false}
                    axisLine={false}
                    width={150}
                    tick={{ fill: palette.ink.text, fontSize: 12 }}
                  />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "transparent" }} />
                  <Bar dataKey="scoredCount" radius={[0, 4, 4, 0]} maxBarSize={28} name="Scored companies">
                    {sectorPerf.map((s, i) => (
                      <Cell key={s.sector} fill={palette.categorical[i % palette.categorical.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tier distribution</CardTitle>
            <CardDescription>Ordinal — A, B, C shown light to dark.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierDist} margin={{ left: 4, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} stroke={palette.ink.grid} />
                  <XAxis dataKey="tier" tickLine={false} axisLine={{ stroke: palette.ink.axis }} tick={{ fill: palette.ink.text, fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: palette.ink.muted, fontSize: 11 }} width={32} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: "transparent" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64} name="Companies">
                    {tierDist.map((t, i) => (
                      <Cell key={t.tier} fill={palette.ordinal[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
