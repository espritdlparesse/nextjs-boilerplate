import { useEffect, useMemo, useRef, useState } from "react";
import { fireAnalytics } from "@/app/analytics";

const ANALYTICS_SDK_ID = "tg-analytics-sdk";

function telegramWebApp() {
  return (window as any).Telegram?.WebApp;
}

function readHelloName() {
  const user = telegramWebApp()?.initDataUnsafe?.user;
  const first = user?.first_name;
  const last = user?.last_name;
  const named = [first, last].filter(Boolean).join(" ");
  const name = named || (user?.username ? `@${user.username}` : "");
  return name ? `привет, ${name}` : "привет";
}

function readLinkCode() {
  const startParam = telegramWebApp()?.initDataUnsafe?.start_param;
  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const fallback = url?.searchParams.get("tgWebAppStartParam") ?? url?.searchParams.get("startapp") ?? "";
  const match = `${startParam ?? fallback}`.trim().match(/^link[_: -]?([A-Z0-9]+)$/i);
  return match?.[1]?.toUpperCase() ?? null;
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

function openWebApp() {
  const tg = telegramWebApp();
  try {
    tg?.ready?.();
    tg?.expand?.();
  } catch {}
}

function readUserId() {
  const id = telegramWebApp()?.initDataUnsafe?.user?.id;
  return id ? Number(id) : null;
}

export function useTelegramUser(onLinkCode: (code: string) => void) {
  const [helloName, setHelloName] = useState("привет!");
  const [tgUserId, setTgUserId] = useState<number | null>(null);
  const linkHandledRef = useRef(false);

  useAnalyticsSdk();

  useEffect(() => {
    openWebApp();
    setHelloName(readHelloName());
    setTgUserId(readUserId());
  }, []);

  useEffect(() => {
    if (linkHandledRef.current) return;
    const code = readLinkCode();
    if (!code) return;
    linkHandledRef.current = true;
    onLinkCode(code);
  }, []);

  const headerAvatar = useMemo(() => {
    const raw = helloName.replace(/^привет,?\s*/i, "").trim();
    if (!raw || raw === "привет!") return "◐";
    return raw[0]?.toUpperCase() ?? "◐";
  }, [helloName]);

  return { helloName, tgUserId, headerAvatar };
}

export function useAdminView(tab: string, setTab: (tab: any) => void) {
  const [adminViewOff, setAdminViewOff] = useState(false);

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

  return { adminViewOff, toggleAdminView };
}

export function useAppAnalytics(tab: string, tgUserId: number | null, session: Record<string, unknown>) {
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (tgUserId) fireAnalytics("app_open", sessionRef.current);
  }, [tgUserId]);

  useEffect(() => {
    if (tgUserId) fireAnalytics("screen_view", { screen: tab });
  }, [tab, tgUserId]);
}
