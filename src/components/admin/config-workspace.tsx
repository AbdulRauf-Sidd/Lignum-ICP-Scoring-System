"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ICP_PROFILES } from "@/lib/mock/data";
import { SCORE_CATEGORY_LABELS } from "@/lib/constants";
import type { IcpProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORY_KEYS: (keyof IcpProfile["weights"])[] = [
  "icp_fit",
  "scale_footprint",
  "hiring_growth",
  "financial_viability",
];

export function ConfigWorkspace() {
  const [weights, setWeights] = React.useState<Record<string, IcpProfile["weights"]>>(() =>
    Object.fromEntries(ICP_PROFILES.map((p) => [p.id, { ...p.weights }])),
  );
  const [tierA, setTierA] = React.useState(82);
  const [tierB, setTierB] = React.useState(68);
  const [repullWindow, setRepullWindow] = React.useState(90);
  const [fxRate, setFxRate] = React.useState(0.79);
  const [contactPullRule, setContactPullRule] = React.useState("manual");
  const [prices, setPrices] = React.useState({ firecrawl: 0.05, exa: 0.03, llm: 0.08 });

  function updateWeight(icpId: string, key: keyof IcpProfile["weights"], value: number) {
    setWeights((prev) => ({ ...prev, [icpId]: { ...prev[icpId], [key]: value } }));
  }

  function sumFor(icpId: string) {
    return CATEGORY_KEYS.reduce((sum, k) => sum + (weights[icpId][k] || 0), 0);
  }

  function saveIcp(icp: IcpProfile) {
    if (sumFor(icp.id) !== 100) {
      toast.error("Weights must sum to 100", { description: `${icp.name} currently sums to ${sumFor(icp.id)}.` });
      return;
    }
    toast.success(`${icp.name} weights saved`, { description: "Applies on next score or re-score." });
  }

  function saveGlobal() {
    toast.success("Global config saved", { description: "Applies on next score or re-score, no new API spend." });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Per-ICP weights</CardTitle>
          <CardDescription>Weights must sum to 100 for each ICP before saving.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={ICP_PROFILES[0].id}>
            <TabsList className="flex-wrap">
              {ICP_PROFILES.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {p.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {ICP_PROFILES.map((p) => {
              const sum = sumFor(p.id);
              const valid = sum === 100;
              return (
                <TabsContent key={p.id} value={p.id} className="mt-4 flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {CATEGORY_KEYS.map((key) => (
                      <div key={key} className="space-y-1.5">
                        <Label>{SCORE_CATEGORY_LABELS[key]}</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={weights[p.id][key]}
                            onChange={(e) => updateWeight(p.id, key, Number(e.target.value))}
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1.5 border-transparent",
                        valid ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {valid ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                      Sum: {sum} / 100
                    </Badge>
                    <Button onClick={() => saveIcp(p)} disabled={!valid}>
                      Save {p.name} weights
                    </Button>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Global settings</CardTitle>
          <CardDescription>Tier thresholds, re-pull window, FX rate, contact-pull rule and metered-service prices.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tier A threshold</Label>
              <Input type="number" value={tierA} onChange={(e) => setTierA(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">Total score ≥ this value</p>
            </div>
            <div className="space-y-1.5">
              <Label>Tier B threshold</Label>
              <Input type="number" value={tierB} onChange={(e) => setTierB(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">Else tier C</p>
            </div>
            <div className="space-y-1.5">
              <Label>Re-pull window (days)</Label>
              <Input type="number" value={repullWindow} onChange={(e) => setRepullWindow(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">Skip re-redeem inside this window</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>FX rate (USD → GBP)</Label>
              <Input type="number" step="0.01" value={fxRate} onChange={(e) => setFxRate(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact-pull rule</Label>
              <Select value={contactPullRule} onValueChange={setContactPullRule}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual selection only</SelectItem>
                  <SelectItem value="auto_tier_a">Auto-pull for Tier A</SelectItem>
                  <SelectItem value="auto_tier_ab">Auto-pull for Tier A & B</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-3 text-sm font-medium">Metered service prices</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Firecrawl (£ / call)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={prices.firecrawl}
                  onChange={(e) => setPrices((p) => ({ ...p, firecrawl: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Exa (£ / call)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={prices.exa}
                  onChange={(e) => setPrices((p) => ({ ...p, exa: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">LLM (£ / 1k tokens)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={prices.llm}
                  onChange={(e) => setPrices((p) => ({ ...p, llm: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveGlobal}>Save global config</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
