import { Crown } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

interface PremiumLockProps {
  isLocked: boolean;
  description?: string;
  children: React.ReactNode;
}

export function PremiumLock({ isLocked, description, children }: PremiumLockProps) {
  const { t } = useTranslation();

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40 blur-[1px]">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-background/70 backdrop-blur-sm border-2 border-amber-400/30 z-10 px-4 py-6 gap-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold tracking-wide border border-amber-300 dark:border-amber-600">
          <Crown className="w-3.5 h-3.5" />
          {t("premium.badge")}
        </span>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          {description || t("premium.lockDefaultDesc")}
        </p>
        <Link
          href="/premium"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-sm font-bold hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md shadow-amber-500/20"
        >
          <Crown className="w-3.5 h-3.5" />
          {t("listings.upgradeToPremium")}
        </Link>
      </div>
    </div>
  );
}
