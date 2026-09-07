import { useEffect, useRef } from "react";
import { trackAnalyticsEvent } from "../lib/api";
import type { Tab } from "../shared/everyyou/domain";

export function useAppAnalytics(deps: {
  apiToken: string | null;
  loaded: boolean;
  tab: Tab;
  session: Record<string, unknown>;
}) {
  const { apiToken, loaded, tab, session } = deps;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  function fireAnalytics(event: string, properties?: Record<string, unknown>) {
    if (!apiToken) return;
    trackAnalyticsEvent(apiToken, event, properties).catch(() => undefined);
  }

  useEffect(() => {
    if (!loaded || !apiToken) return;
    fireAnalytics("app_open", sessionRef.current);
  }, [loaded, apiToken]);

  useEffect(() => {
    if (!loaded || !apiToken) return;
    fireAnalytics("screen_view", { screen: tab });
  }, [tab, loaded, apiToken]);

  return fireAnalytics;
}
