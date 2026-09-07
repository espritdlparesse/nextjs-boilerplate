import { useEffect } from "react";
import { Linking } from "react-native";
import { clampText, type ContentType } from "../shared/everyyou/domain";

export type SharedItem = { type: ContentType; title: string; authorOrArtist: string };

function readSharedItem(url: string): { spotifyUrl: string } | { item: SharedItem } | null {
  const normalized = clampText(url).trim();
  if (!normalized) return null;
  if (normalized.includes("open.spotify.com/")) return { spotifyUrl: normalized };

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }

  const isEveryyouImport =
    parsed.protocol === "everyyou:" &&
    (parsed.host.toLowerCase() === "import" || parsed.pathname.toLowerCase() === "/import");
  if (!isEveryyouImport) return null;

  const sharedUrl = parsed.searchParams.get("url")?.trim() ?? "";
  if (sharedUrl.includes("open.spotify.com/")) return { spotifyUrl: sharedUrl };

  const sharedType = (parsed.searchParams.get("type") ?? "").toLowerCase();
  if (sharedType !== "music" && sharedType !== "book" && sharedType !== "movie") return null;
  return {
    item: {
      type: sharedType,
      title: clampText(parsed.searchParams.get("title") ?? "").toLowerCase(),
      authorOrArtist: clampText(parsed.searchParams.get("author") ?? "").toLowerCase(),
    },
  };
}

export function useIncomingShare(deps: {
  loaded: boolean;
  onSpotifyUrl: (url: string) => void;
  onSharedItem: (item: SharedItem) => void;
}) {
  const { loaded, onSpotifyUrl, onSharedItem } = deps;

  useEffect(() => {
    if (!loaded) return;
    let active = true;

    function accept(url: string) {
      const shared = readSharedItem(url);
      if (!shared) return;
      if ("spotifyUrl" in shared) onSpotifyUrl(shared.spotifyUrl);
      else onSharedItem(shared.item);
    }

    Linking.getInitialURL().then((initialUrl) => {
      if (active && initialUrl) accept(initialUrl);
    });
    const subscription = Linking.addEventListener("url", ({ url }) => accept(url));

    return () => {
      active = false;
      subscription.remove();
    };
  }, [loaded]);
}
