export type TelegramWebAppUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  ready?: () => void;
  expand?: () => void;
  openLink?: (url: string) => void;
  openInvoice?: (url: string, onStatus: (status: string) => void) => void;
  onEvent?: (event: "screenshot_taken", handler: () => void) => void;
  offEvent?: (event: "screenshot_taken", handler: () => void) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function telegramWebApp(): TelegramWebApp | undefined {
  return typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
}

export function telegramInitData() {
  return telegramWebApp()?.initData ?? "";
}
