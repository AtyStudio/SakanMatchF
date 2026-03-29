import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { useLocation } from "wouter";
import { useGetPremiumStatus, useCreateSubscription, useActivateSubscription, useCancelSubscription } from "@workspace/api-client-react";
import { Crown, CheckCircle2, Star, ShieldCheck, Zap, AlertTriangle, XCircle, ImageIcon, Layers, BarChart2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function Premium() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { t } = useTranslation();

  const { data: status, isLoading: isStatusLoading } = useGetPremiumStatus({
    query: {
      enabled: !!user,
    }
  });

  const createSubscriptionMutation = useCreateSubscription();
  const activateSubscriptionMutation = useActivateSubscription();
  const cancelSubscriptionMutation = useCancelSubscription();

  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const justSubscribed = searchParams?.get("subscribed") === "true";
  const wasCancelled = searchParams?.get("cancelled") === "true";
  const subscriptionId = searchParams?.get("subscription_id");

  const comparisonRows = [
    { feature: t("premium.comparison.activeListings"), free: t("premium.comparison.oneListing"), premium: t("premium.comparison.unlimited") },
    { feature: t("premium.comparison.photosPerListing"), free: t("premium.comparison.upToFour"), premium: t("premium.comparison.upToTen") },
    { feature: t("premium.comparison.searchRanking"), free: t("premium.comparison.standard"), premium: t("premium.comparison.priority") },
    { feature: t("premium.comparison.featuredBadge"), free: false, premium: true },
    { feature: t("premium.comparison.perListingAnalytics"), free: false, premium: true },
    { feature: t("premium.comparison.viewsClicks"), free: false, premium: true },
    { feature: t("premium.comparison.requestTracking"), free: false, premium: true },
    { feature: t("premium.comparison.verifiedBadge"), free: false, premium: true },
  ];

  useEffect(() => {
    if (wasCancelled) {
      toast({
        title: t("premium.notStarted"),
        description: t("premium.notStartedDesc"),
      });
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [wasCancelled]);

  useEffect(() => {
    if (justSubscribed && subscriptionId) {
      activateSubscriptionMutation.mutate(
        { data: { subscriptionID: subscriptionId } },
        {
          onSuccess: (data) => {
            if (data.status === "ACTIVE") {
              toast({ title: t("premium.welcomeToPremium"), description: t("premium.welcomeDesc") });
            } else if (data.status === "APPROVAL_PENDING") {
              toast({ title: t("premium.almostThere"), description: data.message ?? t("premium.subscriptionConfirm") });
            } else {
              toast({ title: t("premium.subscriptionCreated"), description: t("premium.subscriptionConfirm") });
            }
            queryClient.invalidateQueries({ queryKey: ["/api/premium/status"] });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            if (typeof window !== "undefined") {
              window.history.replaceState({}, "", window.location.pathname);
            }
          },
          onError: () => {
            toast({ title: t("premium.subscriptionCreated"), description: t("premium.subscriptionConfirm") });
            queryClient.invalidateQueries({ queryKey: ["/api/premium/status"] });
            if (typeof window !== "undefined") {
              window.history.replaceState({}, "", window.location.pathname);
            }
          },
        }
      );
    }
  }, [justSubscribed, subscriptionId]);

  if (!isAuthLoading && !user) {
    setLocation("/login");
    return null;
  }

  if (!isAuthLoading && user && user.role !== "owner") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-grow max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
          <div className="text-center">
            <Crown className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">{t("premium.ownersOnly")}</h1>
            <p className="text-muted-foreground">{t("premium.ownersOnlyDesc")}</p>
          </div>
        </main>
      </div>
    );
  }

  if (isAuthLoading || isStatusLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const isPremium = status?.isPremium || user?.isPremium;
  const subStatus = status?.subscriptionStatus ?? user?.subscriptionStatus ?? null;
  const isInactive = subStatus === "cancelled" || subStatus === "suspended" || subStatus === "expired";

  const handleCancel = async () => {
    if (!window.confirm(t("premium.cancelConfirm"))) {
      return;
    }
    try {
      await cancelSubscriptionMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ["/api/premium/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: t("premium.subscriptionCancelled"), description: t("premium.cancelledDesc") });
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("premium.cancelError") });
    }
  };

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const res = await createSubscriptionMutation.mutateAsync();
      if (res.approvalUrl) {
        window.location.href = res.approvalUrl;
      } else {
        toast({ variant: "destructive", title: t("common.error"), description: t("premium.subscribeError") });
        setIsSubscribing(false);
      }
    } catch {
      toast({ variant: "destructive", title: t("common.error"), description: t("premium.subscribeError") });
      setIsSubscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-grow max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {isPremium && !isInactive ? (
          <div className="space-y-10">
            <div className="bg-gradient-to-br from-amber-100 via-yellow-100 to-amber-200 rounded-3xl p-10 text-center shadow-xl border border-yellow-300/50">
              <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Crown className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-display font-bold text-yellow-900 mb-4">{t("premium.premiumMember")}</h1>
              <p className="text-yellow-800/80 text-lg mb-8 max-w-lg mx-auto">
                {t("premium.premiumMemberDesc")}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="inline-flex flex-col items-center p-4 bg-white/50 backdrop-blur-sm rounded-2xl">
                  <span className="text-sm font-semibold text-yellow-900 uppercase tracking-wider mb-1">{t("premium.activatedOn")}</span>
                  <span className="text-lg font-bold text-yellow-800">
                    {status?.premiumActivatedAt ? format(new Date(status.premiumActivatedAt), 'MMMM do, yyyy') : t("premium.recently")}
                  </span>
                </div>
                <div className="inline-flex flex-col items-center p-4 bg-white/50 backdrop-blur-sm rounded-2xl">
                  <span className="text-sm font-semibold text-yellow-900 uppercase tracking-wider mb-1">{t("premium.subscription")}</span>
                  <span className="text-lg font-bold text-green-700 capitalize">
                    {subStatus || "Active"}
                  </span>
                </div>
                {status?.lastPaymentAt && (
                  <div className="inline-flex flex-col items-center p-4 bg-white/50 backdrop-blur-sm rounded-2xl">
                    <span className="text-sm font-semibold text-yellow-900 uppercase tracking-wider mb-1">{t("premium.lastPayment")}</span>
                    <span className="text-lg font-bold text-yellow-800">
                      {format(new Date(status.lastPaymentAt), 'MMM do, yyyy')}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-yellow-300/50">
                <button
                  onClick={handleCancel}
                  disabled={cancelSubscriptionMutation.isPending}
                  className="mx-auto flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {cancelSubscriptionMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                      {t("premium.cancelling")}
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      {t("premium.cancelSubscription")}
                    </>
                  )}
                </button>
                <p className="text-xs text-yellow-800/60 text-center mt-2">{t("premium.cancelNote")}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {isInactive && (
              <div className="mb-8 p-6 rounded-2xl border flex items-start gap-4 bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800">
                {subStatus === "cancelled" ? (
                  <XCircle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-semibold text-foreground">
                    {subStatus === "cancelled" ? t("premium.subscriptionCancelled") : subStatus === "suspended" ? t("premium.subscriptionSuspended") : t("premium.subscriptionExpired")}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {subStatus === "cancelled"
                      ? t("premium.cancelledDesc")
                      : subStatus === "suspended"
                      ? t("premium.suspendedDesc")
                      : t("premium.expiredDesc")}
                  </p>
                </div>
              </div>
            )}

            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold mb-4">
                <Star className="w-4 h-4" /> {t("premium.forOwners")}
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4 leading-tight">
                {t("premium.title")}
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                {t("premium.subtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start mb-14">
              <div className="bg-card rounded-3xl border border-border/50 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-border bg-secondary/50">
                  <h3 className="font-bold text-lg text-foreground text-center">{t("premium.planComparison")}</h3>
                </div>
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-3 px-5 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    <span>{t("premium.feature")}</span>
                    <span className="text-center">{t("premium.free")}</span>
                    <span className="text-center text-amber-600">{t("premium.premiumLabel")}</span>
                  </div>
                  {comparisonRows.map((row) => (
                    <div key={row.feature} className="grid grid-cols-3 items-center px-5 py-3.5">
                      <span className="text-sm font-medium text-foreground">{row.feature}</span>
                      <span className="text-center">
                        {row.free === false ? (
                          <X className="w-4 h-4 text-muted-foreground/50 mx-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground">{row.free as string}</span>
                        )}
                      </span>
                      <span className="text-center">
                        {row.premium === true ? (
                          <CheckCircle2 className="w-4 h-4 text-amber-500 mx-auto" />
                        ) : (
                          <span className="text-xs font-semibold text-amber-600">{row.premium as string}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-3xl p-8 border border-border shadow-2xl shadow-black/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 to-yellow-500" />

                <div className="text-center mb-8 pt-4">
                  <div className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-bold mb-3">
                    <Crown className="w-3.5 h-3.5" /> {t("premium.premiumLabel")}
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">{t("premium.monthlyPremium")}</h2>
                  <div className="mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-display font-bold text-foreground">$9.99</span>
                    <span className="text-muted-foreground font-medium">{t("premium.perMonth")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{t("premium.cancelAnytime")}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3 text-sm text-foreground">
                    <Layers className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{t("premium.unlimitedListings")}</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm text-foreground">
                    <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{t("premium.tenPhotos")}</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm text-foreground">
                    <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{t("premium.priorityPlacement")}</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm text-foreground">
                    <Star className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{t("premium.featuredBadge")}</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm text-foreground">
                    <BarChart2 className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{t("premium.analytics")}</span>
                  </li>
                  <li className="flex items-center gap-3 text-sm text-foreground">
                    <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{t("premium.verifiedBadge")}</span>
                  </li>
                </ul>

                <div className="pt-5 border-t border-border">
                  <button
                    onClick={handleSubscribe}
                    disabled={isSubscribing}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold rounded-2xl text-lg transition-all shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubscribing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {t("premium.redirectingToPaypal")}
                      </>
                    ) : (
                      <>
                        <Crown className="w-5 h-5" />
                        {isInactive ? t("premium.resubscribeToPremium") : t("premium.subscribeToPremium")}
                      </>
                    )}
                  </button>
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    {t("premium.securePayment")}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
