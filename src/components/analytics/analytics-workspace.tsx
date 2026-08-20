"use client";

import { Line, LineChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useChartPalette } from "@/hooks/use-chart-palette";
import type { MonthlyScoredPoint, SectorPerformance, TierCount } from "@/lib/data/analytics";

export function AnalyticsWorkspace({
  trend,
  sectorPerf,
  tierDist,
}: {
  trend: MonthlyScoredPoint[];
  sectorPerf: SectorPerformance[];
  tierDist: TierCount[];
}) {
  const palette = useChartPalette();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Companies scored per month</CardTitle>
          <CardDescription>Trailing 6 months.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: 4, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} stroke={palette.ink.grid} />
                <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: palette.ink.axis }} tick={{ fill: palette.ink.text, fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: palette.ink.muted, fontSize: 11 }} width={32} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line
                  type="monotone"
                  dataKey="scored"
                  stroke={palette.categorical[0]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: palette.categorical[0] }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scored companies by sector</CardTitle>
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
                      <Cell key={s.sector} fill={palette.categorical[i]} />
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
