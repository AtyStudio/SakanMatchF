import { Link } from "wouter";
import { MapPin, Heart, Star, BadgeCheck } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { ListingResponse } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface ListingCardProps {
  listing: ListingResponse;
  index?: number;
  isFavorited?: boolean;
  onFavoriteChange?: (id: number, favorited: boolean) => void;
  squareBottom?: boolean;
}

export function ListingCard({ listing, index = 0, isFavorited, onFavoriteChange, squareBottom }: ListingCardProps) {
  const imageUrl = listing.images?.[0] || "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80";
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [favorited, setFavorited] = useState(isFavorited ?? false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    setFavorited(isFavorited ?? false);
  }, [isFavorited]);

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || user.role !== "seeker") return;

    const newFavorited = !favorited;
    setFavorited(newFavorited);
    setFavLoading(true);
    try {
      if (!newFavorited) {
        await api.removeFavorite(listing.id);
      } else {
        await api.addFavorite(listing.id);
      }
      onFavoriteChange?.(listing.id, newFavorited);
    } catch (err: unknown) {
      setFavorited(!newFavorited);
      const message = err instanceof Error ? err.message : t("common.error");
      toast({ variant: "destructive", title: t("common.error"), description: message });
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: "easeOut" }}
      className="group"
    >
      <Link href={`/listings/${listing.id}`} className="block h-full">
        <div className={cn(
          "bg-card h-full overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col",
          squareBottom ? "rounded-t-2xl border border-b-0" : "rounded-2xl border",
          listing.isFeatured
            ? "border-amber-400/60 shadow-amber-400/10 hover:shadow-amber-400/20 hover:border-amber-400/80"
            : "border-border/50 hover:border-primary/30"
        )}>
          
          <div className="relative aspect-video overflow-hidden bg-muted">
            <img 
              src={imageUrl} 
              alt={listing.title} 
              className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
              {listing.isFeatured ? (
                <div className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-yellow-950 px-2.5 py-1 rounded-full text-xs font-bold shadow-md">
                  <Star className="w-3 h-3 fill-yellow-950" /> {t("listings.featured")}
                </div>
              ) : <span />}
              <div className="bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm">
                {formatPrice(listing.price)}
                <span className="text-muted-foreground font-normal text-xs ml-1">{t("listings.perMonth")}</span>
              </div>
            </div>
            {user?.role === "seeker" && (
              <button
                onClick={handleFavorite}
                disabled={favLoading}
                className={cn(
                  "absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-md shadow-sm",
                  favorited
                    ? "bg-red-500/90 text-white"
                    : "bg-background/80 text-muted-foreground hover:text-red-400 hover:bg-background/90"
                )}
                title={favorited ? t("listings.removeFromFavorites") : t("listings.addToFavorites")}
              >
                <Heart className={cn("w-4 h-4", favorited ? "fill-white" : "")} />
              </button>
            )}
          </div>
          
          <div className="p-4 flex flex-col flex-grow">
            <div className="flex items-center gap-1 text-muted-foreground mb-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-xs font-medium truncate">{listing.city}</span>
            </div>
            
            <h3 className="font-display font-semibold text-base text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
              {listing.title}
            </h3>
            
            <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
                  {(listing.ownerName || listing.ownerEmail || "O")[0].toUpperCase()}
                </div>
                <span className="truncate max-w-[90px] text-xs">
                  {listing.ownerName || listing.ownerEmail?.split("@")[0] || t("listings.detail.owner")}
                </span>
                {listing.isFeatured && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0" title={t("listings.verified")}>
                    <BadgeCheck className="w-3 h-3" />
                  </span>
                )}
              </div>
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md flex-shrink-0">
                {t("listings.viewListing")} →
              </span>
            </div>
          </div>

        </div>
      </Link>
    </motion.div>
  );
}
