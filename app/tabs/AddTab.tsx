import type { Tab, ItemType } from "@/app/types";
import { Dispatch, SetStateAction } from "react";
import { useImports } from "@/app/hooks/useImports";
import { useDeepVibe } from "@/app/hooks/useVibecheck";
import { useAddForm } from "@/app/hooks/useAddForm";
import { TYPE_LABELS, TYPE_ICONS } from "@/app/tabs/typeMeta";

export function AddTab({ tab, importServices, imports, deepVibe, addForm }: {
  tab: Tab;
  importServices: any[];
  imports: ReturnType<typeof useImports>;
  deepVibe: ReturnType<typeof useDeepVibe>;
  addForm: ReturnType<typeof useAddForm>;
}) {
  return (
          <div className="card">
            <div className="card-title">добавить</div>

            <div
              className="mode-toggle"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <button
                className={`mode-btn${!addForm.manualMode ? " active" : ""}`}
                onClick={() => addForm.setManualMode(false)}
                style={{ width: "100%" }}
              >
                импорт изображения
              </button>
              <button
                className={`mode-btn${addForm.manualMode ? " active" : ""}`}
                onClick={() => addForm.setManualMode(true)}
                style={{ width: "100%" }}
              >
                вручную
              </button>
            </div>

            {/* MANUAL MODE */}
            {addForm.manualMode && (
              <>
                <div className="section-label">тип контента</div>
                <div className="type-row">
                  {(["music", "book", "movie"] as ItemType[]).map((t) => (
                    <button
                      key={t}
                      className={`type-btn${addForm.manualType === t ? " active" : ""}`}
                      onClick={() => addForm.setManualType(t)}
                    >
                      {TYPE_ICONS[t]} {TYPE_LABELS[t]}
                    </button>
                  ))}
                  {/* Кнопка своей категории — только для платных */}
                  <button
                    className={`type-btn${addForm.manualType === "custom" ? " active" : ""}`}
                    style={!(deepVibe.deepVibeAccess === "forever" || deepVibe.deepVibeAccess === "paid") ? {opacity:0.45} : {}}
                    onClick={() => {
                      if (deepVibe.deepVibeAccess === "forever" || deepVibe.deepVibeAccess === "paid") {
                        addForm.setManualType("custom");
                      } else {
                        deepVibe.buyDeepVibeForever();
                      }
                    }}
                    title={deepVibe.deepVibeAccess === "forever" || deepVibe.deepVibeAccess === "paid" ? "своя категория" : "доступно с подпиской"}
                  >
                    ✦ своё {!(deepVibe.deepVibeAccess === "forever" || deepVibe.deepVibeAccess === "paid") && "🔒"}
                  </button>
                </div>

                {/* UI кастомной категории */}
                {addForm.manualType === "custom" && (
                  <div style={{marginBottom:16}}>
                    <div className="section-label">категория</div>
                    {addForm.customCategories.length > 0 && (
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                        {addForm.customCategories.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => addForm.setSelectedCatId(cat.id)}
                            style={{
                              padding:"7px 14px",
                              border:`1px solid ${addForm.selectedCatId === cat.id ? "#000" : "#e0e0e0"}`,
                              background: addForm.selectedCatId === cat.id ? "#000" : "#fff",
                              color: addForm.selectedCatId === cat.id ? "#fff" : "#000",
                              fontSize:13,
                              cursor:"pointer",
                              display:"flex",alignItems:"center",gap:6,
                            }}
                          >
                            {cat.emoji} {cat.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {!addForm.showCreateCategory ? (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => addForm.setShowCreateCategory(true)}
                        style={{width:"auto",fontSize:12}}
                      >
                        + новая категория
                      </button>
                    ) : (
                      <div style={{border:"1px solid #e8e8e8",padding:16,marginTop:8}}>
                        <div className="input-group" style={{marginBottom:10}}>
                          <div className="input-label">эмодзи</div>
                          <input
                            className="input"
                            placeholder="📌"
                            value={addForm.newCatEmoji}
                            onChange={e => addForm.setNewCatEmoji(e.target.value)}
                            style={{width:72}}
                            maxLength={2}
                          />
                        </div>
                        <div className="input-group" style={{marginBottom:10}}>
                          <div className="input-label">название категории</div>
                          <input
                            className="input"
                            placeholder="подкасты, чипсы, игры..."
                            value={addForm.newCatName}
                            onChange={e => addForm.setNewCatName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && addForm.createCustomCategory()}
                          />
                        </div>
                        {addForm.catError && <div className="error">{addForm.catError}</div>}
                        <div style={{display:"flex",gap:8,marginTop:10}}>
                          <button className="btn btn-sm" onClick={addForm.createCustomCategory} disabled={addForm.catSaving}>
                            {addForm.catSaving ? "..." : "создать"}
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => { addForm.setShowCreateCategory(false); addForm.setCatError(""); }}>
                            отмена
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="input-group">
                  <div className="input-label">название</div>
                  <input
                    className="input"
                    placeholder={addForm.titlePlaceholder}
                    value={addForm.manualTitle}
                    onChange={(e) => addForm.setManualTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addForm.saveManual()}
                  />
                </div>

                <div className="input-group">
                  <div className="input-label">
                    {addForm.manualType === "music" ? "исполнитель" : addForm.manualType === "book" ? "автор" : addForm.manualType === "custom" ? "автор / бренд" : "режиссёр"}
                    {" "}
                    <span style={{ color: "#bbb", fontWeight: 300 }}>(необязательно)</span>
                  </div>
                  <input
                    className="input"
                    placeholder={addForm.creatorPlaceholder}
                    value={addForm.manualCreator}
                    onChange={(e) => addForm.setManualCreator(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addForm.saveManual()}
                  />
                </div>

                {addForm.manualError && <div className="error">{addForm.manualError}</div>}
                {addForm.manualSuccess && <div className="success">✓ сохранено!</div>}

                <div style={{ marginTop: 16 }}>
                  <button className="btn" onClick={addForm.saveManual} disabled={addForm.manualSaving}>
                    {addForm.manualSaving ? "сохраняю..." : "сохранить →"}
                  </button>
                </div>
              </>
            )}

            {/* IMPORT MODE */}
            {!addForm.manualMode && (
              <>
                <p className="card-text" style={{ marginBottom: 6 }}>
                  Загрузи до 10 изображений: скриншоты откуда угодно, фото книжной полки, обложек в магазине, постеров или экранов сервисов. ИИ постарается разобрать, что там, и собрать это в таймлайн.
                </p>
                <div className="import-service-grid">
                  {importServices.map((service) => (
                    <div key={service.id} className="import-service">
                      <button
                        type="button"
                        className="import-service-help"
                        onClick={() => imports.setSelectedImportService(service)}
                        disabled={imports.importLoading || imports.savingImported || imports.spotifySyncing}
                        aria-label={`инструкция ${service.title}`}
                      >
                        ?
                      </button>
                      <button
                        type="button"
                        className="import-service-main"
                        onClick={() => imports.startImportService(service)}
                        disabled={imports.importLoading || imports.savingImported || imports.spotifySyncing}
                      >
                        <div className="import-service-head">
                          <div className="import-service-icon">{service.icon}</div>
                          <div className="import-service-title">{service.title}</div>
                        </div>
                        <div className="import-service-subtitle">{service.subtitle}</div>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="input-group" style={{ marginTop: 16 }}>
                  <div className="input-label">плейлист Яндекс.Музыки</div>
                  <input
                    className="input"
                    placeholder="вставь публичную ссылку на плейлист"
                    value={imports.yandexMusicUrl}
                    onChange={(e) => imports.setYandexMusicUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && imports.importYandexMusicPlaylist()}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <div className="card-text" style={{ marginTop: 6 }}>плейлист должен быть открыт по ссылке</div>
                  <button className="btn btn-outline" style={{ marginTop: 10 }} onClick={imports.importYandexMusicPlaylist} disabled={imports.importLoading}>
                    {imports.importLoading ? "читаем плейлист..." : "импортировать плейлист"}
                  </button>
                </div>

                <input
                  ref={imports.csvImportRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && imports.selectedImportService && imports.selectedImportService.id !== "spotify") {
                      imports.importCsvPlatform(imports.selectedImportService.id, f);
                    }
                    e.target.value = "";
                  }}
                />

                <input
                  ref={imports.fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) imports.runImport(files);
                  }}/>

                <button
                  className="btn btn-outline"
                  onClick={() => imports.fileRef.current?.click()}
                  disabled={imports.importLoading}
                >
                  {imports.importLoading ? "разбираю изображения..." : "загрузить изображения →"}
                </button>

                {imports.importStatus && !imports.importError && (
                  <div style={{marginTop:12,fontSize:13,color:"#6f6a63"}}>{imports.importStatus}</div>
                )}
                {imports.importError && <div className="error">{imports.importError}</div>}

                {imports.imported.length > 0 && (
                  <>
                    <hr className="divider" />
                    <div className="section-label">найдено {imports.imported.length} айтемов</div>
                    <div
                      style={{
                        position: "sticky",
                        top: 12,
                        zIndex: 5,
                        background: "#faf8f3",
                        paddingBottom: 10,
                        marginBottom: 6,
                      }}
                    >
                      <button
                        className="btn"
                        style={{ marginBottom: 0 }}
                        onClick={imports.saveSelectedImported}
                        disabled={imports.savingImported}
                      >
                        {imports.savingImported ? "сохраняю..." : `сохранить выбранное (${imports.selectedIdx.size}) →`}
                      </button>
                    </div>

                  {imports.imported.map((it, i) => (
                      <div
                        key={i}
                        className={`import-item${imports.selectedIdx.has(i) ? " selected" : ""}`}
                        onClick={() => imports.toggleImported(i)}
                      >
                        <input
                          type="checkbox"
                          checked={imports.selectedIdx.has(i)}
                          onChange={() => imports.toggleImported(i)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ marginTop: 3, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{it.title}</div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{it.creator || "—"}</div>
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <span className="tag">{it.type === "custom" && it.custom_category_name ? `${it.custom_category_emoji ?? "✦"} ${it.custom_category_name}` : TYPE_LABELS[it.type]}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      className="btn"
                      style={{ marginTop: 8 }}
                      onClick={imports.saveSelectedImported}
                      disabled={imports.savingImported}
                    >
                      {imports.savingImported ? "сохраняю..." : `сохранить выбранное (${imports.selectedIdx.size}) →`}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        
  );
}
