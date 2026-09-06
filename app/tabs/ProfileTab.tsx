import type { Tab } from "@/app/types";
import { Dispatch, SetStateAction } from "react";
import { useImports } from "@/app/hooks/useImports";
import { useProfile } from "@/app/hooks/useProfile";
import { isAdminTgId } from "@/lib/admins";

export function ProfileTab({ tab, tgUserId, counts, countsUnknown, headerAvatar, adminViewOff, toggleAdminView, importServices, setTab, imports, profile }: {
  tab: Tab;
  tgUserId: number | null;
  counts: any;
  countsUnknown: boolean;
  headerAvatar: string;
  adminViewOff: boolean;
  toggleAdminView: () => void;
  importServices: any[];
  setTab: Dispatch<SetStateAction<Tab>>;
  imports: ReturnType<typeof useImports>;
  profile: ReturnType<typeof useProfile>;
}) {
  return (
          <>
            <div className="card" style={{ background: "#ffe8f7" }}>
              <div className="card-title">профиль</div>
              <p className="card-text">здесь живут тихие настройки твоей библиотеки.</p>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
                <div className="header-avatar">{profile.profileAvatarUrl ? <img src={profile.profileAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "999px" }} /> : headerAvatar}</div>
                <div style={{ flex: 1 }}>
                  <input ref={profile.profileAvatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; if (file) void profile.uploadProfileAvatar(file); event.target.value = ""; }} />
                  <button className="btn btn-secondary btn-sm" onClick={() => profile.profileAvatarInputRef.current?.click()} disabled={profile.profileSaving}>загрузить аватар</button>
                  {profile.profileAvatarUrl ? <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => void profile.saveProfileSettings({ avatarUrl: null })} disabled={profile.profileSaving}>убрать</button> : null}
                </div>
              </div>
              {profile.editingProfileName || !profile.profileName ? (
                <>
                  <div className="input-group" style={{ marginTop: 16 }}>
                    <div className="input-label">как тебя зовут</div>
                    <input className="input" value={profile.profileNameDraft} placeholder="например, настя" onChange={(event) => profile.setProfileNameDraft(event.target.value)} />
                  </div>
                  <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={async () => { if (await profile.saveProfileSettings({ displayName: profile.profileNameDraft })) profile.setEditingProfileName(false); }} disabled={profile.profileSaving}>
                    {profile.profileSaving ? "сохраняем..." : "сохранить"}
                  </button>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
                  <div>
                    <div className="input-label">имя</div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 3 }}>{profile.profileName}</div>
                  </div>
                  <button className="btn btn-outline btn-sm" style={{ width: "auto" }} onClick={() => profile.setEditingProfileName(true)}>изменить</button>
                </div>
              )}
              <div className="stats" style={{ marginTop: 16 }}>
                <div className="stat-pill"><div className="stat-num">{countsUnknown ? "—" : counts.total}</div><div className="stat-label">всего</div></div>
                <div className="stat-pill"><div className="stat-num">{countsUnknown ? "—" : counts.music}</div><div className="stat-label">музыка</div></div>
                <div className="stat-pill"><div className="stat-num">{countsUnknown ? "—" : counts.books}</div><div className="stat-label">книги</div></div>
                <div className="stat-pill"><div className="stat-num">{countsUnknown ? "—" : counts.movies}</div><div className="stat-label">фильмы</div></div>
              </div>
            </div>

            {isAdminTgId(tgUserId) && (
              <div className="card">
                <div className="card-title">режим</div>
                <p className="card-text">
                  {adminViewOff
                    ? "сейчас приложение выглядит так, как его видит обычный человек."
                    : "видна вкладка со статистикой и разметкой."}
                </p>
                <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={toggleAdminView}>
                  {adminViewOff ? "вернуть админку" : "смотреть как обычный человек"}
                </button>
              </div>
            )}

            <div className="card">
              <div className="card-title">подключенные сервисы</div>
              <p className="card-text">здесь можно обновить импорт или отвязать источник. новые ссылки, файлы и скриншоты добавляются во вкладке «добавить».</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                <div style={{ padding: "14px", border: "1px solid #e7e2d9", borderRadius: 18 }}>
                  <div style={{ fontWeight: 800 }}>Spotify</div>
                  <div className="card-text" style={{ marginTop: 4 }}>
                    {imports.spotifyConnected ? `подключен${imports.spotifyProfileName ? `: ${imports.spotifyProfileName}` : ""}` : "не подключен"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {imports.spotifyConnected ? (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => void imports.syncSpotify()} disabled={imports.spotifySyncing}>
                          {imports.spotifySyncing ? "обновляем..." : "обновить импорт"}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => void imports.disconnectSpotify(false)} disabled={imports.spotifySyncing}>
                          отвязать
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => void imports.connectSpotify()}>
                        подключить
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ padding: "14px", border: "1px solid #e7e2d9", borderRadius: 18 }}>
                  <div style={{ fontWeight: 800 }}>last.fm</div>
                  <div className="card-text" style={{ marginTop: 4 }}>
                    {imports.connectedProfiles.lastfm ? `подключен: ${imports.connectedProfiles.lastfm.profile}` : "не подключен"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => imports.setSelectedImportService(importServices.find((service) => service.id === "lastfm") ?? null)} disabled={imports.importLoading}>
                      {imports.connectedProfiles.lastfm ? "обновить импорт" : "подключить"}
                    </button>
                    {imports.connectedProfiles.lastfm ? (
                      <button className="btn btn-outline btn-sm" onClick={() => void imports.disconnectConnectedProfile("lastfm", false)} disabled={imports.importLoading}>
                        отвязать
                      </button>
                    ) : null}
                  </div>
                </div>

                <div style={{ padding: "14px", border: "1px solid #e7e2d9", borderRadius: 18 }}>
                  <div style={{ fontWeight: 800 }}>Letterboxd</div>
                  <div className="card-text" style={{ marginTop: 4 }}>
                    {imports.connectedProfiles.letterboxd ? `подключен: ${imports.connectedProfiles.letterboxd.profile}` : "не подключен"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => imports.setSelectedImportService(importServices.find((service) => service.id === "letterboxd") ?? null)} disabled={imports.importLoading}>
                      {imports.connectedProfiles.letterboxd ? "обновить импорт" : "подключить"}
                    </button>
                    {imports.connectedProfiles.letterboxd ? (
                      <button className="btn btn-outline btn-sm" onClick={() => void imports.disconnectConnectedProfile("letterboxd", false)} disabled={imports.importLoading}>
                        отвязать
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <button className="btn btn-outline" style={{ marginTop: 14 }} onClick={() => setTab("add")}>
                добавить из другого сервиса
              </button>
              {imports.importStatus ? <div style={{ marginTop: 10, fontSize: 13, color: "#666" }}>{imports.importStatus}</div> : null}
              {imports.importError ? <div className="error" style={{ marginTop: 10 }}>{imports.importError}</div> : null}
            </div>

          </>
        
  );
}
