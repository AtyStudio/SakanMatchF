import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight, ChevronLeft, Check, Heart, Loader2,
  User, Home, MapPin, Star, CreditCard, MessageSquare, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxGroup = string[];

interface SurveyAnswers {
  age: string;
  status: string;
  hasRented: string;
  rentalFrequency: string;
  stayType: string;
  problems: CheckboxGroup;
  importantCriteria: CheckboxGroup;
  interestedInApp: string;
  preferredPayment: string;
  wantToSee: string;
  suggestions: string;
  email: string;
}

const EMPTY: SurveyAnswers = {
  age: "",
  status: "",
  hasRented: "",
  rentalFrequency: "",
  stayType: "",
  problems: [],
  importantCriteria: [],
  interestedInApp: "",
  preferredPayment: "",
  wantToSee: "",
  suggestions: "",
  email: "",
};

const TOTAL_STEPS = 6;

function ProgressBar({ step, label }: { step: number; label: string }) {
  const pct = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold text-primary">{pct}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border-2",
              i + 1 < step
                ? "bg-primary border-primary text-primary-foreground"
                : i + 1 === step
                  ? "bg-background border-primary text-primary"
                  : "bg-background border-border text-muted-foreground",
            )}
          >
            {i + 1 < step ? <Check className="w-3 h-3" /> : i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

interface RadioOptionProps {
  value: string;
  selected: boolean;
  onSelect: () => void;
  label: string;
  emoji?: string;
}

function RadioOption({ selected, onSelect, label, emoji }: RadioOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-200 hover:-translate-y-0.5",
        selected
          ? "border-primary bg-primary/5 text-foreground shadow-sm shadow-primary/10"
          : "border-border bg-background text-foreground hover:border-primary/30",
      )}
    >
      <div className={cn(
        "w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all",
        selected ? "border-primary" : "border-muted-foreground",
      )}>
        {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
      {emoji && <span className="text-lg">{emoji}</span>}
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

interface CheckboxOptionProps {
  value: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  emoji?: string;
}

function CheckboxOption({ checked, onChange, label, emoji }: CheckboxOptionProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-200 hover:-translate-y-0.5",
        checked
          ? "border-primary bg-primary/5 text-foreground shadow-sm shadow-primary/10"
          : "border-border bg-background text-foreground hover:border-primary/30",
      )}
    >
      <div className={cn(
        "w-4 h-4 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all",
        checked ? "border-primary bg-primary" : "border-muted-foreground",
      )}>
        {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
      </div>
      {emoji && <span className="text-lg">{emoji}</span>}
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <h2 className="text-xl font-display font-bold text-foreground">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-muted-foreground ml-12">{subtitle}</p>}
    </div>
  );
}

function QuestionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-foreground mb-3">{children}</p>;
}

function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function Survey() {
  const { t } = useTranslation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<SurveyAnswers>({ ...EMPTY, email: user?.email || "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) setLocation("/login");
    if (!isAuthLoading && user?.hasCompletedSurvey) setLocation("/dashboard");
  }, [user, isAuthLoading, setLocation]);

  function setField<K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  function toggleCheckbox(key: "problems" | "importantCriteria", value: string) {
    setAnswers(prev => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
  }

  function canGoNext(): boolean {
    switch (step) {
      case 1: return !!answers.age && !!answers.status;
      case 2: return !!answers.hasRented && (answers.hasRented === "no" || !!answers.rentalFrequency);
      case 3: return !!answers.stayType && answers.problems.length > 0;
      case 4: return answers.importantCriteria.length > 0 && !!answers.interestedInApp;
      case 5: return !!answers.preferredPayment;
      case 6: return isEmailValid(answers.email);
      default: return false;
    }
  }

  async function handleSubmit() {
    if (!canGoNext()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      if (!res.ok) throw new Error("Submission failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setSubmitted(true);
    } catch {
      setIsSubmitting(false);
    }
  }

  async function handleSkip() {
    setLocation("/dashboard");
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh] px-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/10">
              <Heart className="w-10 h-10 text-primary" fill="currentColor" />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground mb-3">
              {t("survey.success.title")}
            </h1>
            <p className="text-muted-foreground mb-8">
              {t("survey.success.subtitle")}
            </p>
            <button
              onClick={() => setLocation("/dashboard")}
              className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:-translate-y-0.5 transition-all shadow-lg shadow-primary/25"
            >
              {t("survey.success.cta")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-8 pb-24">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">{t("survey.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("survey.subtitle")}</p>
        </div>

        <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-6 sm:p-8">
          <ProgressBar step={step} label={t("survey.step", { step, total: TOTAL_STEPS })} />

          {/* Step 1: About You */}
          {step === 1 && (
            <div>
              <SectionTitle
                icon={<User className="w-5 h-5" />}
                title={t("survey.step1.title")}
                subtitle={t("survey.step1.subtitle")}
              />
              <div className="space-y-6">
                <div>
                  <QuestionLabel>{t("survey.step1.ageLabel")}</QuestionLabel>
                  <div className="space-y-2">
                    {[
                      { value: "under18", emoji: "🧒" },
                      { value: "18-24", emoji: "🎓" },
                      { value: "25-34", emoji: "💼" },
                      { value: "35-44", emoji: "🏠" },
                      { value: "45+", emoji: "⭐" },
                    ].map(opt => (
                      <RadioOption
                        key={opt.value}
                        value={opt.value}
                        selected={answers.age === opt.value}
                        onSelect={() => setField("age", opt.value)}
                        label={t(`survey.step1.age.${opt.value}`)}
                        emoji={opt.emoji}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <QuestionLabel>{t("survey.step1.statusLabel")}</QuestionLabel>
                  <div className="space-y-2">
                    {[
                      { value: "student", emoji: "📚" },
                      { value: "employed", emoji: "👔" },
                      { value: "self-employed", emoji: "🚀" },
                      { value: "unemployed", emoji: "🔍" },
                      { value: "other", emoji: "✨" },
                    ].map(opt => (
                      <RadioOption
                        key={opt.value}
                        value={opt.value}
                        selected={answers.status === opt.value}
                        onSelect={() => setField("status", opt.value)}
                        label={t(`survey.step1.status.${opt.value}`)}
                        emoji={opt.emoji}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Rental Experience */}
          {step === 2 && (
            <div>
              <SectionTitle
                icon={<Home className="w-5 h-5" />}
                title={t("survey.step2.title")}
                subtitle={t("survey.step2.subtitle")}
              />
              <div className="space-y-6">
                <div>
                  <QuestionLabel>{t("survey.step2.hasRentedLabel")}</QuestionLabel>
                  <div className="space-y-2">
                    {[
                      { value: "yes", emoji: "✅" },
                      { value: "no", emoji: "❌" },
                    ].map(opt => (
                      <RadioOption
                        key={opt.value}
                        value={opt.value}
                        selected={answers.hasRented === opt.value}
                        onSelect={() => {
                          setField("hasRented", opt.value);
                          if (opt.value === "no") setField("rentalFrequency", "");
                        }}
                        label={t(`survey.step2.${opt.value}`)}
                        emoji={opt.emoji}
                      />
                    ))}
                  </div>
                </div>
                {answers.hasRented === "yes" && (
                  <div>
                    <QuestionLabel>{t("survey.step2.frequencyLabel")}</QuestionLabel>
                    <div className="space-y-2">
                      {[
                        { value: "rarely", emoji: "🌱" },
                        { value: "1-2-times", emoji: "📅" },
                        { value: "several-times", emoji: "🔄" },
                        { value: "very-often", emoji: "⚡" },
                      ].map(opt => (
                        <RadioOption
                          key={opt.value}
                          value={opt.value}
                          selected={answers.rentalFrequency === opt.value}
                          onSelect={() => setField("rentalFrequency", opt.value)}
                          label={t(`survey.step2.frequency.${opt.value}`)}
                          emoji={opt.emoji}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Your Needs */}
          {step === 3 && (
            <div>
              <SectionTitle
                icon={<MapPin className="w-5 h-5" />}
                title={t("survey.step3.title")}
                subtitle={t("survey.step3.subtitle")}
              />
              <div className="space-y-6">
                <div>
                  <QuestionLabel>{t("survey.step3.stayTypeLabel")}</QuestionLabel>
                  <div className="space-y-2">
                    {[
                      { value: "vacation", emoji: "🏖️" },
                      { value: "studies", emoji: "🎓" },
                      { value: "work", emoji: "💼" },
                      { value: "long-term", emoji: "🏡" },
                      { value: "other", emoji: "✨" },
                    ].map(opt => (
                      <RadioOption
                        key={opt.value}
                        value={opt.value}
                        selected={answers.stayType === opt.value}
                        onSelect={() => setField("stayType", opt.value)}
                        label={t(`survey.step3.stayType.${opt.value}`)}
                        emoji={opt.emoji}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <QuestionLabel>
                    {t("survey.step3.problemsLabel")}{" "}
                    <span className="text-muted-foreground font-normal">{t("survey.selectAll")}</span>
                  </QuestionLabel>
                  <div className="space-y-2">
                    {[
                      { value: "high-prices", emoji: "💸" },
                      { value: "lack-of-trust", emoji: "🔒" },
                      { value: "poor-quality", emoji: "😞" },
                      { value: "booking-difficulty", emoji: "📋" },
                      { value: "other", emoji: "➕" },
                    ].map(opt => (
                      <CheckboxOption
                        key={opt.value}
                        value={opt.value}
                        checked={answers.problems.includes(opt.value)}
                        onChange={() => toggleCheckbox("problems", opt.value)}
                        label={t(`survey.step3.problems.${opt.value}`)}
                        emoji={opt.emoji}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Priorities */}
          {step === 4 && (
            <div>
              <SectionTitle
                icon={<Star className="w-5 h-5" />}
                title={t("survey.step4.title")}
                subtitle={t("survey.step4.subtitle")}
              />
              <div className="space-y-6">
                <div>
                  <QuestionLabel>
                    {t("survey.step4.criteriaLabel")}{" "}
                    <span className="text-muted-foreground font-normal">{t("survey.selectAll")}</span>
                  </QuestionLabel>
                  <div className="space-y-2">
                    {[
                      { value: "price", emoji: "💰" },
                      { value: "location", emoji: "📍" },
                      { value: "safety", emoji: "🛡️" },
                      { value: "cleanliness", emoji: "✨" },
                      { value: "reviews", emoji: "⭐" },
                      { value: "ease-of-use", emoji: "📱" },
                    ].map(opt => (
                      <CheckboxOption
                        key={opt.value}
                        value={opt.value}
                        checked={answers.importantCriteria.includes(opt.value)}
                        onChange={() => toggleCheckbox("importantCriteria", opt.value)}
                        label={t(`survey.step4.criteria.${opt.value}`)}
                        emoji={opt.emoji}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <QuestionLabel>{t("survey.step4.interestedLabel")}</QuestionLabel>
                  <div className="space-y-2">
                    {[
                      { value: "yes", emoji: "🎉" },
                      { value: "maybe", emoji: "🤔" },
                      { value: "no", emoji: "😐" },
                    ].map(opt => (
                      <RadioOption
                        key={opt.value}
                        value={opt.value}
                        selected={answers.interestedInApp === opt.value}
                        onSelect={() => setField("interestedInApp", opt.value)}
                        label={t(`survey.step4.interested.${opt.value}`)}
                        emoji={opt.emoji}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: App Preferences */}
          {step === 5 && (
            <div>
              <SectionTitle
                icon={<CreditCard className="w-5 h-5" />}
                title={t("survey.step5.title")}
                subtitle={t("survey.step5.subtitle")}
              />
              <div className="space-y-6">
                <div>
                  <QuestionLabel>{t("survey.step5.paymentLabel")}</QuestionLabel>
                  <div className="space-y-2">
                    {[
                      { value: "online", emoji: "💳" },
                      { value: "cash", emoji: "💵" },
                      { value: "both", emoji: "🔄" },
                    ].map(opt => (
                      <RadioOption
                        key={opt.value}
                        value={opt.value}
                        selected={answers.preferredPayment === opt.value}
                        onSelect={() => setField("preferredPayment", opt.value)}
                        label={t(`survey.step5.payment.${opt.value}`)}
                        emoji={opt.emoji}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <QuestionLabel>
                    {t("survey.step5.wantToSeeLabel")}{" "}
                    <span className="text-muted-foreground font-normal">{t("survey.optional")}</span>
                  </QuestionLabel>
                  <textarea
                    value={answers.wantToSee}
                    onChange={e => setField("wantToSee", e.target.value)}
                    placeholder={t("survey.step5.wantToSeePlaceholder")}
                    rows={3}
                    maxLength={1000}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 text-sm resize-none"
                  />
                </div>
                <div>
                  <QuestionLabel>
                    {t("survey.step5.suggestionsLabel")}{" "}
                    <span className="text-muted-foreground font-normal">{t("survey.optional")}</span>
                  </QuestionLabel>
                  <textarea
                    value={answers.suggestions}
                    onChange={e => setField("suggestions", e.target.value)}
                    placeholder={t("survey.step5.suggestionsPlaceholder")}
                    rows={3}
                    maxLength={1000}
                    className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Contact */}
          {step === 6 && (
            <div>
              <SectionTitle
                icon={<Mail className="w-5 h-5" />}
                title={t("survey.step6.title")}
                subtitle={t("survey.step6.subtitle")}
              />
              <div>
                <QuestionLabel>
                  {t("survey.step6.emailLabel")} <span className="text-destructive">*</span>
                </QuestionLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="email"
                    value={answers.email}
                    onChange={e => setField("email", e.target.value)}
                    placeholder="you@example.com"
                    className={cn(
                      "w-full pl-10 pr-4 py-3 rounded-xl bg-background border-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 transition-all duration-200 text-sm",
                      answers.email && !isEmailValid(answers.email)
                        ? "border-destructive focus:border-destructive focus:ring-destructive/10"
                        : "border-border focus:border-primary focus:ring-primary/10",
                    )}
                  />
                </div>
                {answers.email && !isEmailValid(answers.email) && (
                  <p className="text-xs text-destructive mt-1.5">{t("survey.step6.emailError")}</p>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                  {t("survey.step6.emailHint")}
                </p>
              </div>

              <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">{t("survey.step6.almostDone")}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("survey.step6.reviewHint")}
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-border text-foreground font-semibold text-sm hover:border-primary/30 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t("survey.back")}
                </button>
              )}
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("survey.skip")}
              </button>
            </div>

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canGoNext()}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:-translate-y-0.5 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {t("survey.next")}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canGoNext() || isSubmitting}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold text-sm hover:-translate-y-0.5 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t("survey.submitting")}</>
                ) : (
                  <><Check className="w-4 h-4" /> {t("survey.submit")}</>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
