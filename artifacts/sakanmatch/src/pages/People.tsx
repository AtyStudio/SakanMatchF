import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { useLocation, Link } from "wouter";
import { api, type PeopleMatchResult } from "@/lib/api";
import { Loader2, Users, User, DollarSign, Filter, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const MOROCCAN_CITIES = ["Casablanca", "Rabat", "Marrakech", "Fes", "Tangier", "Agadir", "Meknes", "Oujda", "Kenitra", "Tetouan"];

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#3b82f6" : score >= 30 ? "#f59e0b" : "#ef4444";
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-secondary" />
        <circle
          cx="28" cy="28" r={radius}
          fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-foreground">{score}%</span>
      </div>
    </div>
  );
}

function TraitChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground border border-border">
      {label}
    </span>
  );
}

function formatTrait(key: string, value: string): string {
  const map: Record<string, Record<string, string>> = {
    gender: { male: "Male", female: "Female", other: "Other" },
    cleanlinessLevel: { very_clean: "Very clean", clean: "Clean", moderate: "Moderate", relaxed: "Relaxed" },
    sleepSchedule: { early_bird: "Early bird", night_owl: "Night owl", flexible: "Flexible schedule" },
    noiseTolerance: { quiet: "Quiet space", moderate: "Moderate noise", loud: "Ok with noise" },
    lifestyle: { quiet: "Quiet lifestyle", social: "Social lifestyle", any: "Flexible lifestyle" },
    smoking: { no: "Non-smoking", yes: "Smoker ok", any: "Smoking flexible" },
    guestPreference: { rarely: "Few guests", sometimes: "Occasional guests", often: "Loves guests" },
    petPreference: { love_pets: "Loves pets", no_pets: "No pets", no_preference: "Pet flexible" },
  };
  return map[key]?.[value] || value;
}

function MatchCard({ match }: { match: PeopleMatchResult }) {
  const { t } = useTranslation();
  const displayName = match.profile.fullName || match.name || match.email.split("@")[0];
  const traits: string[] = [];
  if (match.profile.gender) traits.push(formatTrait("gender", match.profile.gender));
  if (match.profile.occupation) traits.push(match.profile.occupation);
  if (match.preferences.city) traits.push(match.preferences.city);
  if (match.profile.sleepSchedule) traits.push(formatTrait("sleepSchedule", match.profile.sleepSchedule));
  if (match.preferences.lifestyle && match.preferences.lifestyle !== "any") traits.push(formatTrait("lifestyle", match.preferences.lifestyle));
  if (match.profile.cleanlinessLevel) traits.push(formatTrait("cleanlinessLevel", match.profile.cleanlinessLevel));
  const visibleTraits = traits.slice(0, 4);

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 p-5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {match.profile.avatarUrl ? (
            <img src={match.profile.avatarUrl} alt={displayName} className="w-14 h-14 rounded-xl object-cover border-2 border-border" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-secondary border-2 border-border flex items-center justify-center">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display font-bold text-foreground truncate">{displayName}</h3>
              {match.profile.age && (
                <p className="text-xs text-muted-foreground">{match.profile.age} {t("people.yrsOld")}</p>
              )}
            </div>
            <ScoreRing score={match.score} />
          </div>
        </div>
      </div>

      {match.profile.bio && (
        <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{match.profile.bio}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mt-3">
        {visibleTraits.map((t, i) => <TraitChip key={i} label={t} />)}
      </div>

      {match.preferences.budgetMin && match.preferences.budgetMax && (
        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
          <DollarSign className="w-3.5 h-3.5" />
          <span>{Math.round(parseFloat(match.preferences.budgetMin)).toLocaleString()} – {Math.round(parseFloat(match.preferences.budgetMax)).toLocaleString()} MAD/mo</span>
        </div>
      )}

      {match.matchReasons.length > 0 && (
        <div className="mt-3 p-2.5 bg-primary/5 rounded-xl border border-primary/10">
          <p className="text-xs text-primary font-medium">
            {match.matchReasons.slice(0, 2).join(" · ")}
          </p>
        </div>
      )}

      <Link
        href={`/profile/${match.userId}`}
        className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-semibold text-sm rounded-xl transition-all duration-200"
      >
        {t("people.viewProfile")} <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

export default function People() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const [matches, setMatches] = useState<PeopleMatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCity, setFilterCity] = useState("");
  const [filterLifestyle, setFilterLifestyle] = useState("");

  useEffect(() => {
    if (!isAuthLoading && !user) setLocation("/login");
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    api.getPeopleMatches({ city: filterCity || undefined, lifestyle: filterLifestyle || undefined })
      .then(m => setMatches(Array.isArray(m) ? m : []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user, filterCity, filterLifestyle]);

  if (isAuthLoading) {
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
      <main className="flex-grow max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              {t("people.title")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("people.subtitle")}</p>
          </div>
          <Link href="/profile" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition-all duration-200">
            {t("people.editMyProfile")}
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm mb-6 flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <select
            value={filterCity}
            onChange={e => setFilterCity(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-background border-2 border-border text-sm text-foreground focus:outline-none focus:border-primary transition-all"
          >
            <option value="">{t("people.allCities")}</option>
            {MOROCCAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterLifestyle}
            onChange={e => setFilterLifestyle(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-background border-2 border-border text-sm text-foreground focus:outline-none focus:border-primary transition-all"
          >
            <option value="">{t("people.allLifestyles")}</option>
            <option value="quiet">{t("people.quiet")}</option>
            <option value="social">{t("people.social")}</option>
            <option value="any">{t("people.flexible")}</option>
          </select>
          {(filterCity || filterLifestyle) && (
            <button onClick={() => { setFilterCity(""); setFilterLifestyle(""); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              {t("people.clearFilters")}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        ) : matches.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {t("people.showing")} <span className="font-semibold text-foreground">{matches.length}</span> {t("people.potentialRoommates")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {matches.map(m => <MatchCard key={m.userId} match={m} />)}
            </div>
          </>
        ) : (
          <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
            <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="font-semibold text-lg text-foreground">{t("people.noMatches")}</p>
            <p className="text-muted-foreground text-sm mt-1 mb-6">
              {filterCity || filterLifestyle ? t("people.changeFilters") : t("people.noMatchesSub")}
            </p>
            <Link href="/profile" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-bold hover:-translate-y-0.5 transition-all shadow-md shadow-primary/25">
              {t("people.completeProfile")}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
