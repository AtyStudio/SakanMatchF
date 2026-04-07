import { useState, useEffect } from "react";
import { useGetListing, useRecordContactClick, type ListingResponse } from "@workspace/api-client-react";
import { Navbar } from "@/components/Navbar";
import { useRoute, Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";
import { api, type PreferencesResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, ArrowLeft, Calendar, ChevronLeft, ChevronRight,
  Heart, Send, MessageSquare, Loader2, CheckCircle, Eye, MousePointerClick, BadgeCheck,
  BedDouble, Bath, Ruler, Building2, Sofa, Wifi, UtensilsCrossed, WashingMachine,
  ParkingSquare, AirVent, Flame, Banknote, Flag, Share2, Check,
  CigaretteOff, PawPrint, Users, UserCheck, Clock, AlertTriangle, X,
  TrendingUp, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { ListingCard } from "@/components/ListingCard";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80";

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  wifi: <Wifi className="w-4 h-4" />,
  kitchen: <UtensilsCrossed className="w-4 h-4" />,
  washingMachine: <WashingMachine className="w-4 h-4" />,
  parking: <ParkingSquare className="w-4 h-4" />,
  ac: <AirVent className="w-4 h-4" />,
  heating: <Flame className="w-4 h-4" />,
};

function computeMatchScore(prefs: PreferencesResponse | null, listing: ListingResponse) {
  if (!prefs) return null;

  type Factor = { nameKey: string; match: boolean };
  const factors: Factor[] = [];

  if (prefs.city) {
    factors.push({
      nameKey: "matchCity",
      match: listing.city.toLowerCase().includes(prefs.city.toLowerCase()),
    });
  }

  const budgetMin = prefs.budgetMin ? parseFloat(prefs.budgetMin) : null;
  const budgetMax = prefs.budgetMax ? parseFloat(prefs.budgetMax) : null;
  if (budgetMin !== null || budgetMax !== null) {
    factors.push({
      nameKey: "matchBudget",
      match:
        (budgetMin === null || listing.price >= budgetMin) &&
        (budgetMax === null || listing.price <= budgetMax),
    });
  }

  if (prefs.smoking && prefs.smoking !== "any" && listing.smokingAllowed !== null && listing.smokingAllowed !== undefined) {
    factors.push({
      nameKey: "matchSmoking",
      match:
        (prefs.smoking === "yes" && !!listing.smokingAllowed) ||
        (prefs.smoking === "no" && !listing.smokingAllowed),
    });
  }

  if (prefs.genderPref && prefs.genderPref !== "any" && listing.genderPreference && listing.genderPreference !== "any") {
    factors.push({
      nameKey: "matchGender",
      match: prefs.genderPref === listing.genderPreference,
    });
  }

  if (factors.length === 0) return null;

  const matched = factors.filter(f => f.match);
  return {
    score: Math.round((matched.length / factors.length) * 100),
    reasons: matched.slice(0, 3).map(f => f.nameKey),
  };
}

function ReportModal({
  listingId,
  onClose,
}: {
  listingId: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const reasons = [
    { value: "spam", label: t("listings.detail.reportSpam") },
    { value: "inappropriate", label: t("listings.detail.reportInappropriate") },
    { value: "fake", label: t("listings.detail.reportFake") },
    { value: "other", label: t("listings.detail.reportOther") },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setStatus("sending");
    try {
      await api.reportListing(listingId, reason);
      setStatus("sent");
      toast({ title: t("listings.detail.reportSent"), description: t("listings.detail.reportSentDesc") });
      setTimeout(onClose, 1500);
    } catch {
      setStatus("idle");
      toast({ variant: "destructive", title: t("common.error"), description: t("listings.detail.reportError") });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-3xl p-6 max-w-sm w-full border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-display font-bold text-foreground">{t("listings.detail.reportTitle")}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {status === "sent" ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-300 font-medium">{t("listings.detail.reportSent")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {reasons.map(r => (
              <label key={r.value} className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all",
                reason === r.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              )}>
                <input type="radio" name="reason" value={r.value} checked={reason === r.value}
                  onChange={e => setReason(e.target.value)} className="text-primary" />
                <span className="text-sm font-medium text-foreground">{r.label}</span>
              </label>
            ))}
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border-2 border-border text-muted-foreground text-sm font-medium hover:border-primary/30 transition-colors">
                {t("listings.detail.reportCancel")}
              </button>
              <button type="submit" disabled={!reason || status === "sending"}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {status === "sending" ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("listings.detail.reportSubmit")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-3 bg-secondary/50 rounded-xl border border-border min-w-[80px]">
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-bold text-foreground whitespace-nowrap">{value}</span>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
    </div>
  );
}

export default function ListingDetail() {
  const [, params] = useRoute("/listings/:id");
  const id = parseInt(params?.id || "0", 10);
  const [activeIndex, setActiveIndex] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const [isFavorited, setIsFavorited] = useState(false);
  const [isFavLoading, setIsFavLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [requestMessage, setRequestMessage] = useState("");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [isMsgSending, setIsMsgSending] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [preferences, setPreferences] = useState<PreferencesResponse | null | undefined>(undefined);
  const [similarListings, setSimilarListings] = useState<ListingResponse[]>([]);

  const recordContactClickMutation = useRecordContactClick();

  const { data: listing, isLoading, error } = useGetListing(id, {
    query: { enabled: !!id }
  });

  const isSeeker = user?.role === "seeker";
  const isOwner = user?.id === listing?.ownerId;

  useEffect(() => {
    if (!isSeeker || !id) return;
    api.getFavoriteIds().then(ids => setIsFavorited(ids.includes(id))).catch(() => {});
  }, [isSeeker, id]);

  useEffect(() => {
    if (!id) return;
    const sessionKey = `viewed_listing_${id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/listings/${id}/view`, { method: "POST", credentials: "include" }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!isSeeker) return;
    api.getPreferences().then(p => setPreferences(p)).catch(() => setPreferences(null));
  }, [isSeeker]);

  useEffect(() => {
    if (!listing?.city || !id) return;
    api.getListings({ city: listing.city })
      .then(all => setSimilarListings(all.filter(l => l.id !== id).slice(0, 4)))
      .catch(() => {});
  }, [listing?.city, id]);

  const toggleFavorite = async () => {
    if (!user) { setLocation("/login"); return; }
    setIsFavLoading(true);
    try {
      if (isFavorited) {
        await api.removeFavorite(id);
        setIsFavorited(false);
        toast({ title: t("listings.detail.removedFromFavorites") });
      } else {
        await api.addFavorite(id);
        setIsFavorited(true);
        toast({ title: t("listings.detail.addedToFavorites") });
      }
    } catch (err: unknown) {
      toast({ variant: "destructive", title: t("common.error"), description: err instanceof Error ? err.message : t("common.error") });
    } finally {
      setIsFavLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: listing?.title, url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setShareState("copied");
      toast({ title: t("listings.detail.copied") });
      setTimeout(() => setShareState("idle"), 2000);
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setLocation("/login"); return; }
    setRequestStatus("sending");
    try {
      await api.sendRequest({ listingId: id, message: requestMessage || undefined });
      setRequestStatus("sent");
      toast({ title: t("listings.detail.requestSent"), description: t("listings.detail.requestSentDesc") });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("already")) {
        setRequestStatus("sent");
        toast({ title: t("listings.detail.alreadyRequested"), description: t("listings.detail.alreadyRequestedDesc") });
      } else {
        setRequestStatus("idle");
        toast({ variant: "destructive", title: t("common.error"), description: msg });
      }
    }
  };

  const handleContactOwner = async () => {
    if (!user) { setLocation("/login"); return; }
    if (!listing?.ownerId) return;
    setIsMsgSending(true);
    recordContactClickMutation.mutate({ id });
    try {
      await api.sendMessage({
        receiverId: listing.ownerId,
        listingId: id,
        body: `Hi! I'm interested in your listing "${listing.title}" in ${listing.city}.`
      });
      toast({ title: t("listings.detail.messageSent"), description: t("listings.detail.messageSentDesc") });
      setLocation("/messages");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("already")) {
        setLocation("/messages");
      } else {
        toast({ variant: "destructive", title: t("common.error"), description: msg });
      }
    } finally {
      setIsMsgSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">{t("listings.detail.listingNotFound")}</h2>
            <Link href="/" className="text-primary hover:underline mt-4 inline-block">{t("listings.detail.returnHome")}</Link>
          </div>
        </div>
      </div>
    );
  }

  const images = listing.images && listing.images.length > 0 ? listing.images : [FALLBACK_IMAGE];
  const currentImage = images[activeIndex] || FALLBACK_IMAGE;
  const hasMultiple = images.length > 1;
  const prev = () => setActiveIndex(i => (i - 1 + images.length) % images.length);
  const next = () => setActiveIndex(i => (i + 1) % images.length);

  const amenities = listing.amenities ?? [];
  const hasPropertyDetails = !!(listing.propertyType || listing.bedrooms || listing.bathrooms || listing.area || listing.floor !== null || listing.isFurnished !== null);
  const hasFinancials = !!(listing.deposit || listing.billsIncluded !== null || listing.agencyFees || listing.availableFrom);
  const hasHouseRules = !!(listing.smokingAllowed !== null || listing.petsAllowed !== null || listing.guestsAllowed !== null || listing.genderPreference || listing.quietHours || listing.minStay || listing.maxStay);

  const matchResult = isSeeker && preferences !== undefined ? computeMatchScore(preferences ?? null, listing) : undefined;

  const scoreColor = matchResult
    ? matchResult.score >= 80 ? "text-green-600 dark:text-green-400"
      : matchResult.score >= 50 ? "text-amber-600 dark:text-amber-400"
      : "text-red-500"
    : "";
  const scoreBarColor = matchResult
    ? matchResult.score >= 80 ? "bg-green-500"
      : matchResult.score >= 50 ? "bg-amber-500"
      : "bg-red-500"
    : "";

  const propertyTypeLabel: Record<string, string> = {
    room: t("listings.room"),
    studio: t("listings.studio"),
    apartment: t("listings.apartment"),
    villa: t("listings.villa"),
  };

  const genderLabel: Record<string, string> = {
    any: t("listings.detail.genderAny"),
    male: t("listings.detail.genderMale"),
    female: t("listings.detail.genderFemale"),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {showReportModal && (
        <ReportModal listingId={id} onClose={() => setShowReportModal(false)} />
      )}

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("listings.detail.backToSearch")}
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border-2 bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-foreground">
              {shareState === "copied" ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
              {t("listings.detail.share")}
            </button>
            {isSeeker && (
              <button onClick={toggleFavorite} disabled={isFavLoading} className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border-2",
                isFavorited
                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-800"
                  : "bg-card border-border text-muted-foreground hover:border-red-300 hover:text-red-500"
              )}>
                <Heart className={cn("w-4 h-4", isFavorited ? "fill-red-500 text-red-500" : "")} />
                {isFavorited ? t("listings.detail.saved") : t("listings.detail.save")}
              </button>
            )}
          </div>
        </div>

        {/* Image Gallery */}
        <div className="relative aspect-[16/9] md:aspect-[21/9] rounded-3xl overflow-hidden mb-4 shadow-lg border border-border">
          <img src={currentImage} alt={listing.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10 text-white">
            <div className="flex items-center gap-2 text-white/90 mb-2 font-medium">
              <MapPin className="w-5 h-5 text-primary" />
              <span className="text-lg drop-shadow-md">
                {listing.neighborhood ? `${listing.neighborhood}, ${listing.city}` : listing.city}
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold leading-tight drop-shadow-lg">{listing.title}</h1>
          </div>
          {hasMultiple && (
            <>
              <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all">
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 right-6 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm font-medium">
                {activeIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>

        {hasMultiple && (
          <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button key={i} onClick={() => setActiveIndex(i)} className={cn(
                "flex-shrink-0 w-20 h-14 rounded-xl overflow-hidden border-2 transition-all duration-150",
                i === activeIndex ? "border-primary shadow-md" : "border-border hover:border-primary/50 opacity-70 hover:opacity-100"
              )}>
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Property Detail Chips */}
        {hasPropertyDetails && (
          <div className="flex gap-3 mb-8 overflow-x-auto pb-1">
            {listing.propertyType && (
              <InfoChip icon={<Building2 className="w-4 h-4" />} label={t("listings.propertyType")} value={propertyTypeLabel[listing.propertyType] || listing.propertyType} />
            )}
            {listing.bedrooms !== null && listing.bedrooms !== undefined && (
              <InfoChip icon={<BedDouble className="w-4 h-4" />} label={t("listings.detail.bedrooms")} value={String(listing.bedrooms)} />
            )}
            {listing.bathrooms !== null && listing.bathrooms !== undefined && (
              <InfoChip icon={<Bath className="w-4 h-4" />} label={t("listings.detail.bathrooms")} value={String(listing.bathrooms)} />
            )}
            {listing.area !== null && listing.area !== undefined && (
              <InfoChip icon={<Ruler className="w-4 h-4" />} label={t("listings.detail.area")} value={`${listing.area} m²`} />
            )}
            {listing.floor !== null && listing.floor !== undefined && (
              <InfoChip icon={<Building2 className="w-4 h-4" />} label={t("listings.detail.floor")} value={String(listing.floor)} />
            )}
            {listing.isFurnished !== null && listing.isFurnished !== undefined && (
              <InfoChip icon={<Sofa className="w-4 h-4" />} label="" value={listing.isFurnished ? t("listings.detail.furnished") : t("listings.detail.unfurnished")} />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">{t("listings.detail.aboutProperty")}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {listing.description || t("listings.detail.fallbackDesc", { city: listing.city })}
              </p>
              <div className="mt-6 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-xl text-xs font-medium text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  {listing.neighborhood ? `${listing.neighborhood}, ${listing.city}` : listing.city}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-xl text-xs font-medium text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {t("listings.detail.listedOn")} {listing.createdAt ? format(new Date(listing.createdAt), "MMM d, yyyy") : "—"}
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
              <h2 className="text-xl font-display font-bold text-foreground mb-5">{t("listings.detail.locationSection")}</h2>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  {listing.neighborhood ? `${listing.neighborhood}, ${listing.city}` : listing.city}
                </span>
              </div>
              <div className="w-full h-48 rounded-2xl bg-secondary/60 border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground gap-2">
                <MapPin className="w-8 h-8 text-primary/40" />
                <span className="text-sm font-medium">{listing.city}{listing.neighborhood ? ` · ${listing.neighborhood}` : ""}</span>
                <span className="text-xs">{t("listings.detail.mapPlaceholder")}</span>
              </div>
            </div>

            {/* Amenities */}
            {amenities.length > 0 && (
              <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
                <h2 className="text-xl font-display font-bold text-foreground mb-5">{t("listings.detail.amenitiesSection")}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {amenities.map(key => (
                    <div key={key} className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm font-medium text-foreground">
                      <span className="text-primary">{AMENITY_ICONS[key] ?? <Check className="w-4 h-4" />}</span>
                      {t(`listings.${key}`, { defaultValue: key })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Details */}
            {hasFinancials && (
              <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
                <h2 className="text-xl font-display font-bold text-foreground mb-5">{t("listings.detail.financialDetails")}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {listing.deposit !== null && listing.deposit !== undefined && (
                    <div className="flex items-center gap-3 p-4 bg-secondary/40 rounded-xl">
                      <Banknote className="w-5 h-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t("listings.detail.deposit")}</p>
                        <p className="font-bold text-foreground">{formatPrice(listing.deposit)}</p>
                      </div>
                    </div>
                  )}
                  {listing.agencyFees !== null && listing.agencyFees !== undefined && (
                    <div className="flex items-center gap-3 p-4 bg-secondary/40 rounded-xl">
                      <Banknote className="w-5 h-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t("listings.detail.agencyFees")}</p>
                        <p className="font-bold text-foreground">{formatPrice(listing.agencyFees)}</p>
                      </div>
                    </div>
                  )}
                  {listing.availableFrom && (
                    <div className="flex items-center gap-3 p-4 bg-secondary/40 rounded-xl">
                      <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t("listings.detail.availableFrom")}</p>
                        <p className="font-bold text-foreground">{format(new Date(listing.availableFrom), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                  )}
                  {listing.billsIncluded !== null && listing.billsIncluded !== undefined && (
                    <div className={cn("flex items-center gap-3 p-4 rounded-xl", listing.billsIncluded ? "bg-green-50 dark:bg-green-950/30" : "bg-secondary/40")}>
                      <Check className={cn("w-5 h-5 flex-shrink-0", listing.billsIncluded ? "text-green-600" : "text-muted-foreground")} />
                      <p className={cn("font-semibold text-sm", listing.billsIncluded ? "text-green-800 dark:text-green-300" : "text-muted-foreground")}>
                        {listing.billsIncluded ? t("listings.detail.billsIncluded") : t("listings.detail.billsNotIncluded")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* House Rules */}
            {hasHouseRules && (
              <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
                <h2 className="text-xl font-display font-bold text-foreground mb-5">{t("listings.detail.houseRules")}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {listing.smokingAllowed !== null && listing.smokingAllowed !== undefined && (
                    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border",
                      listing.smokingAllowed ? "border-border bg-secondary/30" : "border-destructive/20 bg-destructive/5")}>
                      <CigaretteOff className={cn("w-4 h-4 flex-shrink-0", listing.smokingAllowed ? "text-foreground" : "text-destructive")} />
                      <span className="text-sm font-medium text-foreground">
                        {listing.smokingAllowed ? t("listings.detail.smokingAllowed") : t("listings.detail.smokingNotAllowed")}
                      </span>
                    </div>
                  )}
                  {listing.petsAllowed !== null && listing.petsAllowed !== undefined && (
                    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border",
                      listing.petsAllowed ? "border-border bg-secondary/30" : "border-destructive/20 bg-destructive/5")}>
                      <PawPrint className={cn("w-4 h-4 flex-shrink-0", listing.petsAllowed ? "text-foreground" : "text-destructive")} />
                      <span className="text-sm font-medium text-foreground">
                        {listing.petsAllowed ? t("listings.detail.petsAllowed") : t("listings.detail.petsNotAllowed")}
                      </span>
                    </div>
                  )}
                  {listing.guestsAllowed !== null && listing.guestsAllowed !== undefined && (
                    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border",
                      listing.guestsAllowed ? "border-border bg-secondary/30" : "border-destructive/20 bg-destructive/5")}>
                      <Users className={cn("w-4 h-4 flex-shrink-0", listing.guestsAllowed ? "text-foreground" : "text-destructive")} />
                      <span className="text-sm font-medium text-foreground">
                        {listing.guestsAllowed ? t("listings.detail.guestsAllowed") : t("listings.detail.guestsNotAllowed")}
                      </span>
                    </div>
                  )}
                  {listing.genderPreference && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-secondary/30">
                      <UserCheck className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">
                        {genderLabel[listing.genderPreference] || listing.genderPreference}
                      </span>
                    </div>
                  )}
                  {listing.quietHours && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-secondary/30">
                      <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t("listings.detail.quietHours")}</p>
                        <p className="text-sm font-medium text-foreground">{listing.quietHours}</p>
                      </div>
                    </div>
                  )}
                  {(listing.minStay || listing.maxStay) && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-secondary/30">
                      <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {listing.minStay && listing.maxStay
                            ? `${t("listings.detail.minStay")} / ${t("listings.detail.maxStay")}`
                            : listing.minStay ? t("listings.detail.minStay") : t("listings.detail.maxStay")}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {[
                            listing.minStay ? `${listing.minStay} ${t("listings.detail.months")}` : null,
                            listing.maxStay ? `${listing.maxStay} ${t("listings.detail.months")}` : null,
                          ].filter(Boolean).join(" – ")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Roommate Preferences */}
            {listing.roommateNote && (
              <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
                <h2 className="text-xl font-display font-bold text-foreground mb-3">{t("listings.detail.roommatePreferences")}</h2>
                <p className="text-muted-foreground leading-relaxed">{listing.roommateNote}</p>
              </div>
            )}

            {/* Match Score (seekers only) */}
            {isSeeker && (
              <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-display font-bold text-foreground">{t("listings.detail.matchScore")}</h2>
                </div>

                {preferences === undefined ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> {t("common.loading")}
                  </div>
                ) : preferences === null || !matchResult ? (
                  <div className="text-center py-4">
                    <Sparkles className="w-8 h-8 text-primary/40 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm mb-4">{t("listings.detail.matchNoPreferences")}</p>
                    <Link href="/preferences"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                      {t("listings.detail.matchSetPreferences")}
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-end gap-4">
                      <span className={cn("text-5xl font-display font-bold", scoreColor)}>{matchResult.score}%</span>
                      <div className="flex-1 pb-1.5">
                        <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-700", scoreBarColor)}
                            style={{ width: `${matchResult.score}%` }} />
                        </div>
                      </div>
                    </div>
                    {matchResult.reasons.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {matchResult.reasons.map(r => (
                          <span key={r} className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-full">
                            <Check className="w-3 h-3" />
                            {t(`listings.detail.${r}`)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Request to Join */}
            {isSeeker && !isOwner && (
              <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
                <h2 className="text-xl font-display font-bold text-foreground mb-4">{t("listings.detail.requestToJoin")}</h2>
                {requestStatus === "sent" ? (
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800 dark:text-green-300">{t("listings.detail.requestSent")}</p>
                      <p className="text-sm text-green-700 dark:text-green-400">{t("listings.detail.requestSentDesc")}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {!showRequestForm ? (
                      <button onClick={() => setShowRequestForm(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:-translate-y-0.5 transition-all shadow-md shadow-primary/20">
                        <Send className="w-4 h-4" /> {t("listings.detail.requestToJoin")}
                      </button>
                    ) : (
                      <form onSubmit={handleRequest} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">{t("listings.detail.messageToOwner")}</label>
                          <textarea value={requestMessage} onChange={e => setRequestMessage(e.target.value)}
                            placeholder={t("listings.detail.messageToOwnerPh")} rows={4}
                            className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none" />
                        </div>
                        <div className="flex gap-3">
                          <button type="submit" disabled={requestStatus === "sending"}
                            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:-translate-y-0.5 transition-all shadow-md shadow-primary/20 disabled:opacity-50">
                            {requestStatus === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {t("listings.detail.sendRequest")}
                          </button>
                          <button type="button" onClick={() => setShowRequestForm(false)}
                            className="px-6 py-3 rounded-xl font-medium text-muted-foreground border-2 border-border hover:border-primary/40 transition-colors">
                            {t("listings.detail.cancel")}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Similar Listings */}
            {similarListings.length > 0 && (
              <div>
                <h2 className="text-xl font-display font-bold text-foreground mb-4">{t("listings.detail.similarListings")}</h2>
                <div className="flex gap-4 overflow-x-auto pb-3">
                  {similarListings.map((sl, i) => (
                    <div key={sl.id} className="flex-shrink-0 w-[260px]">
                      <ListingCard listing={sl} index={i} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-xl shadow-black/5 sticky top-28 space-y-5">
              {/* Price */}
              <div className="text-center pb-5 border-b border-border">
                <span className="text-muted-foreground text-sm font-medium uppercase tracking-wider">{t("listings.detail.monthlyRent")}</span>
                <div className="text-4xl font-display font-bold text-foreground mt-2">
                  {formatPrice(listing.price)}
                </div>
                {listing.billsIncluded && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">{t("listings.detail.billsIncluded")}</p>
                )}
              </div>

              {/* Owner Card */}
              <div className="bg-secondary/50 p-4 rounded-xl flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-foreground">
                    {(listing.ownerName || listing.ownerEmail || "O")[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t("listings.detail.owner")}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {listing.ownerName || listing.ownerEmail?.split("@")[0] || t("listings.detail.owner")}
                    </p>
                    {listing.isFeatured && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30 px-1.5 py-0.5 rounded-full">
                        <BadgeCheck className="w-3 h-3" /> {t("listings.verified")}
                      </span>
                    )}
                  </div>
                  {listing.ownerCreatedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("listings.detail.memberSince")} {format(new Date(listing.ownerCreatedAt), "MMM yyyy")}
                    </p>
                  )}
                </div>
              </div>

              {/* Analytics (owner only) */}
              {isOwner && listing.isFeatured && listing.viewCount !== null && listing.viewCount !== undefined && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-background rounded-xl border border-border p-3 text-center">
                    <Eye className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold text-foreground">{listing.viewCount}</p>
                    <p className="text-xs text-muted-foreground">{t("dashboard.views")}</p>
                  </div>
                  <div className="bg-background rounded-xl border border-border p-3 text-center">
                    <MousePointerClick className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold text-foreground">{listing.contactClickCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">{t("dashboard.clicks")}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!isOwner && user && (
                <button onClick={handleContactOwner} disabled={isMsgSending}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50">
                  {isMsgSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                  {t("listings.detail.contactOwner")}
                </button>
              )}

              {!user && (
                <Link href="/login"
                  className="w-full block text-center bg-primary text-primary-foreground py-3.5 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                  {t("listings.detail.logInToContact")}
                </Link>
              )}

              {isOwner && (
                <div className="text-center text-sm text-muted-foreground p-3 bg-secondary/50 rounded-xl">
                  {t("listings.detail.yourListing")}
                </div>
              )}

              {/* Report button (non-owner logged in users) */}
              {user && !isOwner && (
                <button onClick={() => setShowReportModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground hover:text-destructive transition-colors border border-border rounded-xl hover:border-destructive/30">
                  <Flag className="w-3.5 h-3.5" />
                  {t("listings.detail.reportListing")}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
