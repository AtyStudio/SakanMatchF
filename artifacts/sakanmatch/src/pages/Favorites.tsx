import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { useLocation, Link } from "wouter";
import { api, type FavoriteListing } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ListingCard } from "@/components/ListingCard";
import { Heart, Loader2 } from "lucide-react";
import type { ListingResponse } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";

function toListingResponse(f: FavoriteListing): ListingResponse {
  return {
    id: f.id,
    title: f.title,
    price: f.price,
    city: f.city,
    images: f.images ?? [],
    ownerId: f.ownerId,
    ownerEmail: f.ownerEmail ?? undefined,
    ownerName: f.ownerName ?? null,
    createdAt: f.createdAt,
    description: null,
  };
}

export default function Favorites() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<FavoriteListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    if (!isAuthLoading && !user) setLocation("/login");
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (!user) return;
    api.getFavorites()
      .then(data => setFavorites(Array.isArray(data) ? data : []))
      .catch(() => toast({ variant: "destructive", title: t("common.error"), description: t("favorites.error") }))
      .finally(() => setIsLoading(false));
  }, [user]);

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-12 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Heart className="w-8 h-8 text-red-500 fill-red-500" />
            {t("favorites.title")}
          </h1>
          <p className="text-muted-foreground mt-2">{t("favorites.subtitle")}</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        ) : favorites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favorites.map((listing, i) => (
              <ListingCard
                key={listing.id}
                listing={toListingResponse(listing)}
                index={i}
                isFavorited={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border">
            <Heart className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground">{t("favorites.noFavorites")}</h3>
            <p className="text-muted-foreground mt-2 mb-6">{t("favorites.noFavoritesSub")}</p>
            <Link href="/" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:-translate-y-0.5 transition-all">
              {t("favorites.browseListings")}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
