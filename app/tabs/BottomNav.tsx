import type { Tab } from "@/app/types";

type NavItem = { key: Exclude<Tab, "add">; label: string; icon: string; modifier?: string };

const NAV_ITEMS: NavItem[] = [
  { key: "profile", label: "профиль", icon: "◉" },
  { key: "library", label: "библиотека", icon: "▦" },
  { key: "vibe", label: "вайбчек", icon: "👀", modifier: "vibe-nav" },
  { key: "admin", label: "стата", icon: "📊" },
];

export function BottomNav({ tab, setTab, isAdmin }: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  isAdmin: boolean;
}) {
  return (
    <nav className={`nav${isAdmin ? " admin-nav" : ""}`}>
      {NAV_ITEMS.filter((item) => item.key !== "admin" || isAdmin).map((item) => (
        <button
          key={item.key}
          className={`nav-btn${item.modifier ? ` ${item.modifier}` : ""}${tab === item.key ? " active" : ""}`}
          onClick={() => setTab(item.key)}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
      <button className={`nav-btn add-btn${tab === "add" ? " active" : ""}`} onClick={() => setTab("add")}>
        <span className="nav-icon">+</span>
        <span className="nav-label-spacer" aria-hidden="true">добавить</span>
      </button>
    </nav>
  );
}
