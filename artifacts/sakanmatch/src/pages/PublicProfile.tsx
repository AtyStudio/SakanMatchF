import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { useRoute, Link, useLocation } from "wouter";
import { api, type PublicProfileResponse } from "@/lib/api";
import { Loader2, ArrowLeft, User, MapPin, Briefcase, Moon, Volume2, Users, Heart, Calendar, DollarSign, BadgeCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

function TraitRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <span className="text-sm text-muted-foreground flex-shrink-0 w-32">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function PublicProfile() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, params] = useRoute("/profile/:userId");
  const userId = params ? parseInt(params.userId) : null;
  const { t } = useTranslation();

  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthLoading && !user) setLocation("/login");
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (!userId || isNaN(userId)) { setNotFound(true); setIsLoading(false); return; }
    if (!user) return;
    api.getPublicProfile(userId)
      .then(setProfile)
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [userId, user]);

  function formatTrait(key: string, value: string): string {
    const traitKey = `publicProfile.traits.${value}` as const;
    const translated = t(traitKey);
    return translated !== traitKey ? translated : value;
  }

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center gap-4">
          <User className="w-16 h-16 text-muted-foreground/50" />
          <h1 className="text-2xl font-display font-bold text-foreground">{t("publicProfile.profileNotFound")}</h1>
          <Link href="/people" className="text-primary hover:underline text-sm">{t("publicProfile.backToPeople")}</Link>
        </div>
      </div>
    );
  }

  const isOwnProfile = user?.id === profile.user.id;
  const displayName = profile.profile?.fullName || profile.user.name || profile.user.email.split("@")[0];
  const p = profile.profile;
  const prefs = profile.preferences;

  const genderLabel = p?.gender ? t(`publicProfile.gender.${p.gender}`) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-2xl w-full mx-auto px-4 sm:px-6 py-10">
        <Link href="/people" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("publicProfile.backToPeople")}
        </Link>

        {/* Header */}
        <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm mb-6">
          <div className="flex items-start gap-5">
            {p?.avatarUrl ? (
              <img src={p.avatarUrl} alt={displayName} className="w-20 h-20 rounded-2xl object-cover border-2 border-border flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-secondary border-2 border-border flex items-center justify-center flex-shrink-0">
                <User className="w-9 h-9 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-display font-bold text-foreground truncate">{displayName}</h1>
                {profile.user.isPremium && profile.user.role === "owner" && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                    <BadgeCheck className="w-3.5 h-3.5" /> {t("listings.verified")}
                  </span>
                )}
              </div>
              {p?.age && p?.gender && (
                <p className="text-muted-foreground text-sm">{p.age} {t("publicProfile.yrs")} · {genderLabel}</p>
              )}
              {p?.occupation && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Briefcase className="w-3.5 h-3.5" /> {p.occupation}
                </p>
              )}
              {prefs?.city && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5" /> {prefs.city}
                </p>
              )}
            </div>
          </div>

          {p?.bio && (
            <div className="mt-4 p-4 bg-background rounded-2xl border border-border">
              <p className="text-sm text-foreground leading-relaxed">{p.bio}</p>
            </div>
          )}

          {isOwnProfile && (
            <Link href="/profile" className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:-translate-y-0.5 transition-all">
              {t("publicProfile.editMyProfile")}
            </Link>
          )}
        </div>

        {/* Budget & Timeline */}
        {(prefs?.budgetMin || prefs?.budgetMax || p?.moveInDate) && (
          <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm mb-6">
            <h2 className="text-base font-display font-bold text-foreground mb-4">{t("publicProfile.housingDetails")}</h2>
            {prefs?.budgetMin && prefs?.budgetMax && (
              <TraitRow icon={DollarSign} label={t("publicProfile.budget")} value={`${Math.round(parseFloat(prefs.budgetMin)).toLocaleString()} – ${Math.round(parseFloat(prefs.budgetMax)).toLocaleString()} MAD/mo`} />
            )}
            {p?.moveInDate && (
              <TraitRow icon={Calendar} label={t("publicProfile.moveInDate")} value={new Date(p.moveInDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} />
            )}
          </div>
        )}

        {/* Lifestyle */}
        {(p?.cleanlinessLevel || p?.sleepSchedule || p?.noiseTolerance || prefs?.lifestyle) && (
          <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm mb-6">
            <h2 className="text-base font-display font-bold text-foreground mb-4">{t("publicProfile.lifestyle")}</h2>
            {prefs?.lifestyle && <TraitRow icon={Users} label={t("profile.lifestyleLabel")} value={formatTrait("lifestyle", prefs.lifestyle)} />}
            {p?.cleanlinessLevel && <TraitRow icon={Heart} label={t("profile.cleanliness")} value={formatTrait("cleanlinessLevel", p.cleanlinessLevel)} />}
            {p?.sleepSchedule && <TraitRow icon={Moon} label={t("publicProfile.sleep")} value={formatTrait("sleepSchedule", p.sleepSchedule)} />}
            {p?.noiseTolerance && <TraitRow icon={Volume2} label={t("publicProfile.noise")} value={formatTrait("noiseTolerance", p.noiseTolerance)} />}
          </div>
        )}

        {/* Preferences */}
        {(prefs?.smoking || p?.guestPreference || p?.petPreference || prefs?.genderPref) && (
          <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm mb-6">
            <h2 className="text-base font-display font-bold text-foreground mb-4">{t("publicProfile.preferencesSection")}</h2>
            {prefs?.smoking && prefs.smoking !== "any" && <TraitRow icon={Heart} label={t("profile.smoking")} value={formatTrait("smoking", prefs.smoking)} />}
            {p?.guestPreference && <TraitRow icon={Users} label={t("profile.guests")} value={formatTrait("guestPreference", p.guestPreference)} />}
            {p?.petPreference && <TraitRow icon={Heart} label={t("profile.pets")} value={formatTrait("petPreference", p.petPreference)} />}
            {prefs?.genderPref && prefs.genderPref !== "any" && <TraitRow icon={User} label={t("profile.genderPreference")} value={t(`publicProfile.gender.${prefs.genderPref}`) + " roommates"} />}
          </div>
        )}

        {!p && !prefs && (
          <div className="text-center py-12 bg-card rounded-3xl border border-dashed border-border">
            <User className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("publicProfile.noProfileYet")}</p>
          </div>
        )}
      </main>
    </div>
  );
}
