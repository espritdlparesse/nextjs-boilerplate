import { useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import { fetchTelegramLinkStatus, startTelegramLink } from "../lib/api";
import QRCode from "qrcode";
import type { TelegramLinkState } from "./appTypes";

export function useTelegramLink(deps: {
  apiToken: string | null;
  fireAnalytics: (event: string, properties?: Record<string, unknown>) => void;
  setToastMessage: (message: string | null) => void;
  onJustLinked: () => Promise<void>;
}) {
  const { apiToken, fireAnalytics, setToastMessage, onJustLinked } = deps;
  const [telegramLink, setTelegramLink] = useState<TelegramLinkState>({
    linked: false,
    telegramOwnerKey: null,
    code: null,
    expiresAt: null,
  });
  const [telegramLinkLoading, setTelegramLinkLoading] = useState(false);
  const [telegramLinkStatus, setTelegramLinkStatus] = useState<string | null>(null);
  const [telegramLinkQrDataUrl, setTelegramLinkQrDataUrl] = useState<string | null>(null);
  const telegramLinkWasLinkedRef = useRef(false);

  async function createTelegramLinkCode() {
    if (!apiToken || telegramLinkLoading) return;

    try {
      setTelegramLinkLoading(true);
      setTelegramLinkStatus("готовим код для Telegram...");
      const data = await startTelegramLink(apiToken);
      setTelegramLink({
        linked: false,
        telegramOwnerKey: null,
        code: data.code,
        expiresAt: data.expiresAt,
      });
      telegramLinkWasLinkedRef.current = false;
      setTelegramLinkStatus("код готов — введи его в mini app");
      setToastMessage("код для Telegram готов");
      fireAnalytics("telegram_link_code_created");
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось создать код";
      setTelegramLinkStatus(message);
      setToastMessage("не удалось создать код");
    } finally {
      setTelegramLinkLoading(false);
    }
  }

  async function openTelegramLinkFlow() {
    const code = telegramLink.code?.trim().toUpperCase();
    if (!code) {
      setTelegramLinkStatus("сначала подготовь код для Telegram");
      return;
    }

    try {
      await Linking.openURL(`https://t.me/every_you_bot?startapp=link_${code}`);
    } catch {
      setTelegramLinkStatus("не получилось открыть Telegram автоматически");
    }
  }

  useEffect(() => {
    if (!apiToken) return;
    let cancelled = false;

    fetchTelegramLinkStatus(apiToken)
      .then((status) => {
        if (cancelled) return;
        setTelegramLink(status);
        telegramLinkWasLinkedRef.current = status.linked;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [apiToken]);

  useEffect(() => {
    if (!apiToken || telegramLink.linked || !telegramLink.code) return;

    let cancelled = false;
    const intervalId = setInterval(async () => {
      try {
        const status = await fetchTelegramLinkStatus(apiToken);
        if (cancelled) return;

        const justLinked = status.linked && !telegramLinkWasLinkedRef.current;
        telegramLinkWasLinkedRef.current = status.linked;
        setTelegramLink(status);

        if (justLinked) {
          setTelegramLinkStatus("готово — Telegram и приложение теперь связаны");
          setToastMessage("Telegram подключен");
          await onJustLinked();
        }
      } catch {
        // ignore background link polling errors
      }
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [apiToken, telegramLink.code, telegramLink.linked]);

  useEffect(() => {
    if (!telegramLink.code) {
      setTelegramLinkQrDataUrl(null);
      return;
    }

    const deepLink = `https://t.me/every_you_bot?startapp=link_${telegramLink.code}`;
    QRCode.toDataURL(deepLink, {
      margin: 1,
      width: 480,
      color: { dark: "#111111", light: "#FFFFFF" },
    })
      .then((uri: string) => setTelegramLinkQrDataUrl(uri))
      .catch(() => setTelegramLinkQrDataUrl(null));
  }, [telegramLink.code]);

  return {
    telegramLink, telegramLinkLoading, telegramLinkStatus, telegramLinkQrDataUrl,
    telegramLinkWasLinkedRef,
    setTelegramLink, setTelegramLinkStatus, setTelegramLinkQrDataUrl,
    createTelegramLinkCode, openTelegramLinkFlow,
  };
}
