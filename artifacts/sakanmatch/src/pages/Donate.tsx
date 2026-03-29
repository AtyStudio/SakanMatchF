import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Heart, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const PRESET_AMOUNTS = [10, 20, 50, 100];

type DonationState = "idle" | "success" | "error";

export default function Donate() {
  const { t } = useTranslation();
  const [selectedAmount, setSelectedAmount] = useState<number>(20);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [donationState, setDonationState] = useState<DonationState>("idle");

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const effectiveAmount = customAmount ? parseFloat(customAmount) : selectedAmount;
  const isValidAmount = effectiveAmount > 0 && !isNaN(effectiveAmount);

  useEffect(() => {
    fetch(`${BASE}/api/donations/config`)
      .then((r) => r.json())
      .then((data: { clientId?: string }) => {
        if (data.clientId) setClientId(data.clientId);
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, [BASE]);

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomAmount(e.target.value);
    setSelectedAmount(0);
  };

  const handlePresetSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-grow flex items-start justify-center pt-16 pb-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-lg"
        >
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-display text-foreground mb-3">
              {t("donate.title")}
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              {t("donate.subtitle")}
            </p>
          </div>

          {donationState === "success" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-2xl p-10 text-center shadow-sm"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                <CheckCircle2 className="w-9 h-9 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">{t("donate.thankYou")}</h2>
              <p className="text-muted-foreground mb-6">
                {t("donate.thankYouDesc", { amount: effectiveAmount.toFixed(2) })}
              </p>
              <button
                onClick={() => {
                  setDonationState("idle");
                  setSelectedAmount(20);
                  setCustomAmount("");
                }}
                className="text-sm font-medium text-primary hover:underline"
              >
                {t("donate.donateAgain")}
              </button>
            </motion.div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-7">
              {/* Preset amounts */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  {t("donate.chooseAmount")}
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {PRESET_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handlePresetSelect(amount)}
                      className={`py-3 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                        selectedAmount === amount && !customAmount
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                          : "bg-background text-foreground border-border hover:border-primary hover:text-primary"
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom amount */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("donate.customAmount")}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder={t("donate.enterAmount")}
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                {customAmount && !isValidAmount && (
                  <p className="text-xs text-destructive mt-1.5">{t("donate.invalidAmount")}</p>
                )}
              </div>

              {/* Summary */}
              {isValidAmount && (
                <div className="flex items-center justify-between py-3 px-4 bg-primary/5 rounded-xl border border-primary/10">
                  <span className="text-sm text-muted-foreground">{t("donate.donationAmount")}</span>
                  <span className="text-lg font-bold text-primary">${effectiveAmount.toFixed(2)}</span>
                </div>
              )}

              {/* PayPal buttons */}
              <div>
                {configLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !clientId ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    {t("donate.paymentUnavailable")}
                  </div>
                ) : (
                  <PayPalScriptProvider
                    options={{
                      clientId,
                      currency: "USD",
                      intent: "capture",
                    }}
                  >
                    <PayPalButtons
                      style={{ layout: "vertical", shape: "rect", color: "gold", label: "donate" }}
                      disabled={!isValidAmount}
                      forceReRender={[effectiveAmount]}
                      createOrder={async () => {
                        const res = await fetch(`${BASE}/api/donations/create`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ amount: effectiveAmount }),
                        });
                        if (!res.ok) throw new Error("Failed to create order");
                        const data = (await res.json()) as { orderID: string };
                        return data.orderID;
                      }}
                      onApprove={async (_data, actions) => {
                        if (actions.order) {
                          await actions.order.capture();
                        }
                        setDonationState("success");
                      }}
                      onError={() => {
                        setDonationState("error");
                      }}
                    />
                  </PayPalScriptProvider>
                )}

                {donationState === "error" && (
                  <p className="text-xs text-destructive text-center mt-2">
                    {t("donate.paymentError")}
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {t("donate.paymentNote")}
              </p>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
