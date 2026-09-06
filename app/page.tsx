"use client";
import type { Tab, VibeDuelVariant, VibeDuel, ItemType, ItemSource, ImportedItem, DbItem, ImportPlatform, ImportService } from "@/app/types";
import { apiFetch, getTgInitData, safeJson } from "@/app/apiFetch";
import { fireAnalytics } from "@/app/analytics";
import { useDeepVibe, useVibecheck } from "@/app/hooks/useVibecheck";
import { AdminTab } from "@/app/AdminTab";
import { formatShortDate, getItemDateValue, dayKey, addDays, startOfMonth } from "@/lib/dates";
import { useProfile } from "@/app/hooks/useProfile";
import { useLibrary } from "@/app/hooks/useLibrary";
import { useImports } from "@/app/hooks/useImports";
import { useAddForm } from "@/app/hooks/useAddForm";
import { useShareCard } from "@/app/hooks/useShareCard";
import { ShareModals } from "@/app/tabs/ShareModals";
import { HomeTab } from "@/app/tabs/HomeTab";
import { ProfileTab } from "@/app/tabs/ProfileTab";
import { AddTab } from "@/app/tabs/AddTab";
import { LibraryTab } from "@/app/tabs/LibraryTab";
import { VibeTab } from "@/app/tabs/VibeTab";
import { MarkdownText, VibeResult } from "@/app/tabs/VibeResult";
import { TYPE_LABELS, TYPE_ICONS, TYPE_COLORS } from "@/app/tabs/typeMeta";
import { generateShareCard } from "@/lib/shareCard";
import { openTelegramInvoice } from "@/lib/telegramInvoice";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { isAdminTgId } from "@/lib/admins";
import { parseImportedFile } from "@/apps/mobile/lib/fileImports";
import { generateMonthlySummary } from "@/lib/monthlySummaryEngine";

// Примеры плейсхолдеров — твой вкус

export default function Page() {
  const [tab, setTab] = useState<Tab>("profile");
  const [aboutStep, setAboutStep] = useState(0);
  const [libraryView, setLibraryView] = useState<"tiles" | "calendar">("calendar");
  const [helloName, setHelloName] = useState("привет!");
  const [tgUserId, setTgUserId] = useState<number | null>(null);
  const [adminViewOff, setAdminViewOff] = useState(false);
  const isAdmin = isAdminTgId(tgUserId) && !adminViewOff;

  useEffect(() => {
    try {
      setAdminViewOff(localStorage.getItem("everyyou:admin-view-off") === "1");
    } catch {}
  }, []);

  function toggleAdminView() {
    const next = !adminViewOff;
    setAdminViewOff(next);
    if (next && tab === "admin") setTab("home");
    try {
      localStorage.setItem("everyyou:admin-view-off", next ? "1" : "0");
    } catch {}
  }

  // Telegram Analytics SDK
  useEffect(() => {
    if (document.getElementById("tg-analytics-sdk")) return;
    const script = document.createElement("script");
    script.id = "tg-analytics-sdk";
    script.async = true;
    script.src = "https://tonsdk.io/sdk.js";
    script.setAttribute("data-telegram-analytics-token", process.env.NEXT_PUBLIC_TG_ANALYTICS_TOKEN || "");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    try { tg?.ready?.(); tg?.expand?.(); } catch {}
    const first = tg?.initDataUnsafe?.user?.first_name;
    const last = tg?.initDataUnsafe?.user?.last_name;
    const username = tg?.initDataUnsafe?.user?.username;
    const name = first || last
      ? [first, last].filter(Boolean).join(" ")
      : username ? `@${username}` : "";
    setHelloName(name ? `привет, ${name}` : "привет");
    const uid = tg?.initDataUnsafe?.user?.id;
    if (uid) setTgUserId(Number(uid));
  }, []);

  useEffect(() => {
    if (autoLinkHandledRef.current) return;
    const tg = (window as any).Telegram?.WebApp;
    const startParam = tg?.initDataUnsafe?.start_param;
    const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
    const fallbackParam = url?.searchParams.get("tgWebAppStartParam") ?? url?.searchParams.get("startapp") ?? "";
    const raw = `${startParam ?? fallbackParam}`.trim();
    const match = raw.match(/^link[_: -]?([A-Z0-9]+)$/i);
    if (!match?.[1]) return;

    autoLinkHandledRef.current = true;
    const code = match[1].toUpperCase();
    profile.setTelegramLinkCode(code);
    profile.setShowTelegramManualLink(true);
    profile.setTelegramLinkStatus("код из qr уже подставили");
    void profile.linkMobileAccount(code);
  }, []);

  useEffect(() => {
    if (!tgUserId) return;
    fireAnalytics("app_open", {
      librarySize: items.length,
      hasCustomName: Boolean(helloName.replace(/^привет,?\s*/i, "").trim()),
      themeMode: "light",
    });
  }, [tgUserId]);

  useEffect(() => {
    if (!tgUserId) return;
    fireAnalytics("screen_view", { screen: tab });
  }, [tab, tgUserId]);

  // ===== Library =====
  const [items, setItems] = useState<DbItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const autoLinkHandledRef = useRef(false);

  async function loadLibrary() {
    setLibraryLoading(true);
    setLibraryError("");
    try {
      const { res, json } = await apiFetch("/api/items");
      if (!res.ok) { setLibraryError(json?.error ?? "Ошибка загрузки"); setItems([]); return; }
      setItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e: any) {
      setLibraryError(e?.message ?? "Network error");
    } finally {
      setLibraryLoading(false);
    }
  }

  const vibe = useVibecheck();
  const deepVibe = useDeepVibe();
  const addForm = useAddForm({ items, loadLibrary });
  const share = useShareCard({ items, vibe });
  const imports = useImports({ items, loadLibrary, setTab });
  const library = useLibrary({ items, loadLibrary, setLibraryError, setLibraryLoading });
  const profile = useProfile({ loadLibrary, setLibraryError });

  useEffect(() => { loadLibrary(); addForm.loadCustomCategories(); deepVibe.fetchDeepVibeAccess(); imports.loadConnectedProfiles(); profile.loadProfileSettings(); }, []);

  const countsUnknown = libraryLoading && items.length === 0;
  const counts = useMemo(() => ({
    total: items.length,
    music: items.filter((i) => i.type === "music").length,
    books: items.filter((i) => i.type === "book").length,
    movies: items.filter((i) => i.type === "movie").length,
  }), [items]);

  const headerAvatar = useMemo(() => {
    const raw = helloName.replace(/^привет,?\s*/i, "").trim();
    if (!raw || raw === "привет!") return "◐";
    const first = raw[0];
    return first ? first.toUpperCase() : "◐";
  }, [helloName]);

  // ===== Import =====

  const importServices: ImportService[] = [
    { id: "spotify", title: "Spotify", subtitle: "музыка", icon: "◉", kind: "oauth", actionLabel: "подключить spotify" },
    {
      id: "livelib",
      title: "LiveLib",
      subtitle: "книги csv",
      icon: "▤",
      kind: "csv",
      actionLabel: "выбрать файл",
      instructions: [
        "нужен csv",
        "у livelib нет одного понятного официального экспорта для нас, поэтому сейчас нужен уже готовый csv",
        "подойдет выгрузка через livelib-backup или любой csv, где есть название и автор",
        "потом просто выбери этот файл из «файлов»",
      ],
    },
    {
      id: "goodreads",
      title: "Goodreads",
      subtitle: "книги csv",
      icon: "G",
      kind: "csv",
      actionLabel: "выбрать файл",
      instructions: [
        "нужен csv",
        "в goodreads открой my books → import and export",
        "нажми export library и потом загрузи сюда получившийся csv-файл",
      ],
    },
    {
      id: "letterboxd",
      title: "Letterboxd",
      subtitle: "public profile beta",
      icon: "◌",
      kind: "profile",
      actionLabel: "импортировать профиль",
      instructions: [
        "можно без csv",
        "вставь username или ссылку на публичный profile letterboxd",
        "мы попробуем забрать recent diary / watched через public rss",
        "если профиль закрыт или rss не поможет — всегда можно вернуться к watched.csv",
      ],
    },
    {
      id: "lastfm",
      title: "last.fm",
      subtitle: "recent tracks beta",
      icon: "♪",
      kind: "profile",
      actionLabel: "импортировать профиль",
      instructions: [
        "recent tracks beta",
        "введи username last.fm и мы попробуем забрать recent tracks через api",
        "если у треков есть scrobble time, они сразу лягут в календарь по дням",
        "если этот способ не сработает, всегда можно загрузить csv",
      ],
    },
    {
      id: "kinopoisk",
      title: "Кинопоиск",
      subtitle: "просмотры csv",
      icon: "★",
      kind: "csv",
      actionLabel: "выбрать файл",
      instructions: [
        "нужен csv",
        "если у тебя уже есть csv с просмотрами или оценками из кинопоиска, можно загрузить его сюда",
        "если в файле есть watched / isWatched / watched date, возьмем только просмотренное",
        "дальше просто выбери файл из «файлов»",
      ],
    },
    {
      id: "mubi",
      title: "MUBI",
      subtitle: "фильмы csv",
      icon: "●",
      kind: "csv",
      actionLabel: "выбрать файл",
      instructions: [
        "нужен csv",
        "если у тебя уже есть csv с просмотренными фильмами из mubi, можно загрузить его сюда",
        "лучше всего подходят колонки title или name, а еще year, director и дата просмотра, если она есть",
        "дальше просто выбери файл из «файлов»",
      ],
    },
  ];

  // ===== Custom Categories =====

  // ===== Manual Add =====

  // ===== Delete =====
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  async function deleteItem(id: string | number) {
    setDeletingId(id);
    try {
      const { res } = await apiFetch("/api/items", { method: "DELETE", body: JSON.stringify({ id }), });
      if (res.ok) setItems((prev) => prev.filter((it) => it.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  // ===== Vibe =====

  // Генерируем карточку по текущему состоянию приложения

  // Подписка на скриншот (Telegram WebApp API)
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;
    const handler = async () => {
      const dataUrl = await generateShareCard(items);
      share.setShareCardDataUrl(dataUrl);
      share.setShowShareCard(true);
    };
    // Telegram WebApp использует tg.onEvent напрямую
    if (typeof tg.onEvent === "function") {
      tg.onEvent("screenshot_taken", handler);
      return () => tg.offEvent("screenshot_taken", handler);
    }
  }, [items]);

  // Проверяем доступ при переходе на вкладку вайбчека
  const prevTabRef = useRef<string>("");
  useEffect(() => {
    if (tab === "vibe" && prevTabRef.current !== "vibe") {
      deepVibe.fetchDeepVibeAccess();
    }
    if (tab === "add" && prevTabRef.current !== "add") {
      imports.checkSpotify();
      imports.loadConnectedProfiles();
      if (deepVibe.deepVibeAccess === null) deepVibe.fetchDeepVibeAccess();
    }
    prevTabRef.current = tab;
  }, [tab]);

  // ===== Library filter =====

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <div className="app">
        <div className="header">
          <div className="header-row">
            <div className="header-avatar">{profile.profileAvatarUrl ? <img src={profile.profileAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }} /> : headerAvatar}</div>
            <div className="header-copy">
              <button className="brand-link" onClick={() => { setAboutStep(0); setTab("home"); }}>
                everyyou
              </button>
            </div>
          </div>
          <div className="sync-line">культурный таймлайн, который собирается сам.</div>
        </div>

        {/* ABOUT / ONBOARDING */}
        {tab === "home" && <HomeTab tab={tab} setTab={setTab} aboutStep={aboutStep} setAboutStep={setAboutStep} />}

        {tab === "profile" && <ProfileTab tab={tab} tgUserId={tgUserId} counts={counts} countsUnknown={countsUnknown} headerAvatar={headerAvatar} adminViewOff={adminViewOff} toggleAdminView={toggleAdminView} importServices={importServices} setTab={setTab} imports={imports} profile={profile} />}

        {/* ADD */}
        {tab === "add" && <AddTab tab={tab} importServices={importServices} imports={imports} deepVibe={deepVibe} addForm={addForm} />}

        {/* LIBRARY */}
        {tab === "library" && <LibraryTab tab={tab} items={items} libraryLoading={libraryLoading} libraryError={libraryError} libraryView={libraryView} setLibraryView={setLibraryView} setTab={setTab} customCategories={addForm.customCategories} deletingId={deletingId} deleteItem={deleteItem} library={library} />}

        {/* VIBE */}
        {tab === "vibe" && <VibeTab tab={tab} counts={counts} countsUnknown={countsUnknown} shareVibeCard={share.shareVibeCard} vibe={vibe} deepVibe={deepVibe} />}

        {imports.selectedImportService && (
          <div className="service-modal-backdrop" onClick={() => imports.setSelectedImportService(null)}>
            <div className="service-modal" onClick={(e) => e.stopPropagation()}>
              <div className="service-modal-top">
                <div className="service-modal-title">{imports.selectedImportService.title}</div>
                <button className="btn btn-outline btn-sm" onClick={() => imports.setSelectedImportService(null)}>
                  закрыть
                </button>
              </div>

              {imports.selectedImportService.instructions && (
                <div className="service-modal-copy">
                  <ul>
                    {imports.selectedImportService.instructions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              {imports.selectedImportService.id === "lastfm" && (
                <div className="input-group" style={{ marginTop: 12 }}>
                  {imports.connectedProfiles.lastfm ? (
                    <div style={{ marginBottom: 10, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                      last.fm подключен: {imports.connectedProfiles.lastfm.profile}
                    </div>
                  ) : null}
                  <div className="input-label">username last.fm</div>
                  <input
                    className="input"
                    placeholder="например: nastyad"
                    value={imports.lastfmProfileInput}
                    onChange={(e) => imports.setLastfmProfileInput(e.target.value)}
                  />
                  <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                    импортируем recent tracks из публичного профиля last.fm
                  </div>
                  {imports.importLoading ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                      {imports.importStatus || "смотрим профиль..."}
                    </div>
                  ) : null}
                  {imports.connectedProfiles.lastfm ? (
                    <button
                      className="btn btn-outline"
                      style={{ marginTop: 12 }}
                      onClick={() => imports.disconnectConnectedProfile("lastfm", false)}
                      disabled={imports.importLoading}
                    >
                      отвязать last.fm
                    </button>
                  ) : null}
                </div>
              )}

              {imports.selectedImportService.id === "letterboxd" && (
                <div className="input-group" style={{ marginTop: 12 }}>
                  {imports.connectedProfiles.letterboxd ? (
                    <div style={{ marginBottom: 10, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                      letterboxd подключен: {imports.connectedProfiles.letterboxd.profile}
                    </div>
                  ) : null}
                  <div className="input-label">username или ссылка на profile</div>
                  <input
                    className="input"
                    placeholder="например: letterboxd.com/nastyad/"
                    value={imports.letterboxdProfileInput}
                    onChange={(e) => imports.setLetterboxdProfileInput(e.target.value)}
                  />
                  <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                    public profile beta: лучше всего работает с открытым профилем
                  </div>
                  {imports.importLoading ? (
                    <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                      {imports.importStatus || "смотрим профиль..."}
                    </div>
                  ) : null}
                  {imports.connectedProfiles.letterboxd ? (
                    <>
                      <button
                        className="btn btn-outline"
                        style={{ marginTop: 12 }}
                        onClick={() => imports.disconnectConnectedProfile("letterboxd", false)}
                        disabled={imports.importLoading}
                      >
                        отвязать letterboxd
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ marginTop: 12 }}
                        onClick={() => imports.disconnectConnectedProfile("letterboxd", true)}
                        disabled={imports.importLoading}
                      >
                        отвязать и убрать импорт
                      </button>
                    </>
                  ) : null}
                </div>
              )}

              {imports.selectedImportService.id === "lastfm" ? (
                <>
                  <button
                    className="btn"
                    style={{ marginTop: 16 }}
                    onClick={() => void imports.importProfileWeb("lastfm")}
                    disabled={imports.importLoading}
                  >
                    импортировать профиль
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ marginTop: 12 }}
                    onClick={imports.confirmCsvImport}
                    disabled={imports.importLoading}
                  >
                    или выбрать csv
                  </button>
                </>
              ) : imports.selectedImportService.id === "letterboxd" ? (
                <>
                  <button
                    className="btn"
                    style={{ marginTop: 16 }}
                    onClick={() => void imports.importProfileWeb("letterboxd")}
                    disabled={imports.importLoading}
                  >
                    импортировать профиль
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ marginTop: 12 }}
                    onClick={imports.confirmCsvImport}
                    disabled={imports.importLoading}
                  >
                    или выбрать csv
                  </button>
                </>
              ) : (
                <button
                  className="btn"
                  style={{ marginTop: 16 }}
                  onClick={imports.confirmCsvImport}
                  disabled={imports.importLoading}
                >
                  {imports.selectedImportService.actionLabel ?? "выбрать файл"}
                </button>
              )}

              {imports.selectedImportService.id === "spotify" && imports.spotifyConnected ? (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
                    spotify подключен{imports.spotifyProfileName ? `: ${imports.spotifyProfileName}` : ""}
                  </div>
                  <button className="btn btn-outline" onClick={() => imports.disconnectSpotify(false)} disabled={imports.spotifySyncing}>
                    отвязать spotify
                  </button>
                  <button className="btn btn-outline" onClick={() => imports.disconnectSpotify(true)} disabled={imports.spotifySyncing}>
                    отвязать и убрать импорт
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className={`nav${isAdmin ? " admin-nav" : ""}`}>
        {([
          ["profile", "◉", "профиль"],
          ["library", "▦", "библиотека"],
        ] as [Tab, string, string][]).map(([t, icon, label]) => (
          <button
            key={t}
            className={`nav-btn${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </button>
        ))}
        <button
          className={`nav-btn add-btn${tab === "add" ? " active" : ""}`}
          onClick={() => setTab("add")}
        >
          <span className="nav-icon">+</span>
          <span className="nav-label-spacer" aria-hidden="true">добавить</span>
        </button>
        <button
          className={`nav-btn vibe-nav${tab === "vibe" ? " active" : ""}`}
          onClick={() => setTab("vibe")}

        >
          <span className="nav-icon" style={{display:"flex",alignItems:"center"}}><img src="data:image/png;base64,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" width="24" height="24" style={{imageRendering:"auto"}}/></span>
          вайбчек
        </button>
        {isAdmin && (
          <button
            className={`nav-btn${tab === "admin" ? " active" : ""}`}
            onClick={() => setTab("admin")}
          >
            <span className="nav-icon">📊</span>
            стата
          </button>
        )}
      </nav>
      {tab === "admin" && isAdmin && <AdminTab />}

      {/* Share Picker Modal — выбор контента */}
      <ShareModals share={share} items={items} fireAnalytics={fireAnalytics} shareRunId={vibe.shareRunId} />

    </>
  );
}

