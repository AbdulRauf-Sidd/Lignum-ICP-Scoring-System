import { cn } from "@/lib/utils";

function scoreColor(score: number) {
  if (score >= 82) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 68) return "text-primary";
  return "text-slate-500 dark:text-slate-400";
}

function scoreStroke(score: number) {
  if (score >= 82) return "stroke-emerald-500";
  if (score >= 68) return "stroke-primary";
  return "stroke-slate-400";
}

export function ScoreRing({ score, size = 44 }: { score: number | null; size?: number }) {
  if (score === null) {
    return (
      <div
        className="flex items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground"
        style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.3)) }}
      >
        —
      </div>
    );
  }
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={4}
          fill="none"
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={4}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={scoreStroke(score)}
        />
      </svg>
      <div
        className={cn("absolute inset-0 flex items-center justify-center font-semibold tabular-nums", scoreColor(score))}
        style={{ fontSize: Math.max(9, Math.round(size * 0.3)) }}
      >
        {Math.round(score)}
      </div>
    </div>
  );
}

export function ScoreBar({ label, subScore, weight, contribution, excluded }: {
  label: string;
  subScore: number | null;
  weight: number;
  contribution: number | null;
  excluded: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">
        {excluded ? (
          <span className="italic">excluded — no data</span>
        ) : (
          <>
            {subScore}
            <span className="text-xs"> / 100</span>
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            weight {weight}%
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            <span className="font-medium text-foreground">+{contribution}</span>
          </>
        )}
      </span>
    </div>
  );
}
