import type { DailyStepEntry } from "../shared/everyyou/domain";

type HealthImportResult =
  | { ok: true; entries: DailyStepEntry[] }
  | { ok: false; message: string };

type AppleHealthKitModule = typeof import("react-native-health");

let appleHealthKitModule: AppleHealthKitModule | null = null;

function toDayKey(dateLike: string) {
  const date = new Date(dateLike);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function loadAppleHealthKit() {
  if (appleHealthKitModule) return appleHealthKitModule;
  // Loaded lazily so the app can still run in Expo Go before the dev build is ready.
  appleHealthKitModule = await import("react-native-health");
  return appleHealthKitModule;
}

function callAsync<T>(runner: (done: (error: string | null, value: T) => void) => void) {
  return new Promise<T>((resolve, reject) => {
    runner((error, value) => {
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve(value);
    });
  });
}

export async function importDailyStepsFromHealthKit(daysBack = 30): Promise<HealthImportResult> {
  try {
    const AppleHealthKit = (await loadAppleHealthKit()).default;

    const isAvailable = await callAsync<boolean>((done) => {
      AppleHealthKit.isAvailable((error, result) => done(error ? String(error) : null, result));
    });

    if (!isAvailable) {
      return { ok: false, message: "на этом устройстве здоровье недоступно" };
    }

    const permissions = {
      permissions: {
        read: [AppleHealthKit.Constants.Permissions.Steps],
        write: [],
      },
    };

    await callAsync<unknown>((done) => {
      AppleHealthKit.initHealthKit(permissions, (error, result) => done(error ? String(error) : null, result));
    });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysBack + 1);
    startDate.setHours(0, 0, 0, 0);

    const samples = await callAsync<Array<{ startDate: string; value: number }>>((done) => {
      AppleHealthKit.getDailyStepCountSamples(
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        (error, results) => done(error ? String(error) : null, results as Array<{ startDate: string; value: number }>),
      );
    });

    const entries: DailyStepEntry[] = samples
      .filter((sample) => Number.isFinite(sample.value) && sample.value > 0)
      .map((sample) => ({
        dayKey: toDayKey(sample.startDate),
        steps: Math.round(sample.value),
        source: "apple_health",
      }));

    return { ok: true, entries };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "не удалось подтянуть шаги из здоровья",
    };
  }
}
