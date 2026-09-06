import type { Tab, DbItem, ItemType } from "@/app/types";
import { Dispatch, SetStateAction } from "react";
import { useLibrary } from "@/app/hooks/useLibrary";
import { formatShortDate, dayKey, addDays, startOfMonth, getItemDateValue } from "@/lib/dates";
import { TYPE_LABELS, TYPE_ICONS, TYPE_COLORS } from "@/app/tabs/typeMeta";

export function LibraryTab({ tab, items, libraryLoading, libraryError, libraryView, setLibraryView, setTab, customCategories, deletingId, deleteItem, library }: {
  tab: Tab;
  items: DbItem[];
  libraryLoading: boolean;
  libraryError: string;
  libraryView: string;
  setLibraryView: Dispatch<SetStateAction<any>>;
  setTab: Dispatch<SetStateAction<Tab>>;
  customCategories: any[];
  deletingId: string | number | null;
  deleteItem: (id: string | number) => void;
  library: ReturnType<typeof useLibrary>;
}) {
  return (
          <>
            <div className="library-shell">
              <div className="library-top-row">
                <div className="card-title" style={{ marginBottom: 0 }}>библиотека</div>
                <div className="compact-toggle">
                  <button
                    type="button"
                    className={`filter-btn${libraryView === "tiles" ? " active" : ""}`}
                    onClick={() => setLibraryView("tiles")}
                  >
                    плитки
                  </button>
                  <button
                    type="button"
                    className={`filter-btn${libraryView === "calendar" ? " active" : ""}`}
                    onClick={() => setLibraryView("calendar")}
                  >
                    календарь
                  </button>
                </div>
              </div>
            <div className="library-copy">
              смотри все вместе или раскладывай по типам. в календаре видно, что с тобой происходило по дням.
            </div>

            {library.libraryStatus && !libraryError && <div className="status-note">{library.libraryStatus}</div>}
            {library.returnDay && !library.calendarMoveMode ? (
              <div className="calendar-move-banner" style={{ marginBottom: 16 }}>
                <div className="calendar-move-copy">
                  <div className="section-label" style={{ marginBottom: 4 }}>
                    {library.lastMovedTargetDay
                      ? `перенесли на ${library.lastMovedTargetDay.date.toLocaleString("ru-RU", { day: "numeric", month: "long" })}`
                      : "дату перенесли"}
                  </div>
                  <div>если хочешь, можно сразу вернуться к прежнему дню.</div>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={library.jumpBackToReturnDay}>
                  {`вернуться к ${library.returnDay.date.toLocaleString("ru-RU", { day: "numeric", month: "long" })}`}
                </button>
              </div>
            ) : null}

            <div className="section-label">тип контента</div>
              <div className="filter-row">
                {([["all", "все"], ["music", "музыка"], ["book", "книги"], ["movie", "фильмы"]] as [string, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`filter-btn${library.libFilter === val ? " active" : ""}`}
                    onClick={() => library.setLibFilter(val)}
                  >
                    {label}
                  </button>
                ))}
                {customCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`filter-btn${library.libFilter === cat.id ? " active" : ""}`}
                    onClick={() => library.setLibFilter(cat.id)}
                  >
                    {cat.emoji} {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {libraryError && <div className="error">{libraryError}</div>}

            {libraryLoading ? (
              <div className="empty">загружаю…</div>
            ) : library.filteredItems.length === 0 ? (
              <div className="empty">
                {items.length === 0 ? "пока пусто — добавь что-нибудь!" : "нет айтемов этого типа"}
              </div>
            ) : libraryView === "calendar" ? (
              <>
                <div className="calendar-shell">
                  {library.calendarMoveMode && library.selectedDayItems.length > 0 ? (
                    <div className="calendar-move-banner">
                      <div className="calendar-move-copy">
                        <div className="section-label" style={{ marginBottom: 4 }}>перенос даты</div>
                        <div>выбери новый день для {library.selectedDayItems.length} {library.selectedDayItems.length === 1 ? "айтема" : library.selectedDayItems.length < 5 ? "айтемов" : "айтемов"}.</div>
                      </div>
                      <button type="button" className="btn btn-outline btn-sm" onClick={library.cancelMoveSelectedDayItems}>отмена</button>
                    </div>
                  ) : null}
                  <div className="calendar-top-row">
                    <button className="calendar-arrow" onClick={() => library.setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1)))}>‹</button>
                    <div className="calendar-title">
                      {library.calendarMonth
                        .toLocaleString("ru-RU", { month: "long", year: "numeric" })
                        .replace(/\sг\.$/, "")
                        .replace(/^./, (char) => char.toUpperCase())}
                    </div>
                    <div className="calendar-top-actions">
                      <button
                        type="button"
                        className="calendar-arrow calendar-today"
                        onClick={() => {
                          const today = new Date();
                          library.setCalendarMonth(startOfMonth(today));
                          library.setSelectedDayKey(dayKey(today));
                        }}
                      >
                        сегодня
                      </button>
                      <button className="calendar-arrow" onClick={() => library.setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1)))}>›</button>
                    </div>
                  </div>

                  {library.monthlySummary && (
                    <div className="vibe-section vibe-pink" style={{ marginTop: 4, marginBottom: 12 }}>
                      <div className="section-label" style={{ marginBottom: 4 }}>по месяцу</div>
                      <div>{library.monthlySummary}</div>
                    </div>
                  )}

                  <div className="calendar-weekdays">
                    {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((label) => (
                      <div key={label} className="calendar-weekday">{label}</div>
                    ))}
                  </div>

                  <div className="calendar-grid">
                    {library.calendarDays.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        className={`calendar-day${!day.inMonth ? " muted" : ""}${library.selectedDay?.key === day.key ? " selected" : ""}`}
                        onClick={() => {
                          if (library.calendarMoveMode) {
                            library.setPendingMoveTargetKey(day.key);
                            return;
                          }
                          library.setSelectedDayKey(day.key);
                          library.setSelectedDayTypeFilter("all");
                          library.setSelectedDayItems([]);
                          library.setDayModalOpen(true);
                        }}
                      >
                        <div className="calendar-day-head">
                          <span className="calendar-day-number">{day.date.getDate()}</span>
                          {day.items.length > 0 ? <span className="calendar-day-count">{day.items.length}</span> : null}
                        </div>
                        <div className="calendar-dots">
                          {day.items.slice(0, 4).map((item) => (
                            <div key={String(item.id)} className={`calendar-dot ${item.type}`} />
                          ))}
                        </div>
                        {day.items.length > 4 ? <div className="calendar-more">+ еще {day.items.length - 4}</div> : null}
                      </button>
                    ))}
                  </div>
                </div>

                {library.dayModalOpen && library.selectedDay ? (
                  <div className="day-modal-backdrop" onClick={() => library.setDayModalOpen(false)}>
                    <div className="day-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="day-modal-head">
                        <div className="card-title" style={{ marginBottom: 0 }}>
                          {library.selectedDay.date
                            .toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
                            .replace(/^./, (char) => char.toUpperCase())}
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={() => library.setDayModalOpen(false)}>закрыть</button>
                      </div>

                      <div className="day-week-strip">
                        {Array.from({ length: 7 }, (_, index) => {
                          const selectedDay = library.selectedDay!;
                          const base = addDays(selectedDay.date, -((selectedDay.date.getDay() + 6) % 7));
                          const date = addDays(base, index);
                          const key = dayKey(date);
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`day-week-pill${key === selectedDay.key ? " active" : ""}`}
                              onClick={() => {
                                library.setSelectedDayKey(key);
                                library.setSelectedDayTypeFilter("all");
                                library.setSelectedDayItems([]);
                              }}
                            >
                              <div className="day-week-name">{date.toLocaleString("ru-RU", { weekday: "short" })}</div>
                              <div className="day-week-number">{date.getDate()}</div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="day-type-filters">
                        {([["all", `все ${library.selectedDayCounts.all}`], ["music", `музыка ${library.selectedDayCounts.music}`], ["book", `книги ${library.selectedDayCounts.book}`], ["movie", `фильмы ${library.selectedDayCounts.movie}`]] as [ItemType | "all", string][]).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={`filter-btn compact${library.selectedDayTypeFilter === value ? " active" : ""}`}
                            onClick={() => library.setSelectedDayTypeFilter(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {library.selectedDayItems.length > 0 ? (
                        <div className="day-action-row">
                          <button type="button" className="btn btn-outline btn-sm" onClick={library.startMoveSelectedDayItems}>
                            {library.selectedDayItems.length === 1 ? "изменить дату" : `изменить дату (${library.selectedDayItems.length})`}
                          </button>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => library.setSelectedDayItems([])}>
                            снять выбор
                          </button>
                        </div>
                      ) : null}

                      <div className="day-modal-scroll">
                        {library.selectedDayVisibleItems.length > 0 ? (
                          <div className="day-items-grid">
                            {library.selectedDayVisibleItems.map((it) => (
                              <button
                                key={String(it.id)}
                                type="button"
                                className={`item-card ${it.type}${library.selectedDayItems.includes(it.id) ? " selected" : ""}`}
                                onClick={() => library.toggleSelectedDayItem(it.id)}
                              >
                                <div className="item-topline">
                                  <div className="item-meta">
                                    <span className="tag">{it.type === "custom" && it.custom_category_name ? `${it.custom_category_emoji ?? "✦"} ${it.custom_category_name}` : TYPE_LABELS[it.type]}</span>
                                  </div>
                                  <div className="item-date">{formatShortDate(getItemDateValue(it))}</div>
                                </div>
                                <div className="item-body">
                                  {it.creator && <div className="item-title">{it.creator}</div>}
                                  <div className="item-creator">{it.title}</div>
                                </div>
                                {library.selectedDayItems.includes(it.id) ? <div className="item-selected-badge">выбрано</div> : null}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="empty">в этот день пока пусто</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {library.calendarMoveMode && library.pendingMoveTarget ? (
                  <div className="day-modal-backdrop" onClick={() => library.setPendingMoveTargetKey(null)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="card-title" style={{ marginBottom: 10 }}>перенести на другой день?</div>
                      <div className="vibe-helper" style={{ marginBottom: 14 }}>
                        перенесем {library.selectedDayItems.length} {library.selectedDayItems.length === 1 ? "айтем" : library.selectedDayItems.length < 5 ? "айтема" : "айтемов"} на{" "}
                        {library.pendingMoveTarget.date.toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}.
                      </div>
                      <div className="day-action-row">
                        <button type="button" className="btn" onClick={library.moveSelectedItemsToDay}>да, перенести</button>
                        <button type="button" className="btn btn-outline" onClick={() => library.setPendingMoveTargetKey(null)}>не сейчас</button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="items-grid">
                {library.filteredItems.map((it) => (
                  <div key={String(it.id)} className={`item-card ${it.type}`}>
                    <div className="item-topline">
                      <div className="item-meta">
                        <span className="tag">{it.type === "custom" && it.custom_category_name ? `${it.custom_category_emoji ?? "✦"} ${it.custom_category_name}` : TYPE_LABELS[it.type]}</span>
                      </div>
                      <div className="item-date">{formatShortDate(getItemDateValue(it))}</div>
                    </div>
                    <div className="item-body">
                      {it.creator && <div className="item-title">{it.creator}</div>}
                      <div className="item-creator">{it.title}</div>
                    </div>
                    <button
                      className="delete-btn"
                      onClick={() => deleteItem(it.id)}
                      disabled={deletingId === it.id}
                      title="удалить"
                    >
                      {deletingId === it.id ? "…" : "×"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setTab("add")}>
                + добавить контент
              </button>
            </div>
          </>
        
  );
}
