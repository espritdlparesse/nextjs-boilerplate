import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  STORAGE_KEY_DAILY_STEPS,
  STORAGE_KEY_HEALTH_STEPS_ENABLED,
  type DailyStepEntry,
} from "../shared/everyyou/domain";

export function useDailySteps(deps: {
  loaded: boolean;
  setToastMessage: (message: string | null) => void;
}) {
  const { loaded, setToastMessage } = deps;
  const [dailySteps, setDailySteps] = useState<DailyStepEntry[]>([]);
  const [healthStepsEnabled, setHealthStepsEnabled] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_DAILY_STEPS, JSON.stringify(dailySteps)).catch(() => undefined);
  }, [dailySteps, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_HEALTH_STEPS_ENABLED, healthStepsEnabled ? "true" : "false").catch(() => undefined);
  }, [healthStepsEnabled, loaded]);

  const dailyStepsByDay = useMemo(
    () =>
      dailySteps.reduce<Record<string, number>>((byDay, entry) => {
        byDay[entry.dayKey] = entry.steps;
        return byDay;
      }, {}),
    [dailySteps]
  );
  const totalSteps = useMemo(() => dailySteps.reduce((sum, entry) => sum + entry.steps, 0), [dailySteps]);

  function updateHealthStepsEnabled(value: boolean) {
    setHealthStepsEnabled(value);
    if (value) setToastMessage("когда подключим здоровье, шаги появятся в календаре по дням");
  }

  return {
    dailySteps, healthStepsEnabled, dailyStepsByDay, totalSteps,
    setDailySteps, setHealthStepsEnabled, updateHealthStepsEnabled,
  };
}
