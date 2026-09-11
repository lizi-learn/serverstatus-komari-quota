import React, { lazy, StrictMode, Suspense, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./global.css";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import {
  ThemeContext,
  THEME_DEFAULTS,
  type Appearance,
  type Colors,
} from "./contexts/ThemeContext";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useSystemTheme } from "./hooks/useSystemTheme";
import { BrowserRouter } from "react-router-dom";
// Ensure i18n is initialized before any component renders
import "./i18n/config";
import ErrorBoundary from "./components/ErrorBoundary";
import { useRoutes } from "react-router-dom";
import { routes } from "./routes";
import Loading from "./components/loading";
import { PublicInfoProvider } from "./contexts/PublicInfoContext";
import { PublicDataProviders } from "./contexts/PublicDataProviders";
import { clearLegacyThemeCache } from "./utils/clearLegacyThemeCache";

const Toaster = lazy(() =>
  import("./components/ui/sonner").then(({ Toaster: Component }) => ({
    default: Component,
  })),
);

function consumeTemporaryAccessKey() {
  const params = new URLSearchParams(window.location.search);
  const tempKey = params.get("temp_key");
  const hadRecoveryParam = params.has("__ss_reload");
  params.delete("__ss_reload");
  if (!tempKey && !hadRecoveryParam) return;

  if (tempKey) {
    document.cookie = `temp_key=${tempKey}; path=/; max-age=${60 * 60 * 24 * 365 * 100}`;
    params.delete("temp_key");
  }
  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`,
  );
}

const App = () => {
  const restrictedPath = window.location.pathname.replace(/\/$/, "");
  const isRestrictedGuideRoute = [
    "/admin/database-migration",
    "/install",
    "/database-recovery",
  ].includes(restrictedPath);
  const isPublicMonitorRoute =
    restrictedPath === "" ||
    restrictedPath === "/network" ||
    restrictedPath.startsWith("/instance/");
  const [appearance, setAppearance] = useLocalStorage<Appearance>(
    "appearance",
    THEME_DEFAULTS.appearance,
  );
  const [color, setColor] = useLocalStorage<Colors>(
    "color",
    THEME_DEFAULTS.color,
  );

  // Use the system theme hook to resolve "system" to actual theme
  const resolvedAppearance = useSystemTheme(appearance);

  React.useEffect(() => {
    const isDark = resolvedAppearance === "dark";
    document.documentElement.classList.toggle("dark", isDark);
  }, [resolvedAppearance]);

  const themeContextValue = useMemo(
    () => ({
      appearance,
      setAppearance,
      color,
      setColor,
    }),
    [appearance, setAppearance, color, setColor],
  );
  const routing = useRoutes(routes);
  return (
    <Suspense fallback={<Loading />}>
      <ThemeContext.Provider value={themeContextValue}>
        <Theme
          appearance={resolvedAppearance}
          accentColor={color}
          scaling="110%"
          className="theme-root"
          style={{
            backgroundColor: "transparent",
            minHeight: "100vh",
          }}
        >
          {isRestrictedGuideRoute ? (
            <>
              <Toaster />
              {routing}
            </>
          ) : (
            <PublicInfoProvider>
              <PublicDataProviders>
                {!isPublicMonitorRoute && <Toaster />}
                {routing}
              </PublicDataProviders>
            </PublicInfoProvider>
          )}
        </Theme>
      </ThemeContext.Provider>
    </Suspense>
  );
};

async function bootstrap() {
  await clearLegacyThemeCache();
  consumeTemporaryAccessKey();

  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>
    </ErrorBoundary>,
  );
}

void bootstrap();
