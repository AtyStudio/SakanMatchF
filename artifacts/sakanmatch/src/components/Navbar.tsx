import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { LogOut, PlusCircle, Crown, Sun, Moon, Menu, X, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      onClick={() => setMobileOpen(false)}
      className={cn(
        "text-sm font-medium transition-colors hover:text-primary",
        location === href ? "text-primary" : "text-muted-foreground"
      )}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-xl bg-background/80 border-b border-border/50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-18 py-4">
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105">
              <img 
                src={`${import.meta.env.BASE_URL}images/logo.png`} 
                alt="SakanMatch Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-foreground">
              Sakan<span className="text-primary">Match</span>
            </span>
          </Link>

          {/* Nav Links - Desktop */}
          <div className="hidden md:flex items-center gap-6">
            {navLink("/", t("nav.browse"))}
            <Link
              href="/donate"
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary",
                location === "/donate" ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Heart className="w-3.5 h-3.5" />
              {t("nav.donate")}
            </Link>
            
            {user && navLink("/dashboard", t("nav.dashboard"))}
            
            {user?.role === "seeker" && (
              <>
                {navLink("/people", t("nav.people"))}
                {navLink("/favorites", t("nav.favorites"))}
                {navLink("/messages", t("nav.messages"))}
              </>
            )}
            
            {user?.role === "owner" && (
              <>
                {navLink("/messages", t("nav.messages"))}
                <Link 
                  href="/premium" 
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-all duration-300",
                    user.isPremium 
                      ? "bg-gradient-to-r from-amber-200 to-yellow-400 text-yellow-900 shadow-sm"
                      : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  <Crown className="w-4 h-4" />
                  {user.isPremium ? t("nav.premium") : t("nav.upgrade")}
                </Link>
              </>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors duration-200"
              title={theme === "light" ? t("nav.switchToDark") : t("nav.switchToLight")}
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {user ? (
              <div className="hidden md:flex items-center gap-3">
                {user.role === "owner" && (
                  <Link 
                    href="/listings/new" 
                    className="hidden sm:flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-4 py-2.5 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <PlusCircle className="w-4 h-4" />
                    {t("nav.listRoom")}
                  </Link>
                )}
                <button 
                  onClick={logout}
                  className="p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors duration-200"
                  title={t("nav.logout")}
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Link 
                  href="/login" 
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors px-4 py-2"
                >
                  {t("nav.login")}
                </Link>
                <Link 
                  href="/signup" 
                  className="text-sm font-medium bg-foreground text-background px-5 py-2.5 rounded-xl hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  {t("nav.signup")}
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2.5 text-muted-foreground hover:text-foreground rounded-xl transition-colors"
              onClick={() => setMobileOpen(o => !o)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border/50 py-4 space-y-3 pb-6">
            {navLink("/", t("nav.browseListings"))}
            <Link
              href="/donate"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                location === "/donate" ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Heart className="w-4 h-4" />
              {t("nav.donate")}
            </Link>
            {user && navLink("/dashboard", t("nav.dashboard"))}
            {user?.role === "seeker" && (
              <>
                {navLink("/people", t("nav.peopleMatches"))}
                {navLink("/profile", t("nav.myProfile"))}
                {navLink("/favorites", t("nav.myFavorites"))}
                {navLink("/profile/preferences", t("nav.preferences"))}
                {navLink("/messages", t("nav.messages"))}
              </>
            )}
            {user?.role === "owner" && (
              <>
                {navLink("/listings/new", t("nav.listARoom"))}
                {navLink("/messages", t("nav.messages"))}
                {navLink("/premium", t("nav.premium"))}
              </>
            )}
            {!user && (
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <Link href="/login" onClick={() => setMobileOpen(false)} className="text-sm font-medium text-foreground hover:text-primary px-1 py-2">{t("nav.login")}</Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)} className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-center">{t("nav.signup")}</Link>
              </div>
            )}
            {user && (
              <div className="pt-2 border-t border-border">
                <button onClick={() => { logout(); setMobileOpen(false); }} className="flex items-center gap-2 text-sm text-destructive font-medium">
                  <LogOut className="w-4 h-4" /> {t("nav.logout")}
                </button>
              </div>
            )}
            <div className="pt-2 border-t border-border">
              <LanguageSwitcher />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
