import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Link, useLocation } from "wouter";
import { useGetMyListings, useDeleteListing } from "@workspace/api-client-react";
import { useGetListings } from "@workspace/api-client-react";
import { ListingCard } from "@/components/ListingCard";
import { api, type RequestItem, type Conversation, type FavoriteListing, type PreferencesResponse, type PeopleMatchResult, type FullProfileResponse } from "@/lib/api";
import {
  PlusCircle, Crown, Trash2, Home, User, Shield, Search,
  Heart, MessageSquare, Send, Star, Sliders, CheckCircle, XCircle, Clock, ArrowRight,
  Eye, MousePointerClick, Users, Lock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import type { ListingResponse } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";

function computeCompletion(profile: FullProfileResponse): number {
  const profileFields = ["fullName", "age", "gender", "occupation", "bio", "cleanlinessLevel", "sleepSchedule", "noiseTolerance", "guestPreference", "petPreference", "moveInDate"] as const;
  const prefFields = ["city", "budgetMin", "budgetMax", "lifestyle", "smoking"] as const;
  let filled = 0;
  const total = profileFields.length + prefFields.length;
  for (const f of profileFields) {
    if (profile.profile && profile.profile[f] !== null && profile.profile[f] !== undefined && profile.profile[f] !== "") filled++;
  }
  for (const f of prefFields) {
    if (profile.preferences && profile.preferences[f as keyof typeof profile.preferences] !== null && profile.preferences[f as keyof typeof profile.preferences] !== undefined && profile.preferences[f as keyof typeof profile.preferences] !== "") filled++;
  }
  return Math.round((filled / total) * 100);
}

function scoreMatch(listing: ListingResponse, prefs: PreferencesResponse): number {
  let score = 0;
  if (prefs.city && listing.city.toLowerCase() === prefs.city.toLowerCase()) score += 35;
  const price = listing.price;
  const min = prefs.budgetMin ? parseFloat(prefs.budgetMin) : null;
  const max = prefs.budgetMax ? parseFloat(prefs.budgetMax) : null;
  if (min !== null && max !== null && price >= min && price <= max) score += 35;
  else if (max !== null && price <= max) score += 18;
  else if (min !== null && price >= min) score += 8;
  if (!prefs.lifestyle || prefs.lifestyle === "any") score += 15;
  if (!prefs.smoking || prefs.smoking === "any") score += 10;
  if (!prefs.genderPref || prefs.genderPref === "any") score += 5;
  return score;
}

export default function Dashboard() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [preferences, setPreferences] = useState<PreferencesResponse | null>(null);
  const [favorites, setFavorites] = useState<FavoriteListing[]>([]);
  const [updatingRequest, setUpdatingRequest] = useState<number | null>(null);
  const [topPeopleMatches, setTopPeopleMatches] = useState<PeopleMatchResult[]>([]);
  const [fullProfile, setFullProfile] = useState<FullProfileResponse | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !user) setLocation("/login");
  }, [user, isAuthLoading]);

  const { data: myListings, isLoading: isListingsLoading } = useGetMyListings({
    query: { enabled: !!user && user.role === "owner" }
  });

  const { data: allListings } = useGetListings(
    {},
    { query: { enabled: !!user && user.role === "seeker" } }
  );

  const deleteMutation = useDeleteListing({
    mutation: {
      onSuccess: () => {
        toast({ title: t("dashboard.deleted"), description: t("dashboard.listingRemoved") });
        queryClient.invalidateQueries({ queryKey: ["/api/listings/my"] });
      }
    }
  });

  useEffect(() => {
    if (!user) return;
    api.getRequests().then(r => setRequests(Array.isArray(r) ? r : [])).catch(() => {});
    api.getConversations().then(c => setConversations(Array.isArray(c) ? c : [])).catch(() => {});
    if (user.role === "seeker") {
      api.getPreferences().then(p => setPreferences(p)).catch(() => {});
      api.getFavorites().then(f => setFavorites(Array.isArray(f) ? f : [])).catch(() => {});
      api.getProfile().then(p => setFullProfile(p)).catch(() => {});
      api.getPeopleMatches().then(matches => setTopPeopleMatches(Array.isArray(matches) ? matches.slice(0, 3) : [])).catch(() => {});
    }
  }, [user]);

  const handleDelete = (id: number) => {
    if (confirm(t("dashboard.deleteListing"))) {
      deleteMutation.mutate({ id });
    }
  };

  const handleRequestAction = async (id: number, status: "accepted" | "declined") => {
    setUpdatingRequest(id);
    try {
      const updated = await api.updateRequestStatus(id, status);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: updated.status } : r));
      toast({ title: status === "accepted" ? t("dashboard.requestAccepted") : t("dashboard.requestDeclined") });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ variant: "destructive", title: t("dashboard.error"), description: message });
    } finally {
      setUpdatingRequest(null);
    }
  };

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const displayName = user.name || user.email.split("@")[0];
  const topMatches = preferences && allListings
    ? [...allListings]
        .map(l => ({ listing: l, score: scoreMatch(l, preferences) }))
        .sort((a, b) => b.score - a.score)
        .filter(x => x.score > 0)
        .slice(0, 4)
        .map(x => x.listing)
    : [];

  const pendingRequests = requests.filter(r => r.status === "pending");

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: React.ElementType; label: string }> = {
      pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Clock, label: t("dashboard.pending") },
      accepted: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle, label: t("dashboard.accepted") },
      declined: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle, label: t("dashboard.declined") },
    };
    const s = map[status] || map.pending;
    const Icon = s.icon;
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", s.color)}>
        <Icon className="w-3 h-3" />{s.label}
      </span>
    );
  };

  const SectionHeader = ({ title, link, linkLabel }: { title: string; link?: string; linkLabel?: string }) => (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-display font-bold text-foreground">{title}</h2>
      {link && <Link href={link} className="text-sm text-primary hover:underline flex items-center gap-1">{linkLabel} <ArrowRight className="w-3 h-3" /></Link>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm sticky top-24">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 mx-auto">
                <User className="w-7 h-7 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-display font-bold text-center text-foreground truncate">{displayName}</h2>
              <p className="text-center text-muted-foreground text-xs mb-5 truncate">{user.email}</p>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                  <span className="text-xs font-medium text-muted-foreground">{t("dashboard.role")}</span>
                  <span className="text-xs font-bold text-foreground capitalize flex items-center gap-1">
                    {user.role === "owner" ? <Home className="w-3.5 h-3.5 text-primary" /> : <Search className="w-3.5 h-3.5 text-primary" />}
                    {user.role}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                  <span className="text-xs font-medium text-muted-foreground">{t("dashboard.status")}</span>
                  {user.isPremium && user.subscriptionStatus === "active" ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 flex items-center gap-1">
                      <Crown className="w-3 h-3" /> {t("dashboard.premium")}
                    </span>
                  ) : user.subscriptionStatus === "cancelled" ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{t("dashboard.cancelled")}</span>
                  ) : user.subscriptionStatus === "suspended" ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">{t("dashboard.suspended")}</span>
                  ) : user.subscriptionStatus === "expired" ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{t("dashboard.expired")}</span>
                  ) : (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">{t("dashboard.basic")}</span>
                  )}
                </div>
              </div>

              {/* Profile completion for seekers */}
              {user.role === "seeker" && fullProfile && (() => {
                const pct = computeCompletion(fullProfile);
                return pct < 100 ? (
                  <div className="mt-4 p-3 bg-background rounded-2xl border border-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-foreground">{t("dashboard.profile")}</span>
                      <span className="text-xs font-bold text-primary">{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-primary" : "bg-amber-400")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <Link href="/profile" className="text-xs text-primary hover:underline mt-1.5 block">{t("dashboard.completeProfile")}</Link>
                  </div>
                ) : null;
              })()}

              {/* Quick links */}
              <div className="mt-5 space-y-1">
                {user.role === "seeker" && (
                  <>
                    <Link href="/profile" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
                      <User className="w-4 h-4 text-primary" /> {t("dashboard.myProfile")}
                    </Link>
                    <Link href="/people" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
                      <Users className="w-4 h-4 text-primary" /> {t("dashboard.peopleMatches")}
                    </Link>
                    <Link href="/profile/preferences" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
                      <Sliders className="w-4 h-4 text-primary" /> {t("dashboard.myPreferences")}
                    </Link>
                    <Link href="/favorites" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
                      <Heart className="w-4 h-4 text-primary" /> {t("dashboard.savedListings")}
                    </Link>
                    <Link href="/messages" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
                      <MessageSquare className="w-4 h-4 text-primary" /> {t("dashboard.recentMessages")}
                      {conversations.reduce((a, c) => a + c.unreadCount, 0) > 0 && (
                        <span className="ml-auto text-xs font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                          {conversations.reduce((a, c) => a + c.unreadCount, 0)}
                        </span>
                      )}
                    </Link>
                  </>
                )}
                {user.role === "owner" && (
                  <>
                    <Link href="/listings/new" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
                      <PlusCircle className="w-4 h-4 text-primary" /> {t("dashboard.newListing")}
                    </Link>
                    <Link href="/messages" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors">
                      <MessageSquare className="w-4 h-4 text-primary" /> {t("nav.messages")}
                      {conversations.reduce((a, c) => a + c.unreadCount, 0) > 0 && (
                        <span className="ml-auto text-xs font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                          {conversations.reduce((a, c) => a + c.unreadCount, 0)}
                        </span>
                      )}
                    </Link>
                  </>
                )}
              </div>

              {user.role === "owner" && (!user.isPremium || ["cancelled", "suspended", "expired"].includes(user.subscriptionStatus ?? "")) && (
                <div className="mt-6 p-4 bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-2xl text-center">
                  <Shield className="w-7 h-7 text-primary mx-auto mb-2" />
                  <h3 className="font-semibold text-sm text-foreground mb-1">
                    {["cancelled", "suspended", "expired"].includes(user.subscriptionStatus ?? "") ? t("dashboard.reactivatePremium") : t("dashboard.upgradeToPremium")}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {user.subscriptionStatus === "cancelled"
                      ? t("dashboard.reactivateDesc")
                      : user.subscriptionStatus === "suspended"
                      ? t("dashboard.suspendedDesc")
                      : user.subscriptionStatus === "expired"
                      ? t("dashboard.expiredDesc")
                      : t("dashboard.getVerified")}
                  </p>
                  <Link href="/premium" className="block w-full py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors">
                    {["cancelled", "suspended", "expired"].includes(user.subscriptionStatus ?? "") ? t("dashboard.resubscribe") : t("dashboard.viewPlans")}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">

            {/* ====== SEEKER DASHBOARD ====== */}
            {user.role === "seeker" && (
              <>
                {/* Top Matches */}
                <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm">
                  <SectionHeader
                    title={t("dashboard.topMatches")}
                    link="/profile/preferences"
                    linkLabel={preferences ? t("dashboard.editPreferences") : t("dashboard.setPreferences")}
                  />
                  {!preferences ? (
                    <div className="text-center py-12 bg-background rounded-2xl border border-dashed border-border">
                      <Sliders className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="font-semibold text-foreground">{t("dashboard.noPreferences")}</p>
                      <p className="text-sm text-muted-foreground mt-1 mb-4">{t("dashboard.noPreferencesSub")}</p>
                      <Link href="/profile/preferences" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:-translate-y-0.5 transition-all">
                        <Sliders className="w-4 h-4" /> {t("dashboard.setPreferencesBtn")}
                      </Link>
                    </div>
                  ) : topMatches.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {topMatches.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-background rounded-2xl border border-dashed border-border">
                      <Star className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="font-semibold text-foreground">{t("dashboard.noMatchesFound")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("dashboard.noMatchesSub")}</p>
                    </div>
                  )}
                </div>

                {/* Top People Matches */}
                <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm">
                  <SectionHeader title={t("dashboard.suggestedRoommates")} link="/people" linkLabel={t("dashboard.seeAll")} />
                  {topPeopleMatches.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {topPeopleMatches.map(match => {
                        const name = match.profile.fullName || match.name || match.email.split("@")[0];
                        const score = match.score;
                        const scoreColor = score >= 75 ? "text-green-600 dark:text-green-400" : score >= 50 ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400";
                        return (
                          <Link key={match.userId} href={`/profile/${match.userId}`} className="p-4 bg-background rounded-2xl border border-border hover:border-primary/40 transition-all group">
                            <div className="flex items-center gap-3 mb-3">
                              {match.profile.avatarUrl ? (
                                <img src={match.profile.avatarUrl} alt={name} className="w-10 h-10 rounded-xl object-cover border border-border" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center border border-border">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-foreground truncate">{name}</p>
                                {match.preferences.city && <p className="text-xs text-muted-foreground truncate">{match.preferences.city}</p>}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={cn("text-lg font-bold", scoreColor)}>{score}%</span>
                              <span className="text-xs text-muted-foreground">{t("dashboard.match")}</span>
                            </div>
                            {match.matchReasons[0] && (
                              <p className="text-xs text-muted-foreground mt-1.5 truncate">{match.matchReasons[0]}</p>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-background rounded-2xl border border-dashed border-border">
                      <Users className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="font-semibold text-foreground">{t("dashboard.noRoommateMatches")}</p>
                      <p className="text-sm text-muted-foreground mt-1 mb-4">{t("dashboard.noRoommateMatchesSub")}</p>
                      <Link href="/profile" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:-translate-y-0.5 transition-all">
                        <User className="w-4 h-4" /> {t("dashboard.completeProfileBtn")}
                      </Link>
                    </div>
                  )}
                </div>

                {/* Saved Favorites */}
                <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm">
                  <SectionHeader title={t("dashboard.savedListingsSection")} link="/favorites" linkLabel={t("dashboard.viewAll")} />
                  {favorites.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {favorites.slice(0, 4).map((l, i) => (
                        <ListingCard
                          key={l.id}
                          listing={{ ...l, images: l.images ?? [] } as ListingResponse}
                          index={i}
                          isFavorited={true}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-background rounded-2xl border border-dashed border-border">
                      <Heart className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">{t("dashboard.noSavedListings")}</p>
                    </div>
                  )}
                </div>

                {/* Sent Requests */}
                <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm">
                  <SectionHeader title={t("dashboard.myRequests")} />
                  {requests.length > 0 ? (
                    <div className="space-y-3">
                      {requests.map(r => (
                        <div key={r.id} className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-foreground truncate">{r.listingTitle}</p>
                            <p className="text-xs text-muted-foreground">{r.listingCity}</p>
                          </div>
                          {statusBadge(r.status)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-background rounded-2xl border border-dashed border-border">
                      <Send className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">{t("dashboard.noRequestsSent")}</p>
                    </div>
                  )}
                </div>

                {/* Recent Messages */}
                <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm">
                  <SectionHeader title={t("dashboard.recentMessages")} link="/messages" linkLabel={t("dashboard.openInbox")} />
                  {conversations.length > 0 ? (
                    <div className="space-y-2">
                      {conversations.slice(0, 3).map(conv => (
                        <Link key={conv.otherId} href="/messages" className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border hover:border-primary/40 transition-colors">
                          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground">{conv.otherName || conv.otherEmail?.split("@")[0]}</p>
                            <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                          </div>
                          {conv.unreadCount > 0 && (
                            <span className="text-xs font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">{conv.unreadCount}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-background rounded-2xl border border-dashed border-border">
                      <MessageSquare className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">{t("dashboard.noMessages")}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ====== OWNER DASHBOARD ====== */}
            {user.role === "owner" && (
              <>
                {/* My Listings */}
                <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-xl font-display font-bold text-foreground">{t("dashboard.myListings")}</h2>
                    </div>
                    <Link href="/listings/new" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:-translate-y-0.5 transition-all shadow-md shadow-primary/20 text-sm">
                      <PlusCircle className="w-4 h-4" /> {t("dashboard.addListing")}
                    </Link>
                  </div>

                  {isListingsLoading ? (
                    <div className="py-16 text-center">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    </div>
                  ) : myListings && myListings.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {myListings.map(listing => (
                        <div key={listing.id} className="group relative flex flex-col">
                          <div className="relative flex-1">
                            <ListingCard listing={listing} squareBottom />
                            <button
                              onClick={() => handleDelete(listing.id)}
                              className="absolute top-3 left-3 z-20 bg-background/90 backdrop-blur-md text-destructive p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground shadow-sm"
                              title={t("common.delete")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {user.isPremium ? (
                            <div className={cn(
                              "flex items-center gap-4 px-4 py-2 rounded-b-2xl border-x border-b text-xs text-muted-foreground",
                              listing.isFeatured ? "border-amber-400/60 bg-amber-50/5" : "border-border/50 bg-background"
                            )}>
                              <span className="flex items-center gap-1.5 font-medium">
                                <Eye className="w-3.5 h-3.5 text-primary" />
                                <span className="font-bold text-foreground">{listing.viewCount ?? 0}</span>
                                {t("dashboard.views")}
                              </span>
                              <span className="flex items-center gap-1.5 font-medium">
                                <MousePointerClick className="w-3.5 h-3.5 text-primary" />
                                <span className="font-bold text-foreground">{listing.contactClickCount ?? 0}</span>
                                {t("dashboard.clicks")}
                              </span>
                              <span className="flex items-center gap-1.5 font-medium">
                                <Users className="w-3.5 h-3.5 text-primary" />
                                <span className="font-bold text-foreground">{listing.requestCount ?? 0}</span>
                                {t("dashboard.requests")}
                              </span>
                            </div>
                          ) : (
                            <div className={cn(
                              "relative flex items-center justify-center gap-2 px-4 py-2 rounded-b-2xl border-x border-b overflow-hidden",
                              listing.isFeatured ? "border-amber-400/60 bg-amber-50/5" : "border-border/50 bg-background"
                            )}>
                              <div className="absolute inset-0 backdrop-blur-[2px] bg-background/70 flex items-center justify-center gap-2 z-10">
                                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs font-semibold text-muted-foreground">{t("dashboard.analyticsLocked")}</span>
                                <Link href="/premium" className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold rounded-lg hover:from-amber-600 hover:to-yellow-600 transition-all">
                                  <Crown className="w-3 h-3" /> {t("dashboard.upgradeToPremium")}
                                </Link>
                              </div>
                              <span className="flex items-center gap-1 text-xs opacity-20 select-none">
                                <Eye className="w-3.5 h-3.5" /> -- {t("dashboard.views")}
                              </span>
                              <span className="flex items-center gap-1 text-xs opacity-20 select-none">
                                <MousePointerClick className="w-3.5 h-3.5" /> -- {t("dashboard.clicks")}
                              </span>
                              <span className="flex items-center gap-1 text-xs opacity-20 select-none">
                                <Users className="w-3.5 h-3.5" /> -- {t("dashboard.requests")}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-background rounded-2xl border border-dashed border-border">
                      <Home className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground">{t("dashboard.noListings")}</h3>
                      <p className="text-muted-foreground mt-1 mb-5 text-sm">{t("dashboard.noListingsSub")}</p>
                      <Link href="/listings/new" className="inline-flex text-primary font-medium hover:underline text-sm">
                        {t("dashboard.createFirstListing")} →
                      </Link>
                    </div>
                  )}
                </div>

                {/* Incoming Requests */}
                <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-xl font-display font-bold text-foreground">📥 {t("dashboard.myRequests")}</h2>
                    {pendingRequests.length > 0 && (
                      <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">{pendingRequests.length} {t("dashboard.pending")}</span>
                    )}
                  </div>

                  {requests.length > 0 ? (
                    <div className="space-y-5">
                      {(() => {
                        const byListing = requests.reduce<Record<number, { title: string | null; items: RequestItem[] }>>((acc, r) => {
                          if (!acc[r.listingId]) acc[r.listingId] = { title: r.listingTitle ?? null, items: [] };
                          acc[r.listingId].items.push(r);
                          return acc;
                        }, {});
                        return Object.entries(byListing).map(([listingId, group]) => {
                          const pending = group.items.filter(r => r.status === "pending").length;
                          const accepted = group.items.filter(r => r.status === "accepted").length;
                          const declined = group.items.filter(r => r.status === "declined").length;
                          return (
                            <div key={listingId} className="bg-background rounded-2xl border border-border overflow-hidden">
                              <div className="px-4 py-3 bg-secondary/50 border-b border-border flex items-center justify-between gap-4">
                                <p className="font-semibold text-sm text-foreground truncate">{group.title || t("dashboard.untitledListing")}</p>
                                <div className="flex items-center gap-2 flex-shrink-0 text-xs font-semibold">
                                  {pending > 0 && <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock className="w-3 h-3" />{pending}</span>}
                                  {accepted > 0 && <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" />{accepted}</span>}
                                  {declined > 0 && <span className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" />{declined}</span>}
                                </div>
                              </div>
                              <div className="divide-y divide-border">
                                {group.items.map(r => (
                                  <div key={r.id} className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium text-sm text-foreground">{r.seekerName || r.seekerEmail?.split("@")[0]}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{r.seekerEmail}</p>
                                        {r.message && <p className="text-xs text-muted-foreground mt-2 italic">"{r.message}"</p>}
                                      </div>
                                      {r.status === "pending" ? (
                                        <div className="flex gap-2 flex-shrink-0">
                                          <button
                                            onClick={() => handleRequestAction(r.id, "accepted")}
                                            disabled={updatingRequest === r.id}
                                            className="p-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                                          >
                                            <CheckCircle className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleRequestAction(r.id, "declined")}
                                            disabled={updatingRequest === r.id}
                                            className="p-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                          >
                                            <XCircle className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ) : (
                                        statusBadge(r.status)
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-background rounded-2xl border border-dashed border-border">
                      <Send className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">{t("dashboard.noRequestsSent")}</p>
                    </div>
                  )}
                </div>

                {/* Recent Messages */}
                <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm">
                  <SectionHeader title={t("dashboard.recentMessages")} link="/messages" linkLabel={t("dashboard.openInbox")} />
                  {conversations.length > 0 ? (
                    <div className="space-y-2">
                      {conversations.slice(0, 4).map(conv => (
                        <Link key={conv.otherId} href="/messages" className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border hover:border-primary/40 transition-colors">
                          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground">{conv.otherName || conv.otherEmail?.split("@")[0]}</p>
                            <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                          </div>
                          {conv.unreadCount > 0 && (
                            <span className="text-xs font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">{conv.unreadCount}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-background rounded-2xl border border-dashed border-border">
                      <MessageSquare className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">{t("dashboard.noMessages")}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
