import type { Tab } from "@/app/types";
import { VIBE_ICON } from "@/app/tabs/vibeIcon";

const MAIN_TABS: [Tab, string, string][] = [
  ["profile", "◉", "профиль"],
  ["library", "▦", "библиотека"],
];

export function BottomNav({ tab, setTab, isAdmin }: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  isAdmin: boolean;
}) {
  return (
    <nav className={`nav${isAdmin ? " admin-nav" : ""}`}>
      {MAIN_TABS.map(([key, icon, label]) => (
        <button key={key} className={`nav-btn${tab === key ? " active" : ""}`} onClick={() => setTab(key)}>
          <span className="nav-icon">{icon}</span>
          {label}
        </button>
      ))}
      <button className={`nav-btn add-btn${tab === "add" ? " active" : ""}`} onClick={() => setTab("add")}>
        <span className="nav-icon">+</span>
        <span className="nav-label-spacer" aria-hidden="true">добавить</span>
      </button>
      <button className={`nav-btn vibe-nav${tab === "vibe" ? " active" : ""}`} onClick={() => setTab("vibe")}>
        <span className="nav-icon" style={{ display: "flex", alignItems: "center" }}>
          <img src={VIBE_ICON} width="24" height="24" style={{ imageRendering: "auto" }} alt="" />
        </span>
        вайбчек
      </button>
      {isAdmin && (
        <button className={`nav-btn${tab === "admin" ? " active" : ""}`} onClick={() => setTab("admin")}>
          <span className="nav-icon">📊</span>
          стата
        </button>
      )}
    </nav>
  );
}
