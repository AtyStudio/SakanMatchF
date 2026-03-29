import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useSignup, SignupRequestRole } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, Home, Search } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<SignupRequestRole>(SignupRequestRole.seeker);

  const { login, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) setLocation("/dashboard");
  }, [user, setLocation]);

  const signupMutation = useSignup({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        toast({ title: t("auth.signupSuccess"), description: t("auth.signupSuccessDesc") });
        setLocation("/dashboard");
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: t("auth.signupFailed"),
          description: err.message || t("auth.signupError")
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signupMutation.mutate({ data: { email, password, name: name || undefined, role } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden py-12">
      <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-accent/20 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-card/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-black/5 border border-border/50 relative z-10"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden mx-auto">
              <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-full h-full object-cover" />
            </div>
          </Link>
          <h1 className="text-3xl font-display font-bold text-foreground">{t("auth.createAccount")}</h1>
          <p className="text-muted-foreground mt-2">{t("auth.joinToday")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">{t("auth.lookingTo")}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole(SignupRequestRole.seeker)}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                  role === SignupRequestRole.seeker
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                )}
              >
                <Search className="w-6 h-6" />
                <span className="text-sm font-semibold">{t("auth.findARoom")}</span>
              </button>

              <button
                type="button"
                onClick={() => setRole(SignupRequestRole.owner)}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                  role === SignupRequestRole.owner
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                )}
              >
                <Home className="w-6 h-6" />
                <span className="text-sm font-semibold">{t("auth.listARoom")}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.fullNameOptional")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200"
              placeholder={t("auth.yourFullName")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.email")}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200"
              placeholder={t("auth.emailPlaceholder")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.password")}</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200"
              placeholder={t("auth.passwordMin")}
            />
          </div>

          <button
            type="submit"
            disabled={signupMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-3.5 rounded-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-4"
          >
            {signupMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : t("auth.createAccountBtn")}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-muted-foreground">
          {t("auth.alreadyAccount")}{" "}
          <Link href="/login" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
            {t("auth.logIn")} <ArrowRight className="w-3 h-3" />
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
