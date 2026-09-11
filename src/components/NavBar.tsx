import { useEffect, useState } from "react";
import { Home, LogIn, Menu, Network, Settings, UserRound, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AccountProvider, useAccount } from "@/contexts/AccountContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import LoginDialog from "./Login";

function Navigation() {
  const { pathname } = useLocation();
  const { i18n } = useTranslation();
  const { publicInfo } = usePublicInfo();
  const { account, loading } = useAccount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const chinese = i18n.resolvedLanguage?.toLowerCase().startsWith("zh") ?? false;
  const navItems = [
    { to: "/", label: chinese ? "首页" : "Home", icon: Home },
    { to: "/network", label: chinese ? "网络" : "Network", icon: Network },
  ];

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  const isActive = (path: string) =>
    path === "/"
      ? pathname === "/" || pathname.startsWith("/instance/")
      : pathname === path;

  return (
    <header className="ss-navbar km-navbar">
      <div className="ss-navbar-inner">
        <Link className="ss-brand" to="/" aria-label={publicInfo?.sitename || "Komari"}>
          <img
            src="/favicon.ico"
            alt=""
            onError={(event) => {
              if (event.currentTarget.dataset.fallback === "1") return;
              event.currentTarget.dataset.fallback = "1";
              event.currentTarget.src = "/assets/logo.png";
            }}
          />
          <span>{publicInfo?.sitename || "Komari"}</span>
        </Link>

        <button
          type="button"
          className="ss-mobile-toggle"
          aria-label={chinese ? "切换导航" : "Toggle navigation"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>

        <nav className={`ss-nav-links ${mobileOpen ? "is-open" : ""}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={active ? "is-active" : ""}
                aria-current={active ? "page" : undefined}
              >
                <Icon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ss-account">
          {loading ? (
            <span className="ss-account-loading" aria-hidden="true" />
          ) : account?.logged_in ? (
            <div className="ss-account-menu">
              <button type="button" onClick={() => setAccountOpen((open) => !open)}>
                <UserRound />
                <span>{account.username}</span>
                <span className="ss-caret" />
              </button>
              {accountOpen && (
                <div className="ss-account-dropdown">
                  <a href="/admin/dashboard"><Settings />{chinese ? "管理面板" : "Admin panel"}</a>
                  <a href="/api/logout"><LogIn />{chinese ? "退出" : "Logout"}</a>
                </div>
              )}
            </div>
          ) : (
            <LoginDialog
              autoOpen={Boolean(
                publicInfo?.private_site && !document.cookie.includes("temp_key"),
              )}
              info={
                publicInfo?.private_site
                  ? chinese
                    ? "这是一个私有站点"
                    : "This is a private site"
                  : undefined
              }
              onLoginSuccess={() => window.location.reload()}
              trigger={
                <span className="ss-login-link">
                  <LogIn />
                  {chinese ? "登录" : "Login"}
                </span>
              }
            />
          )}
        </div>
      </div>
    </header>
  );
}

export default function NavBar() {
  return (
    <AccountProvider>
      <Navigation />
    </AccountProvider>
  );
}
