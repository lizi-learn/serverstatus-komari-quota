import { usePublicInfo } from "@/contexts/PublicInfoContext";

export default function Footer() {
  const { publicInfo } = usePublicInfo();

  return (
    <footer className="ss-footer km-footer">
      <p>
        {publicInfo?.sitename || "Komari"} | ServerStatus | Powered by{" "}
        <a href="https://github.com/komari-monitor/komari" target="_blank" rel="noreferrer">
          Komari Monitor
        </a>
        .
      </p>
    </footer>
  );
}
