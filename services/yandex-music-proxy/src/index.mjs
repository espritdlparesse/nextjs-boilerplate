import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 8080);
const proxyToken = process.env.PROXY_TOKEN;

if (!proxyToken) throw new Error("PROXY_TOKEN missing");

app.use(express.json({ limit: "8kb" }));

function unauthorized(req, res, next) {
  // Yandex Cloud consumes Authorization for its own IAM layer before Express sees it.
  if (req.get("x-everyyou-proxy-token") !== proxyToken) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function findTracks(value, found = []) {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    for (const item of value) findTracks(item, found);
    return found;
  }
  const record = value;
  if (typeof record.title === "string" && Array.isArray(record.artists)) found.push(record);
  for (const [name, nested] of Object.entries(record)) {
    if (name !== "artists" && name !== "track") findTracks(nested, found);
    if (name === "track") findTracks(nested, found);
  }
  return found;
}

function mapTracks(payload) {
  const seen = new Set();
  return findTracks(payload)
    .map((track) => {
      const title = normalize(track.title).toLowerCase();
      const authorOrArtist = (track.artists ?? [])
        .map((artist) => normalize(artist?.name))
        .filter(Boolean)
        .join(", ")
        .toLowerCase();
      return { type: "music", source: "import_yandex_music", title, authorOrArtist };
    })
    .filter((item) => {
      if (!item.title || !item.authorOrArtist) return false;
      const id = `${item.title}::${item.authorOrArtist}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

app.post("/v1/playlist", unauthorized, async (req, res) => {
  const id = normalize(req.body?.id);
  const user = normalize(req.body?.user);
  if (!id || !/^[a-z0-9-]+$/i.test(id)) return res.status(400).json({ error: "invalid playlist link" });

  // Public playlist endpoints are available from the Russian region used by this service.
  const path = user ? `users/${encodeURIComponent(user)}/playlists/${encodeURIComponent(id)}` : `playlist/${encodeURIComponent(id)}`;
  const response = await fetch(`https://api.music.yandex.net/${path}`, {
    headers: { "X-Yandex-Music-Client": "YandexMusicAndroid/24023621" },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) return res.status(502).json({ error: "Яндекс.Музыка не отдала этот плейлист" });

  const items = mapTracks(payload);
  if (!items.length) return res.status(422).json({ error: "в плейлисте не нашлись доступные треки" });
  res.json({ items });
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(port, () => console.log(`Yandex Music proxy listening on ${port}`));
