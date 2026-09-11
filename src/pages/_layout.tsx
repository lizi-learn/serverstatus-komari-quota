import { Outlet, useLocation } from "react-router-dom";
import type { CSSProperties } from "react";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";
import { LiveDataProvider } from "@/contexts/LiveDataContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import {
  ServerStatusSettingsProvider,
  useServerStatusSettings,
} from "@/theme-server-status/SettingsContext";
import Toolbox from "@/theme-server-status/Toolbox";
import "@/theme-server-status/server-status.css";

function LayoutContent() {
  const { publicInfo } = usePublicInfo();
  const { semiTransparent } = useServerStatusSettings();
  const settings = publicInfo?.theme_settings ?? {};
  const background =
    typeof settings.backgroundImageUrl === "string"
      ? settings.backgroundImageUrl.trim()
      : "";
  const backgroundStyle: CSSProperties | undefined = background
    ? {
        backgroundImage: `url(${background})`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
      }
    : undefined;

  return (
    <div
      className={`km-layout ss-theme ${semiTransparent ? "is-translucent" : ""}`}
      style={backgroundStyle}
    >
      <NavBar />
      <main className="km-main ss-main">
        <Outlet />
      </main>
      <Footer />
      <Toolbox />
    </div>
  );
}

export default function IndexLayout() {
  const { pathname } = useLocation();
  const isNetworkPage = pathname === "/network" || pathname === "/network/";
  const content = (
    <ServerStatusSettingsProvider>
      <LayoutContent />
    </ServerStatusSettingsProvider>
  );

  return isNetworkPage ? content : <LiveDataProvider>{content}</LiveDataProvider>;
}
