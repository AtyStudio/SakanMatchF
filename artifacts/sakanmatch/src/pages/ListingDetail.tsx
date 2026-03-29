import { useState, useEffect } from "react";
import { useGetListing, useRecordContactClick } from "@workspace/api-client-react";
import { Navbar } from "@/components/Navbar";
import { useRoute, Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, ArrowLeft, Calendar, ChevronLeft, ChevronRight,
  Heart, Send, MessageSquare, Loader2, CheckCircle, Eye, MousePointerClick, BadgeCheck
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80";

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

  const recordContactClickMutation = useRecordContactClick();

  const { data: listing, isLoading, error } = useGetListing(id, {
    query: { enabled: !!id }
  });

  useEffect(() => {
    if (!user || user.role !== "seeker" || !id) return;
    api.getFavoriteIds().then(ids => {
      setIsFavorited(ids.includes(id));
    }).catch(() => {});
  }, [user, id]);

  useEffect(() => {
    if (!id) return;
    const sessionKey = `viewed_listing_${id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/listings/${id}/view`, { method: "POST", credentials: "include" }).catch(() => {});
  }, [id]);

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
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ variant: "destructive", title: t("common.error"), description: message });
    } finally {
      setIsFavLoading(false);
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
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
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

  const isOwner = user?.id === listing.ownerId;
  const isSeeker = user?.role === "seeker";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("listings.detail.backToSearch")}
          </Link>
          {isSeeker && (
            <button
              onClick={toggleFavorite}
              disabled={isFavLoading}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border-2",
                isFavorited
                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-800"
                  : "bg-card border-border text-muted-foreground hover:border-red-300 hover:text-red-500"
              )}
            >
              <Heart className={cn("w-4 h-4", isFavorited ? "fill-red-500 text-red-500" : "")} />
              {isFavorited ? t("listings.detail.saved") : t("listings.detail.save")}
            </button>
          )}
        </div>

        {/* Image Gallery */}
        <div className="relative aspect-[16/9] md:aspect-[21/9] rounded-3xl overflow-hidden mb-4 shadow-lg border border-border">
          <img src={currentImage} alt={listing.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10 text-white">
            <div className="flex items-center gap-2 text-white/90 mb-2 font-medium">
              <MapPin className="w-5 h-5 text-primary" />
              <span className="text-lg drop-shadow-md">{listing.city}</span>
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
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "flex-shrink-0 w-20 h-14 rounded-xl overflow-hidden border-2 transition-all duration-150",
                  i === activeIndex ? "border-primary shadow-md" : "border-border hover:border-primary/50 opacity-70 hover:opacity-100"
                )}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-sm">
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">{t("listings.detail.aboutProperty")}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {listing.description || t("listings.detail.fallbackDesc", { city: listing.city })}
              </p>

              <div className="mt-8">
                <div className="flex items-center gap-3 p-4 bg-background rounded-xl border border-border w-fit">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t("listings.detail.listedOn")}</p>
                    <p className="font-semibold text-sm">
                      {listing.createdAt ? format(new Date(listing.createdAt), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

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
                      <button
                        onClick={() => setShowRequestForm(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:-translate-y-0.5 transition-all shadow-md shadow-primary/20"
                      >
                        <Send className="w-4 h-4" /> {t("listings.detail.requestToJoin")}
                      </button>
                    ) : (
                      <form onSubmit={handleRequest} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">{t("listings.detail.messageToOwner")}</label>
                          <textarea
                            value={requestMessage}
                            onChange={e => setRequestMessage(e.target.value)}
                            placeholder={t("listings.detail.messageToOwnerPh")}
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all resize-none"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="submit"
                            disabled={requestStatus === "sending"}
                            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:-translate-y-0.5 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
                          >
                            {requestStatus === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {t("listings.detail.sendRequest")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRequestForm(false)}
                            className="px-6 py-3 rounded-xl font-medium text-muted-foreground border-2 border-border hover:border-primary/40 transition-colors"
                          >
                            {t("listings.detail.cancel")}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-xl shadow-black/5 sticky top-28">
              <div className="text-center pb-6 border-b border-border mb-6">
                <span className="text-muted-foreground text-sm font-medium uppercase tracking-wider">{t("listings.detail.monthlyRent")}</span>
                <div className="text-4xl font-display font-bold text-foreground mt-2">
                  {formatPrice(listing.price)}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-secondary/50 p-4 rounded-xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-sm font-bold text-foreground">
                      {(listing.ownerName || listing.ownerEmail || "O")[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("listings.detail.owner")}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-foreground">{listing.ownerName || listing.ownerEmail?.split("@")[0] || t("listings.detail.owner")}</p>
                      {listing.isFeatured && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30 px-1.5 py-0.5 rounded-full">
                          <BadgeCheck className="w-3 h-3" /> {t("listings.verified")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

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

                {!isOwner && user && (
                  <button
                    onClick={handleContactOwner}
                    disabled={isMsgSending}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
                  >
                    {isMsgSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                    {t("listings.detail.contactOwner")}
                  </button>
                )}

                {!user && (
                  <Link
                    href="/login"
                    className="w-full block text-center bg-primary text-primary-foreground py-3.5 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    {t("listings.detail.logInToContact")}
                  </Link>
                )}

                {isOwner && (
                  <div className="text-center text-sm text-muted-foreground p-3 bg-secondary/50 rounded-xl">
                    {t("listings.detail.yourListing")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
