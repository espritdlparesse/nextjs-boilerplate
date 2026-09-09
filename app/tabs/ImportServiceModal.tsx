import { FilePickerButton } from "@/app/components/FilePickerButton";
import type { ImportPlatform as CsvPlatform } from "@/lib/fileImports";
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

function CsvPickerButton({ csvPlatform, imports, label, className, marginTop }: {
  csvPlatform: CsvPlatform;
  imports: Imports;
  label: string;
  className: string;
  marginTop: number;
}) {
  return (
    <FilePickerButton
      label={label}
      accept=".csv,text/csv"
      className={className}
      style={{ marginTop }}
      disabled={imports.importLoading}
      onPick={([file]) => imports.importCsvPlatform(csvPlatform, file)}
    />
  );
}

function ImportActions({ platform, csvPlatform, imports, actionLabel }: {
  platform: ProfilePlatform | null;
  csvPlatform: CsvPlatform | null;
  imports: Imports;
  actionLabel: string;
}) {
  if (!platform) {
    if (!csvPlatform) return null;
    return <CsvPickerButton csvPlatform={csvPlatform} imports={imports} label={actionLabel} className="btn" marginTop={16} />;
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
      <CsvPickerButton csvPlatform={platform} imports={imports} label="или выбрать csv" className="btn btn-outline" marginTop={12} />
    </>
  );
}

function YandexMusicPanel({ imports }: { imports: Imports }) {
  return (
    <div className="input-group" style={{ marginTop: 12 }}>
      <div className="input-label">ссылка на плейлист</div>
      <input
        className="input"
        placeholder="например: music.yandex.ru/users/…/playlists/3"
        value={imports.yandexMusicUrl}
        onChange={(event) => imports.setYandexMusicUrl(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && imports.importYandexMusicPlaylist()}
        autoCapitalize="none"
        autoCorrect="off"
      />
      {imports.importLoading ? <div style={HINT_STYLE}>{imports.importStatus || "читаем плейлист..."}</div> : null}
      <button
        className="btn"
        style={{ marginTop: 16 }}
        onClick={imports.importYandexMusicPlaylist}
        disabled={imports.importLoading}
      >
        импортировать плейлист
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
        {service.id === "yandex_music" ? <YandexMusicPanel imports={imports} /> : null}

        <ImportActions
          platform={profilePlatform}
          csvPlatform={service.kind === "oauth" || service.kind === "link" ? null : (service.id as CsvPlatform)}
          imports={imports}
          actionLabel={service.actionLabel ?? "выбрать файл"}
        />

      </div>
    </div>
  );
}
