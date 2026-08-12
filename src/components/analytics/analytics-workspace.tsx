"use client";

import * as React from "react";
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getMonthlyScoredTrend,
  getSectorPerformance,
  getTierDistribution,
  getUserBreakdown,
} from "@/lib/mock/derived";
import { CURRENT_USER } from "@/lib/constants";
import { useChartPalette } from "@/hooks/use-chart-palette";
import { formatGbp } from "@/lib/format";

export function AnalyticsWorkspace() {
  const [view, setView] = React.useState<"overall" | "byUser">("overall");
  const palette = useChartPalette();

  const trend = getMonthlyScoredTrend();
  const sectorPerf = getSectorPerformance();
  const tierDist = getTierDistribution();
  const userBreakdown = getUserBreakdown();

  return (
    <div className="flex flex-col gap-6">
      {CURRENT_USER.role === "admin" && (
        <Tabs value={view} onValueChange={(v) => setView(v as "overall" | "byUser")}>
          <TabsList>
            <TabsTrigger value="overall">Overall</TabsTrigger>
            <TabsTrigger value="byUser">By user</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Companies scored per month</CardTitle>
          <CardDescription>Trend across the current build-out period.</CardDescription>
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

      {CURRENT_USER.role === "admin" && view === "byUser" && (
        <Card>
          <CardHeader>
            <CardTitle>Breakdown by user</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Companies processed</TableHead>
                    <TableHead>Metered spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userBreakdown.map((row) => (
                    <TableRow key={row.user}>
                      <TableCell className="font-medium">{row.user}</TableCell>
                      <TableCell>{row.runs}</TableCell>
                      <TableCell>{row.companies}</TableCell>
                      <TableCell>{formatGbp(row.spendGbp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
