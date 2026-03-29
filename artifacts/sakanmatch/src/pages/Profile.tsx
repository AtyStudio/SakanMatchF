import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { api, uploadFile, type UserProfileData, type FullProfileResponse } from "@/lib/api";
import { Loader2, ArrowLeft, User, Briefcase, Moon, Heart, FileText, Camera, CheckCircle, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];

const MOROCCAN_CITIES = ["Casablanca", "Rabat", "Marrakech", "Fes", "Tangier", "Agadir", "Meknes", "Oujda", "Kenitra", "Tetouan"];

const ToggleGroup = ({ value, options, onChange }: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map(opt => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={cn(
          "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border-2",
          value === opt.value
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-background text-muted-foreground hover:border-primary/40"
        )}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const SectionCard = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
  <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h2 className="text-lg font-display font-bold text-foreground">{title}</h2>
    </div>
    <div className="space-y-6">{children}</div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-sm font-semibold text-foreground mb-2">{label}</label>
    {children}
  </div>
);

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

export default function Profile() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [fullProfile, setFullProfile] = useState<FullProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [occupation, setOccupation] = useState("");
  const [bio, setBio] = useState("");
  const [cleanlinessLevel, setCleanlinessLevel] = useState<"very_clean" | "clean" | "moderate" | "relaxed" | "">("");
  const [sleepSchedule, setSleepSchedule] = useState<"early_bird" | "night_owl" | "flexible" | "">("");
  const [noiseTolerance, setNoiseTolerance] = useState<"quiet" | "moderate" | "loud" | "">("");
  const [guestPreference, setGuestPreference] = useState<"rarely" | "sometimes" | "often" | "">("");
  const [petPreference, setPetPreference] = useState<"love_pets" | "no_pets" | "no_preference" | "">("");
  const [moveInDate, setMoveInDate] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [city, setCity] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [lifestyle, setLifestyle] = useState<"quiet" | "social" | "any">("any");
  const [smoking, setSmoking] = useState<"yes" | "no" | "any">("any");
  const [genderPref, setGenderPref] = useState<"male" | "female" | "any">("any");

  useEffect(() => {
    if (!isAuthLoading && !user) setLocation("/login");
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (!user) return;
    api.getProfile().then(data => {
      setFullProfile(data);
      const p = data.profile;
      const pref = data.preferences;
      if (p) {
        setFullName(p.fullName || "");
        setAge(p.age !== null && p.age !== undefined ? String(p.age) : "");
        setGender((p.gender as "male" | "female" | "other" | "") || "");
        setOccupation(p.occupation || "");
        setBio(p.bio || "");
        setCleanlinessLevel((p.cleanlinessLevel as "very_clean" | "clean" | "moderate" | "relaxed" | "") || "");
        setSleepSchedule((p.sleepSchedule as "early_bird" | "night_owl" | "flexible" | "") || "");
        setNoiseTolerance((p.noiseTolerance as "quiet" | "moderate" | "loud" | "") || "");
        setGuestPreference((p.guestPreference as "rarely" | "sometimes" | "often" | "") || "");
        setPetPreference((p.petPreference as "love_pets" | "no_pets" | "no_preference" | "") || "");
        setMoveInDate(p.moveInDate || "");
        setAvatarUrl(p.avatarUrl || "");
      }
      if (pref) {
        setCity(pref.city || "");
        setBudgetMin(pref.budgetMin ? String(Math.round(parseFloat(pref.budgetMin))) : "");
        setBudgetMax(pref.budgetMax ? String(Math.round(parseFloat(pref.budgetMax))) : "");
        setLifestyle((pref.lifestyle as "quiet" | "social" | "any") || "any");
        setSmoking((pref.smoking as "yes" | "no" | "any") || "any");
        setGenderPref((pref.genderPref as "male" | "female" | "any") || "any");
      }
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [user]);

  const completionPct = fullProfile ? computeCompletion(fullProfile) : 0;

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setAvatarError(null);
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setAvatarError(t("profile.avatarInvalidType"));
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError(t("profile.avatarTooLarge"));
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalAvatarUrl = avatarUrl;

      if (avatarFile) {
        const { objectPath } = await uploadFile(avatarFile);
        finalAvatarUrl = objectPath;
      }

      const profileData: UserProfileData = {
        fullName: fullName || null,
        age: age ? parseInt(age) : null,
        gender: gender || null,
        occupation: occupation || null,
        bio: bio || null,
        cleanlinessLevel: cleanlinessLevel || null,
        sleepSchedule: sleepSchedule || null,
        noiseTolerance: noiseTolerance || null,
        guestPreference: guestPreference || null,
        petPreference: petPreference || null,
        moveInDate: moveInDate || null,
        avatarUrl: finalAvatarUrl || null,
      };

      await api.updatePreferences({
        city: city || null,
        budgetMin: budgetMin ? parseFloat(budgetMin) : null,
        budgetMax: budgetMax ? parseFloat(budgetMax) : null,
        lifestyle,
        smoking,
        genderPref,
      });

      const updated = await api.updateProfile(profileData);
      setFullProfile(updated);
      if (avatarFile) {
        setAvatarUrl(finalAvatarUrl);
        setAvatarFile(null);
        setAvatarPreview(null);
      }
      toast({ title: t("profile.profileSaved"), description: t("profile.profileSavedDesc") });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("profile.errorSaving");
      toast({ variant: "destructive", title: t("common.error"), description: message });
    } finally {
      setIsSaving(false);
    }
  };

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

  const inputClass = "w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-3xl w-full mx-auto px-4 sm:px-6 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("profile.backToDashboard")}
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-display font-bold text-foreground">{t("profile.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("profile.subtitle")}</p>
        </div>

        {/* Profile Completion */}
        <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className={cn("w-4 h-4", completionPct >= 80 ? "text-green-500" : "text-muted-foreground")} />
              <span className="text-sm font-semibold text-foreground">{t("profile.profileCompletion")}</span>
            </div>
            <span className="text-sm font-bold text-primary">{completionPct}%</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", completionPct >= 80 ? "bg-green-500" : completionPct >= 50 ? "bg-primary" : "bg-amber-400")}
              style={{ width: `${completionPct}%` }}
            />
          </div>
          {completionPct < 80 && (
            <p className="text-xs text-muted-foreground mt-2">{t("profile.completeForMatches")}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Info */}
          <SectionCard icon={User} title={t("profile.personalInfo")}>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">{t("profile.profilePhoto")}</label>
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative flex-shrink-0 group focus:outline-none"
                  aria-label={t("profile.changePhoto")}
                >
                  {avatarPreview || avatarUrl ? (
                    <img
                      src={avatarPreview || avatarUrl}
                      alt="Avatar"
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-border group-hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-secondary border-2 border-border flex items-center justify-center group-hover:bg-secondary/70 transition-colors">
                      <Camera className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-2xl flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <Camera className="w-5 h-5 text-white drop-shadow" />
                  </div>
                </button>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    {avatarPreview || avatarUrl ? t("profile.changePhoto") : t("profile.uploadPhoto")}
                  </button>
                  <p className="text-xs text-muted-foreground">{t("profile.photoFormats")}</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
              {avatarError && (
                <p className="text-sm text-destructive mt-2">{avatarError}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("profile.fullName")}>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder={t("profile.fullNamePlaceholder")}
                  className={inputClass}
                />
              </Field>
              <Field label={t("profile.age")}>
                <input
                  type="number"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder={t("profile.agePlaceholder")}
                  min={16}
                  max={100}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label={t("profile.gender")}>
              <ToggleGroup
                value={gender}
                onChange={v => setGender(v as "male" | "female" | "other" | "")}
                options={[
                  { value: "male", label: t("profile.male") },
                  { value: "female", label: t("profile.female") },
                  { value: "other", label: t("profile.other") },
                ]}
              />
            </Field>

            <Field label={t("profile.occupation")}>
              <input
                type="text"
                value={occupation}
                onChange={e => setOccupation(e.target.value)}
                placeholder={t("profile.occupationPlaceholder")}
                className={inputClass}
              />
            </Field>
          </SectionCard>

          {/* Location & Budget */}
          <SectionCard icon={Briefcase} title={t("profile.locationBudget")}>
            <Field label={t("profile.preferredCity")}>
              <select
                value={city}
                onChange={e => setCity(e.target.value)}
                className={inputClass}
              >
                <option value="">{t("profile.anyCity")}</option>
                {MOROCCAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label={t("profile.monthlyBudget")}>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  value={budgetMin}
                  onChange={e => setBudgetMin(e.target.value)}
                  placeholder={t("profile.budgetMinPlaceholder")}
                  min={0}
                  className={inputClass}
                />
                <input
                  type="number"
                  value={budgetMax}
                  onChange={e => setBudgetMax(e.target.value)}
                  placeholder={t("profile.budgetMaxPlaceholder")}
                  min={0}
                  className={inputClass}
                />
              </div>
            </Field>

            <Field label={t("profile.moveInDate")}>
              <input
                type="date"
                value={moveInDate}
                onChange={e => setMoveInDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          </SectionCard>

          {/* Lifestyle */}
          <SectionCard icon={Moon} title={t("profile.lifestyle")}>
            <Field label={t("profile.lifestyleLabel")}>
              <ToggleGroup
                value={lifestyle}
                onChange={v => setLifestyle(v as "quiet" | "social" | "any")}
                options={[
                  { value: "any", label: t("profile.noPreference") },
                  { value: "quiet", label: t("profile.quiet") },
                  { value: "social", label: t("profile.social") },
                ]}
              />
            </Field>

            <Field label={t("profile.cleanliness")}>
              <ToggleGroup
                value={cleanlinessLevel}
                onChange={v => setCleanlinessLevel(v as "very_clean" | "clean" | "moderate" | "relaxed" | "")}
                options={[
                  { value: "very_clean", label: t("profile.veryClean") },
                  { value: "clean", label: t("profile.clean") },
                  { value: "moderate", label: t("profile.moderate") },
                  { value: "relaxed", label: t("profile.relaxed") },
                ]}
              />
            </Field>

            <Field label={t("profile.sleepSchedule")}>
              <ToggleGroup
                value={sleepSchedule}
                onChange={v => setSleepSchedule(v as "early_bird" | "night_owl" | "flexible" | "")}
                options={[
                  { value: "early_bird", label: t("profile.earlyBird") },
                  { value: "flexible", label: t("profile.flexible") },
                  { value: "night_owl", label: t("profile.nightOwl") },
                ]}
              />
            </Field>

            <Field label={t("profile.noiseTolerance")}>
              <ToggleGroup
                value={noiseTolerance}
                onChange={v => setNoiseTolerance(v as "quiet" | "moderate" | "loud" | "")}
                options={[
                  { value: "quiet", label: t("profile.quiet") },
                  { value: "moderate", label: t("profile.moderate") },
                  { value: "loud", label: t("profile.lively") },
                ]}
              />
            </Field>
          </SectionCard>

          {/* Preferences */}
          <SectionCard icon={Heart} title={t("profile.preferencesSection")}>
            <Field label={t("profile.smoking")}>
              <ToggleGroup
                value={smoking}
                onChange={v => setSmoking(v as "yes" | "no" | "any")}
                options={[
                  { value: "any", label: t("profile.noPreference") },
                  { value: "no", label: t("profile.nonSmoking") },
                  { value: "yes", label: t("profile.smokingOk") },
                ]}
              />
            </Field>

            <Field label={t("profile.genderPreference")}>
              <ToggleGroup
                value={genderPref}
                onChange={v => setGenderPref(v as "male" | "female" | "any")}
                options={[
                  { value: "any", label: t("profile.noPreference") },
                  { value: "male", label: t("profile.maleRoommates") },
                  { value: "female", label: t("profile.femaleRoommates") },
                ]}
              />
            </Field>

            <Field label={t("profile.guests")}>
              <ToggleGroup
                value={guestPreference}
                onChange={v => setGuestPreference(v as "rarely" | "sometimes" | "often" | "")}
                options={[
                  { value: "rarely", label: t("profile.rarely") },
                  { value: "sometimes", label: t("profile.sometimes") },
                  { value: "often", label: t("profile.often") },
                ]}
              />
            </Field>

            <Field label={t("profile.pets")}>
              <ToggleGroup
                value={petPreference}
                onChange={v => setPetPreference(v as "love_pets" | "no_pets" | "no_preference" | "")}
                options={[
                  { value: "love_pets", label: t("profile.lovePets") },
                  { value: "no_preference", label: t("profile.noPrefs") },
                  { value: "no_pets", label: t("profile.noPets") },
                ]}
              />
            </Field>
          </SectionCard>

          {/* About Me */}
          <SectionCard icon={FileText} title={t("profile.aboutMe")}>
            <Field label={t("profile.shortBio")}>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder={t("profile.bioPh")}
                rows={4}
                maxLength={500}
                className={cn(inputClass, "resize-none")}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/500</p>
            </Field>
          </SectionCard>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-xl font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : t("profile.saveProfile")}
          </button>
        </form>
      </main>
    </div>
  );
}
