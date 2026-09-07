"use client";
import type { LibraryView, Tab, VibeDuelVariant, VibeDuel, ItemType, ItemSource, ImportedItem, DbItem, ImportPlatform, ImportService } from "@/app/types";
import { apiFetch, getTgInitData, safeJson } from "@/app/apiFetch";
import { fireAnalytics } from "@/app/analytics";
import { useDeepVibe, useVibecheck } from "@/app/hooks/useVibecheck";
import { AdminTab } from "@/app/AdminTab";
import { formatShortDate, getItemDateValue, dayKey, addDays, startOfMonth } from "@/lib/dates";
import { useProfile } from "@/app/hooks/useProfile";
import { useAdminView, useAppAnalytics, useTelegramUser } from "@/app/hooks/useTelegramUser";
import { useItems } from "@/app/hooks/useItems";
import { useTabEntry } from "@/app/hooks/useTabEntry";
import { useLibrary } from "@/app/hooks/useLibrary";
import { useImports } from "@/app/hooks/useImports";
import { useAddForm } from "@/app/hooks/useAddForm";
import { useShareCard } from "@/app/hooks/useShareCard";
import { ShareModals } from "@/app/tabs/ShareModals";
import { ImportServiceModal } from "@/app/tabs/ImportServiceModal";
import { BottomNav } from "@/app/tabs/BottomNav";
import { IMPORT_SERVICES as importServices } from "@/app/importServices";
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
import { parseImportedFile } from "@/lib/fileImports";
import { generateMonthlySummary } from "@/lib/monthlySummaryEngine";

// Примеры плейсхолдеров — твой вкус

export default function Page() {
  const [tab, setTab] = useState<Tab>("profile");
  const [aboutStep, setAboutStep] = useState(0);
  const [libraryView, setLibraryView] = useState<LibraryView>("calendar");
  const { items, setItems, libraryLoading, libraryError, setLibraryError, setLibraryLoading, loadLibrary, counts, countsUnknown } = useItems();
  const vibe = useVibecheck();
  const deepVibe = useDeepVibe();
  const addForm = useAddForm({ items, loadLibrary });
  const share = useShareCard({ items, vibe });
  const imports = useImports({ items, loadLibrary, setTab });
  const library = useLibrary({ items, setItems, loadLibrary, setLibraryError, setLibraryLoading });
  const profile = useProfile({ loadLibrary, setLibraryError });
  const { helloName, tgUserId, headerAvatar } = useTelegramUser((code) => {
    profile.setTelegramLinkCode(code);
    profile.setShowTelegramManualLink(true);
    profile.setTelegramLinkStatus("код из qr уже подставили");
    void profile.linkMobileAccount(code);
  });
  const { adminViewOff, toggleAdminView } = useAdminView(tab, setTab);
  const isAdmin = isAdminTgId(tgUserId) && !adminViewOff;

  useAppAnalytics(tab, tgUserId, {
    librarySize: items.length,
    hasCustomName: Boolean(helloName.replace(/^привет,?\s*/i, "").trim()),
    themeMode: "light",
  });

  useEffect(() => { loadLibrary(); addForm.loadCustomCategories(); deepVibe.fetchDeepVibeAccess(); imports.loadConnectedProfiles(); profile.loadProfileSettings(); }, []);



  // Генерируем карточку по текущему состоянию приложения

  // Подписка на скриншот (Telegram WebApp API)
  // Проверяем доступ при переходе на вкладку вайбчека
  useTabEntry(tab, { vibe: () => deepVibe.fetchDeepVibeAccess(), add: () => {
    imports.checkSpotify();
    imports.loadConnectedProfiles();
    if (deepVibe.deepVibeAccess === null) deepVibe.fetchDeepVibeAccess();
  } });

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
        {tab === "library" && <LibraryTab tab={tab} items={items} libraryLoading={libraryLoading} libraryError={libraryError} libraryView={libraryView} setLibraryView={setLibraryView} setTab={setTab} customCategories={addForm.customCategories} deletingId={library.deletingId} deleteItem={library.deleteItem} library={library} />}

        {/* VIBE */}
        {tab === "vibe" && <VibeTab tab={tab} counts={counts} countsUnknown={countsUnknown} shareVibeCard={share.shareVibeCard} vibe={vibe} deepVibe={deepVibe} />}

        <ImportServiceModal imports={imports} />
      </div>

      {/* Bottom Nav */}
      <BottomNav tab={tab} setTab={setTab} isAdmin={isAdmin} />
      {tab === "admin" && isAdmin && <AdminTab />}

      {/* Share Picker Modal — выбор контента */}
      <ShareModals share={share} items={items} fireAnalytics={fireAnalytics} shareRunId={vibe.shareRunId} />

    </>
  );
}

