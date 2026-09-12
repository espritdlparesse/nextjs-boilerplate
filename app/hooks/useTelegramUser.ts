import { useEffect, useRef, useSyncExternalStore } from "react";
import { fireAnalytics } from "@/app/analytics";
import { avatarEmojiFor } from "@/lib/avatarEmojis";
import { telegramWebApp } from "@/lib/telegramWebApp";
import type { Tab } from "@/app/types";

const ANALYTICS_SDK_ID = "tg-analytics-sdk";
const ADMIN_VIEW_OFF_KEY = "everyyou:admin-view-off";

function readHelloName() {
  const user = telegramWebApp()?.initDataUnsafe?.user;
  const named = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  const name = named || (user?.username ? `@${user.username}` : "");
  return name ? `привет, ${name}` : "привет";
}

function readUserId() {
  const id = telegramWebApp()?.initDataUnsafe?.user?.id;
  return id ? Number(id) : null;
}

function readLinkCode() {
  const startParam = telegramWebApp()?.initDataUnsafe?.start_param;
  const url = typeof window === "undefined" ? null : new URL(window.location.href);
  const fallback = url?.searchParams.get("tgWebAppStartParam") ?? url?.searchParams.get("startapp") ?? "";
  const match = `${startParam ?? fallback}`.trim().match(/^link[_: -]?([A-Z0-9]+)$/i);
  return match?.[1]?.toUpperCase() ?? null;
}

// Telegram отдаёт initDataUnsafe один раз за загрузку страницы, поэтому снимок
// кэшируется: useSyncExternalStore требует ссылочно стабильный результат.
const SERVER_IDENTITY = { helloName: "привет!", tgUserId: null as number | null };
let clientIdentity: typeof SERVER_IDENTITY | null = null;

function readIdentity() {
  if (!clientIdentity) clientIdentity = { helloName: readHelloName(), tgUserId: readUserId() };
  return clientIdentity;
}

function neverChanges() {
  return () => undefined;
}

let adminViewOff: boolean | null = null;
const adminViewListeners = new Set<() => void>();

function readAdminViewOff() {
  if (adminViewOff === null) {
    try {
      adminViewOff = localStorage.getItem(ADMIN_VIEW_OFF_KEY) === "1";
    } catch {
      adminViewOff = false;
    }
  }
  return adminViewOff;
}

function writeAdminViewOff(next: boolean) {
  adminViewOff = next;
  try {
    localStorage.setItem(ADMIN_VIEW_OFF_KEY, next ? "1" : "0");
  } catch {}
  for (const listener of adminViewListeners) listener();
}

function subscribeAdminViewOff(listener: () => void) {
  adminViewListeners.add(listener);
  return () => {
    adminViewListeners.delete(listener);
  };
}

function useAnalyticsSdk() {
  useEffect(() => {
    if (document.getElementById(ANALYTICS_SDK_ID)) return;
    const script = document.createElement("script");
    script.id = ANALYTICS_SDK_ID;
    script.async = true;
    script.src = "https://tonsdk.io/sdk.js";
    script.setAttribute("data-telegram-analytics-token", process.env.NEXT_PUBLIC_TG_ANALYTICS_TOKEN || "");
    document.head.appendChild(script);
  }, []);
}

export function useTelegramUser(onLinkCode: (code: string) => void) {
  const { helloName, tgUserId } = useSyncExternalStore(neverChanges, readIdentity, () => SERVER_IDENTITY);
  const linkHandledRef = useRef(false);
  const onLinkCodeRef = useRef(onLinkCode);

  useAnalyticsSdk();

  useEffect(() => {
    onLinkCodeRef.current = onLinkCode;
  });

  useEffect(() => {
    const tg = telegramWebApp();
    tg?.ready?.();
    tg?.expand?.();
  }, []);

  useEffect(() => {
    if (linkHandledRef.current) return;
    const code = readLinkCode();
    if (!code) return;
    linkHandledRef.current = true;
    onLinkCodeRef.current(code);
  }, []);

  const headerAvatar = avatarEmojiFor(tgUserId ? `tg:${tgUserId}` : null);

  return { helloName, tgUserId, headerAvatar };
}

export function useAdminView(tab: Tab, setTab: (tab: Tab) => void) {
  const adminViewOffValue = useSyncExternalStore(subscribeAdminViewOff, readAdminViewOff, () => false);

  function toggleAdminView() {
    const next = !adminViewOffValue;
    writeAdminViewOff(next);
    if (next && tab === "admin") setTab("home");
  }

  return { adminViewOff: adminViewOffValue, toggleAdminView };
}

export function useAppAnalytics(tab: Tab, tgUserId: number | null, session: Record<string, unknown>) {
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  });

  useEffect(() => {
    if (tgUserId) fireAnalytics("app_open", sessionRef.current);
  }, [tgUserId]);

  useEffect(() => {
    if (tgUserId) fireAnalytics("screen_view", { screen: tab });
  }, [tab, tgUserId]);
}
