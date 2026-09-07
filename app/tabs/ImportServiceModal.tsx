import type { useImports } from "@/app/hooks/useImports";

type Imports = ReturnType<typeof useImports>;
type ProfilePlatform = "lastfm" | "letterboxd";

const HINT_STYLE = { marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 } as const;

const PROFILE_FIELDS: Record<ProfilePlatform, { label: string; placeholder: string; hint: string; name: string }> = {
  lastfm: {
    name: "last.fm",
    label: "username last.fm",
    placeholder: "например: nastyad",
    hint: "импортируем recent tracks из публичного профиля last.fm",
  },
  letterboxd: {
    name: "letterboxd",
    label: "username или ссылка на profile",
    placeholder: "например: letterboxd.com/nastyad/",
    hint: "public profile beta: лучше всего работает с открытым профилем",
  },
};

function ProfileImportPanel({ platform, imports }: { platform: ProfilePlatform; imports: Imports }) {
  const field = PROFILE_FIELDS[platform];
  const connected = imports.connectedProfiles[platform];
  const value = platform === "lastfm" ? imports.lastfmProfileInput : imports.letterboxdProfileInput;
  const setValue = platform === "lastfm" ? imports.setLastfmProfileInput : imports.setLetterboxdProfileInput;

  return (
    <div className="input-group" style={{ marginTop: 12 }}>
      {connected ? (
        <div style={{ ...HINT_STYLE, marginTop: 0, marginBottom: 10 }}>
          {field.name} подключен: {connected.profile}
        </div>
      ) : null}
      <div className="input-label">{field.label}</div>
      <input
        className="input"
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div style={HINT_STYLE}>{field.hint}</div>
      {imports.importLoading ? <div style={HINT_STYLE}>{imports.importStatus || "смотрим профиль..."}</div> : null}
      {connected ? (
        <>
          <button
            className="btn btn-outline"
            style={{ marginTop: 12 }}
            onClick={() => imports.disconnectConnectedProfile(platform, false)}
            disabled={imports.importLoading}
          >
            отвязать {field.name}
          </button>
          {platform === "letterboxd" ? (
            <button
              className="btn btn-outline"
              style={{ marginTop: 12 }}
              onClick={() => imports.disconnectConnectedProfile(platform, true)}
              disabled={imports.importLoading}
            >
              отвязать и убрать импорт
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ImportActions({ platform, imports, actionLabel }: {
  platform: ProfilePlatform | null;
  imports: Imports;
  actionLabel: string;
}) {
  if (!platform) {
    return (
      <button className="btn" style={{ marginTop: 16 }} onClick={imports.confirmCsvImport} disabled={imports.importLoading}>
        {actionLabel}
      </button>
    );
  }

  return (
    <>
      <button
        className="btn"
        style={{ marginTop: 16 }}
        onClick={() => void imports.importProfileWeb(platform)}
        disabled={imports.importLoading}
      >
        импортировать профиль
      </button>
      <button
        className="btn btn-outline"
        style={{ marginTop: 12 }}
        onClick={imports.confirmCsvImport}
        disabled={imports.importLoading}
      >
        или выбрать csv
      </button>
    </>
  );
}

function SpotifyPanel({ imports }: { imports: Imports }) {
  if (!imports.spotifyConnected) return null;
  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.84)", lineHeight: 1.5 }}>
        spotify подключен{imports.spotifyProfileName ? `: ${imports.spotifyProfileName}` : ""}
      </div>
      <button className="btn btn-outline" onClick={() => imports.disconnectSpotify(false)} disabled={imports.spotifySyncing}>
        отвязать spotify
      </button>
      <button className="btn btn-outline" onClick={() => imports.disconnectSpotify(true)} disabled={imports.spotifySyncing}>
        отвязать и убрать импорт
      </button>
    </div>
  );
}

export function ImportServiceModal({ imports }: { imports: Imports }) {
  const service = imports.selectedImportService;
  if (!service) return null;
  const profilePlatform = service.id === "lastfm" || service.id === "letterboxd" ? service.id : null;

  return (
    <div className="service-modal-backdrop" onClick={() => imports.setSelectedImportService(null)}>
      <div className="service-modal" onClick={(e) => e.stopPropagation()}>
        <div className="service-modal-top">
          <div className="service-modal-title">{service.title}</div>
          <button className="btn btn-outline btn-sm" onClick={() => imports.setSelectedImportService(null)}>
            закрыть
          </button>
        </div>

        {service.instructions && (
          <div className="service-modal-copy">
            <ul>
              {service.instructions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {profilePlatform ? <ProfileImportPanel platform={profilePlatform} imports={imports} /> : null}

        <ImportActions
          platform={profilePlatform}
          imports={imports}
          actionLabel={service.actionLabel ?? "выбрать файл"}
        />

        {service.id === "spotify" ? <SpotifyPanel imports={imports} /> : null}
      </div>
    </div>
  );
}
