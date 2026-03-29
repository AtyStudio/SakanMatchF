import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Loader2, ArrowLeft, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const MOROCCAN_CITIES = ["Casablanca", "Rabat", "Marrakech", "Fes", "Tangier", "Agadir", "Meknes", "Oujda", "Kenitra", "Tetouan"];

export default function Preferences() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [city, setCity] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [lifestyle, setLifestyle] = useState<"quiet" | "social" | "any">("any");
  const [smoking, setSmoking] = useState<"yes" | "no" | "any">("any");
  const [genderPref, setGenderPref] = useState<"male" | "female" | "any">("any");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) setLocation("/login");
    if (!isAuthLoading && user?.role !== "seeker") setLocation("/dashboard");
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (!user) return;
    api.getPreferences().then(pref => {
      if (pref) {
        setCity(pref.city || "");
        setBudgetMin(pref.budgetMin ? String(Math.round(parseFloat(pref.budgetMin))) : "");
        setBudgetMax(pref.budgetMax ? String(Math.round(parseFloat(pref.budgetMax))) : "");
        const ls = pref.lifestyle as "quiet" | "social" | "any" | null;
        const sm = pref.smoking as "yes" | "no" | "any" | null;
        const gp = pref.genderPref as "male" | "female" | "any" | null;
        setLifestyle(ls || "any");
        setSmoking(sm || "any");
        setGenderPref(gp || "any");
      }
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updatePreferences({
        city: city || null,
        budgetMin: budgetMin ? parseFloat(budgetMin) : null,
        budgetMax: budgetMax ? parseFloat(budgetMax) : null,
        lifestyle,
        smoking,
        genderPref,
      });
      toast({ title: t("preferences.saved"), description: t("preferences.savedDesc") });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("preferences.errorSaving");
      toast({ variant: "destructive", title: t("common.error"), description: message });
    } finally {
      setIsSaving(false);
    }
  };

  const ToggleGroup = ({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
  }) => (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-3">{label}</label>
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
    </div>
  );

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-2xl w-full mx-auto px-4 sm:px-6 py-12">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("preferences.backToDashboard")}
        </Link>

        <div className="bg-card rounded-3xl p-8 border border-border/50 shadow-lg">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sliders className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{t("preferences.title")}</h1>
              <p className="text-muted-foreground text-sm">{t("preferences.subtitle")}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">{t("preferences.preferredCity")}</label>
              <select
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              >
                <option value="">{t("preferences.anyCity")}</option>
                {MOROCCAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">{t("preferences.monthlyBudget")}</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="number"
                    value={budgetMin}
                    onChange={e => setBudgetMin(e.target.value)}
                    placeholder={t("preferences.budgetMinPh")}
                    min={0}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={budgetMax}
                    onChange={e => setBudgetMax(e.target.value)}
                    placeholder={t("preferences.budgetMaxPh")}
                    min={0}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
              </div>
            </div>

            <ToggleGroup
              label={t("preferences.lifestyle")}
              value={lifestyle}
              onChange={v => setLifestyle(v as "quiet" | "social" | "any")}
              options={[
                { value: "any", label: t("preferences.noPreference") },
                { value: "quiet", label: t("preferences.quiet") },
                { value: "social", label: t("preferences.social") },
              ]}
            />

            <ToggleGroup
              label={t("preferences.smoking")}
              value={smoking}
              onChange={v => setSmoking(v as "yes" | "no" | "any")}
              options={[
                { value: "any", label: t("preferences.noPreference") },
                { value: "no", label: t("preferences.nonSmoking") },
                { value: "yes", label: t("preferences.smokingOk") },
              ]}
            />

            <ToggleGroup
              label={t("preferences.genderPreference")}
              value={genderPref}
              onChange={v => setGenderPref(v as "male" | "female" | "any")}
              options={[
                { value: "any", label: t("preferences.noPreference") },
                { value: "male", label: t("preferences.maleOnly") },
                { value: "female", label: t("preferences.femaleOnly") },
              ]}
            />

            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-xl font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : t("preferences.savePreferences")}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
