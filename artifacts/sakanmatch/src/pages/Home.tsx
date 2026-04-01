import { useState, useEffect, useRef } from "react";
import { useGetListings } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { ListingCard } from "@/components/ListingCard";
import { Navbar } from "@/components/Navbar";
import { Search, Loader2, Home as HomeIcon, Users, Star, MapPin, ArrowRight, Shield, Zap, Heart, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

const MOROCCAN_CITIES = ["Casablanca", "Rabat", "Marrakech", "Fes", "Tangier", "Agadir", "Meknes"];

export default function Home() {
  const [city, setCity] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const listingsSectionRef = useRef<HTMLElement>(null);
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: listings, isLoading } = useGetListings(
    { city: searchCity || undefined },
    { query: { queryKey: ["/api/listings", searchCity] } }
  );

  useEffect(() => {
    if (user?.role === "seeker") {
      api.getFavoriteIds()
        .then(ids => setFavoriteIds(Array.isArray(ids) ? ids : []))
        .catch(() => {});
    }
  }, [user]);

  const scrollToListings = () => {
    listingsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSearch = () => {
    setSearchCity(city);
    setTimeout(scrollToListings, 100);
  };

  const handleFavoriteChange = (listingId: number, isFav: boolean) => {
    setFavoriteIds(prev =>
      isFav ? [...prev, listingId] : prev.filter(id => id !== listingId)
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative pt-16 pb-28 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img 
              src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
              alt="Moroccan architecture" 
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/40" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-20">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="max-w-2xl"
            >
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-5 tracking-wide uppercase">
                {t("home.badge")}
              </span>
              <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground leading-[1.1]">
                {t("home.headline1")} <br/>
                <span className="text-primary relative">
                  {t("home.headline2")}
                  <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                  </svg>
                </span> {t("home.headline3")}
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-lg">
                {t("home.subtitle")}
              </p>

              {/* Search Bar */}
              <div className="mt-10 max-w-md bg-card rounded-2xl p-2 shadow-xl shadow-black/10 flex items-center border border-border">
                <div className="pl-4 pr-2 text-muted-foreground">
                  <MapPin className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  placeholder={t("home.searchPlaceholder")}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-grow bg-transparent border-none focus:ring-0 text-foreground placeholder:text-muted-foreground py-3 px-2 outline-none text-sm"
                />
                <button
                  onClick={handleSearch}
                  className="bg-primary text-primary-foreground px-5 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-md text-sm"
                >
                  {t("home.search")}
                </button>
              </div>

              {/* Quick city pills */}
              <div className="mt-5 flex flex-wrap gap-2">
                {MOROCCAN_CITIES.slice(0, 5).map(c => (
                  <button
                    key={c}
                    onClick={() => { setCity(c); setSearchCity(c); setTimeout(scrollToListings, 100); }}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex items-center gap-5">
                {user ? (
                  <Link href="/dashboard" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all">
                    {t("home.goToDashboard")} <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <>
                    <Link href="/signup" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all">
                      {t("home.getStarted")} <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      {t("home.alreadyMember")}
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats Banner */}
        <section className="bg-card border-y border-border py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { label: t("home.stats.activeListings"), value: "500+", icon: HomeIcon },
                { label: t("home.stats.happyRoommates"), value: "2,000+", icon: Users },
                { label: t("home.stats.citiesCovered"), value: "12+", icon: MapPin },
                { label: t("home.stats.avgMatchScore"), value: "94%", icon: Star },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <Icon className="w-6 h-6 text-primary" />
                  <span className="text-2xl font-display font-bold text-foreground">{value}</span>
                  <span className="text-sm text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-display font-bold text-foreground">{t("home.whySakanMatch")}</h2>
              <p className="text-muted-foreground mt-4 max-w-xl mx-auto">{t("home.whySubtitle")}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Zap,
                  title: t("home.features.smartMatching"),
                  desc: t("home.features.smartMatchingDesc")
                },
                {
                  icon: MessageSquare,
                  title: t("home.features.directMessaging"),
                  desc: t("home.features.directMessagingDesc")
                },
                {
                  icon: Shield,
                  title: t("home.features.verifiedOwners"),
                  desc: t("home.features.verifiedOwnersDesc")
                },
                {
                  icon: Heart,
                  title: t("home.features.saveFavorites"),
                  desc: t("home.features.saveFavoritesDesc")
                },
                {
                  icon: Users,
                  title: t("home.features.requestToJoin"),
                  desc: t("home.features.requestToJoinDesc")
                },
                {
                  icon: MapPin,
                  title: t("home.features.moroccanCities"),
                  desc: t("home.features.moroccanCitiesDesc")
                },
              ].map(({ icon: Icon, title, desc }) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  className="bg-card rounded-2xl p-7 border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-display font-semibold text-foreground mb-3">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-24 bg-secondary/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-display font-bold text-foreground">{t("home.howItWorks")}</h2>
              <p className="text-muted-foreground mt-4 max-w-xl mx-auto">{t("home.howSubtitle")}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-10 relative">
              <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-primary/30 to-primary/30 border-t border-dashed border-primary/30" />
              {[
                { step: "1", title: t("home.steps.step1"), desc: t("home.steps.step1Desc") },
                { step: "2", title: t("home.steps.step2"), desc: t("home.steps.step2Desc") },
                { step: "3", title: t("home.steps.step3"), desc: t("home.steps.step3Desc") },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex flex-col items-center text-center relative">
                  <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-display font-bold mb-6 shadow-lg shadow-primary/30 relative z-10">
                    {step}
                  </div>
                  <h3 className="text-xl font-display font-semibold text-foreground mb-3">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Listings Section */}
        <section ref={listingsSectionRef} className="py-24 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-10">
              <div>
                <h2 className="text-3xl font-display font-bold text-foreground">
                  {searchCity ? t("home.listingsIn", { city: searchCity }) : t("home.featuredListings")}
                </h2>
                <p className="text-muted-foreground mt-2">{t("home.latestListings")}</p>
              </div>
              {searchCity && (
                <button onClick={() => { setCity(""); setSearchCity(""); }} className="text-sm text-primary hover:underline">
                  {t("home.clearFilter")}
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            ) : listings && listings.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {listings.map((listing, i) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    index={i}
                    isFavorited={favoriteIds.includes(listing.id)}
                    onFavoriteChange={handleFavoriteChange}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border">
                <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground">{t("home.noListingsFound")}</h3>
                <p className="text-muted-foreground mt-2">{t("home.noListingsSub")}</p>
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-primary/10 via-background to-accent/20 border-t border-border">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-4xl font-display font-bold text-foreground mb-4">{t("home.readyToFind")}</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              {t("home.readyCta")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link href="/dashboard" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold shadow-xl shadow-primary/30 hover:-translate-y-1 transition-all text-lg">
                  {t("home.goToDashboard")} <ArrowRight className="w-5 h-5" />
                </Link>
              ) : (
                <>
                  <Link href="/signup" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold shadow-xl shadow-primary/30 hover:-translate-y-1 transition-all text-lg">
                    {t("home.startForFree")} <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link href="/" className="text-muted-foreground font-medium hover:text-foreground transition-colors">
                    {t("home.browseFirst")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-16 bg-card border-t border-border">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">{t("home.contactUs")}</h2>
            <p className="text-muted-foreground mb-10">{t("home.contactSubtitle")}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://www.instagram.com/sakanmatch.ma/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl border-2 border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group"
              >
                <InstagramIcon className="w-5 h-5 text-[#E1306C] group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold text-foreground">@sakanmatch.ma</span>
              </a>
              <a
                href="mailto:contact@sakanmatch.site"
                className="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl border-2 border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 group"
              >
                <Mail className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold text-foreground">contact@sakanmatch.site</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-display font-bold text-foreground">Sakan<span className="text-primary">Match</span></span>
            </div>

            {/* Copyright */}
            <p className="text-sm text-muted-foreground order-last md:order-none">{t("home.footer")}</p>

            {/* Links + Social */}
            <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-muted-foreground">
              {user ? (
                <Link href="/dashboard" className="hover:text-primary transition-colors">{t("nav.dashboard")}</Link>
              ) : (
                <>
                  <Link href="/login" className="hover:text-primary transition-colors">{t("nav.login")}</Link>
                  <Link href="/signup" className="hover:text-primary transition-colors">{t("nav.signup")}</Link>
                </>
              )}
              <span className="text-border">|</span>
              <a
                href="https://www.instagram.com/sakanmatch.ma/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#E1306C] transition-colors flex items-center gap-1.5"
                aria-label="Instagram"
              >
                <InstagramIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Instagram</span>
              </a>
              <a
                href="mailto:contact@sakanmatch.site"
                className="hover:text-primary transition-colors flex items-center gap-1.5"
                aria-label="Email"
              >
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">contact@sakanmatch.site</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MessageSquare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
