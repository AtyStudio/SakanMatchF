import { MapPin, Wallet, Sparkles, CigaretteOff, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ListingMatchBreakdown } from "@/lib/api";

// NOTE: keep these in sync with LISTING_WEIGHTS in
// artifacts/api-server/src/services/matching.ts (source of truth).
const FACTOR_WEIGHTS: Record<keyof ListingMatchBreakdown, number> = {
  city: 30,
  budget: 35,
  lifestyle: 10,
  smoking: 10,
  amenities: 15,
};

const FACTOR_ORDER: (keyof ListingMatchBreakdown)[] = [
  "budget",
  "city",
  "amenities",
  "lifestyle",
  "smoking",
];

const FACTOR_ICONS: Record<keyof ListingMatchBreakdown, React.ReactNode> = {
  city: <MapPin className="w-3.5 h-3.5" />,
  budget: <Wallet className="w-3.5 h-3.5" />,
  lifestyle: <Sparkles className="w-3.5 h-3.5" />,
  smoking: <CigaretteOff className="w-3.5 h-3.5" />,
  amenities: <ListChecks className="w-3.5 h-3.5" />,
};

function barColor(score: number): string {
  if (score >= 75) return "bg-green-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(score: number): string {
  if (score >= 75) return "text-green-700 dark:text-green-400";
  if (score >= 45) return "text-amber-700 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function fmtPts(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

interface MatchBreakdownProps {
  breakdown: ListingMatchBreakdown;
  compact?: boolean;
}

export function MatchBreakdown({ breakdown, compact }: MatchBreakdownProps) {
  const { t } = useTranslation();

  const labels: Record<keyof ListingMatchBreakdown, string> = {
    city: t("listings.detail.matchCity"),
    budget: t("listings.detail.matchBudget"),
    lifestyle: t("listings.detail.matchLifestyle"),
    smoking: t("listings.detail.matchSmoking"),
    amenities: t("listings.detail.matchAmenities"),
  };

  const total = FACTOR_ORDER.reduce(
    (sum, key) => sum + (breakdown[key] * FACTOR_WEIGHTS[key]) / 100,
    0,
  );

  return (
    <div className={cn("space-y-2.5", compact ? "text-xs" : "text-sm")}>
      {!compact && (
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {t("listings.detail.matchBreakdown")}
        </p>
      )}
      {FACTOR_ORDER.map((key) => {
        const score = breakdown[key];
        const weight = FACTOR_WEIGHTS[key];
        const contribution = (score * weight) / 100;
        return (
          <div key={key} className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-1.5 flex-shrink-0",
              compact ? "w-[110px]" : "w-[150px]",
            )}>
              <span className="text-primary">{FACTOR_ICONS[key]}</span>
              <span className="font-medium text-foreground truncate">
                {labels[key]}
              </span>
            </div>
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", barColor(score))}
                style={{ width: `${score}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 justify-end">
              <span className={cn("font-bold tabular-nums w-9 text-end", scoreTextColor(score))}>
                {score}%
              </span>
              <span
                className="text-[10px] font-medium text-muted-foreground bg-secondary/70 px-1.5 py-0.5 rounded-md tabular-nums"
                title={t("listings.detail.matchWeight")}
              >
                ×{weight}%
              </span>
              <span
                className="text-[11px] font-semibold text-foreground tabular-nums w-12 text-end"
                title={t("listings.detail.matchContribution")}
              >
                {fmtPts(contribution)}{t("listings.detail.matchPts")}
              </span>
            </div>
          </div>
        );
      })}
      {!compact && (
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/50 text-xs">
          <span className="font-semibold text-muted-foreground uppercase tracking-wider">
            {t("listings.detail.matchTotal")}
          </span>
          <span className="font-bold text-foreground tabular-nums">
            {fmtPts(total)}{t("listings.detail.matchPts")} / 100
          </span>
        </div>
      )}
    </div>
  );
}
