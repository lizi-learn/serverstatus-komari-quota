import { useContext, useEffect, useState } from "react";
import { ArrowUp, Droplets, Layers3, Moon, MoreHorizontal, Rows3, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import { ThemeContext } from "@/contexts/ThemeContext";
import { useServerStatusSettings } from "./SettingsContext";

export default function Toolbox() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { grouped, setGrouped, semiTransparent, setSemiTransparent } =
    useServerStatusSettings();
  const { appearance, setAppearance } = useContext(ThemeContext);
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const [showBackToTop, setShowBackToTop] = useState(() => window.scrollY > 200);
  const canGroup = pathname === "/";

  useEffect(() => {
    const syncScroll = () => setShowBackToTop(window.scrollY > 200);
    const syncTheme = () => setDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("scroll", syncScroll, { passive: true });
    syncScroll();
    syncTheme();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", syncScroll);
    };
  }, []);

  return (
    <aside className="ss-toolbox" aria-label="ServerStatus tools">
      {open && canGroup && (
        <button
          type="button"
          title={grouped ? "Show one table" : "Group tables"}
          onClick={() => setGrouped((current) => !current)}
        >
          {grouped ? <Rows3 /> : <Layers3 />}
        </button>
      )}
      {open && (
        <button
          type="button"
          title="Toggle panel transparency"
          className={semiTransparent ? "is-active" : ""}
          onClick={() => setSemiTransparent((current) => !current)}
        >
          <Droplets />
        </button>
      )}
      <button type="button" title="More tools" onClick={() => setOpen((value) => !value)}>
        <MoreHorizontal />
      </button>
      <button
        type="button"
        title={dark ? "Light mode" : "Dark mode"}
        onClick={() => setAppearance(dark ? "light" : "dark")}
        data-appearance={appearance}
      >
        {dark ? <Sun /> : <Moon />}
      </button>
      {open && showBackToTop && (
        <button type="button" title="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <ArrowUp />
        </button>
      )}
    </aside>
  );
}
