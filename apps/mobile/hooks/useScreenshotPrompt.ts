import * as MediaLibrary from "expo-media-library";
import * as ScreenCapture from "expo-screen-capture";
import * as Sharing from "expo-sharing";
import { Share } from "react-native";
import { useEffect, useRef, useState } from "react";

const SCREENSHOT_WINDOW_MS = 3 * 60 * 1000;

function looksLikeScreenshot(asset: MediaLibrary.Asset, screenshotAt: number) {
  const createdAtMs = asset.creationTime ? asset.creationTime * 1000 : Date.now();
  if (Math.abs(createdAtMs - screenshotAt) < SCREENSHOT_WINDOW_MS) return true;
  const filename = `${asset.filename ?? ""}`.toLowerCase();
  return filename.includes("screenshot") || filename.includes("screen shot") || filename.includes("img_");
}

async function readRecentPhotos() {
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error("разреши доступ к фото, чтобы поделиться скриншотом");
  }

  const result = await MediaLibrary.getAssetsAsync({
    first: 12,
    mediaType: MediaLibrary.MediaType.photo,
    sortBy: [MediaLibrary.SortBy.creationTime],
  });

  if (!result.assets.length) {
    throw new Error("не нашли недавние изображения");
  }
  return result.assets;
}

async function localUriOf(asset: MediaLibrary.Asset) {
  const info = await MediaLibrary.getAssetInfoAsync(asset);
  return info.localUri ?? info.uri ?? null;
}

async function findLatestScreenshotUri(screenshotEventAt: number) {
  const assets = await readRecentPhotos();
  const screenshotAt = screenshotEventAt || Date.now();

  for (const asset of assets) {
    if (!looksLikeScreenshot(asset, screenshotAt)) continue;
    const localUri = await localUriOf(asset);
    if (localUri) return localUri;
  }

  return localUriOf(assets[0]);
}

export function useScreenshotPrompt() {
  const [screenshotPromptVisible, setScreenshotPromptVisible] = useState(false);
  const [latestScreenshotUri, setLatestScreenshotUri] = useState<string | null>(null);
  const [screenshotActionLoading, setScreenshotActionLoading] = useState(false);
  const [screenshotStatus, setScreenshotStatus] = useState<string | null>(null);
  const screenshotEventRef = useRef<number>(0);

  useEffect(() => {
    const subscription = ScreenCapture.addScreenshotListener(() => {
      screenshotEventRef.current = Date.now();
      setScreenshotPromptVisible(true);
      setScreenshotStatus(null);
      setLatestScreenshotUri(null);

      void findLatestScreenshotUri(screenshotEventRef.current)
        .then((uri) => setLatestScreenshotUri(uri))
        .catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  async function shareLatestScreenshot() {
    try {
      setScreenshotActionLoading(true);
      setScreenshotStatus("готовим скриншот к отправке...");
      const screenshotUri = latestScreenshotUri ?? (await findLatestScreenshotUri(screenshotEventRef.current));

      if (!screenshotUri) {
        throw new Error("не нашли скриншот для отправки");
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(screenshotUri);
      } else {
        await Share.share({
          message: "скриншот уже готов — можно отправить его в Telegram, Instagram или куда угодно еще",
        });
      }

      setScreenshotPromptVisible(false);
      setScreenshotStatus(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "не удалось подготовить скриншот к отправке";
      setScreenshotStatus(message);
    } finally {
      setScreenshotActionLoading(false);
    }
  }

  return {
    screenshotPromptVisible,
    latestScreenshotUri,
    screenshotActionLoading,
    screenshotStatus,
    setScreenshotPromptVisible,
    setScreenshotStatus,
    shareLatestScreenshot,
  };
}
