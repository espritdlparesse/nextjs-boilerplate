import type { Tab } from "@/app/types";
import { useDeepVibe, useVibecheck } from "@/app/hooks/useVibecheck";
import { MarkdownText, VibeResult } from "@/app/tabs/VibeResult";

export function VibeTab({ tab, counts, countsUnknown, shareVibeCard, vibe, deepVibe }: {
  tab: Tab;
  counts: { total: number; music: number; books: number; movies: number };
  countsUnknown: boolean;
  shareVibeCard: (text: string, type: "vibe" | "deep") => void;
  vibe: ReturnType<typeof useVibecheck>;
  deepVibe: ReturnType<typeof useDeepVibe>;
}) {
  return (
          <div className="card">
            <div className="card-title">вайбчек</div>
            <div className="vibe-section vibe-blue">
              <div className="vibe-helper">
                {countsUnknown
                  ? "считаем, что у тебя в библиотеке..."
                  : `сейчас в библиотеке ${counts.total}: музыка ${counts.music}, книги ${counts.books}, фильмы ${counts.movies}.`}
              </div>
              <div className="vibe-meta">
                быстрый вайбчек — это короткая прожарка по неожиданным сочетаниям в библиотеке.
              </div>
              <button
                className="btn btn-outline"
                style={{ background: "#ffffff", borderColor: "#ffffff" }}
                onClick={vibe.runVibeCheck}
                disabled={vibe.vibeLoading || countsUnknown || counts.total === 0}
              >
                {vibe.vibeLoading
                  ? "анализирую..."
                  : countsUnknown
                    ? "загружаем библиотеку..."
                    : counts.total === 0
                    ? "сначала добавь контент"
                    : vibe.summary || vibe.vibeDuel
                      ? "ещё раз!"
                      : "провести вайбчек"}
              </button>
            </div>

            {vibe.vibeError && <div className="error">{vibe.vibeError}</div>}
            {vibe.vibeDuel && (
              <div className="vibe-section vibe-pink">
                <div className="card-title" style={{ marginBottom: 4 }}>какой точнее?</div>
                <div className="vibe-helper" style={{ marginBottom: 12 }}>
                  сегодня два варианта. выбери тот, что ближе — второй мы больше не покажем.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {vibe.vibeDuel.variants.map((variant, index) => (
                    <div key={variant.runId ?? index} style={{ background: "#fff", borderRadius: 12, padding: 14 }}>
                      <VibeResult summary={variant.summary} />
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ width: "100%", marginTop: 10 }}
                        onClick={() => void vibe.pickDuelWinner(variant)}
                      >
                        выбрать этот
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {vibe.summary && (
              <div className="vibe-section vibe-pink">
                <div className="card-title" style={{ marginBottom: 10 }}>свежий срез</div>
                <VibeResult summary={vibe.summary} />
                <button
                  className="btn btn-outline"
                  style={{marginTop:12,fontSize:13,display:"flex",alignItems:"center",gap:6,width:"100%"}}
                  onClick={() => shareVibeCard(vibe.summary, "vibe")}
                >
                  ↗ поделиться вайбчеком
                </button>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => void vibe.rateVibeCheck("good")} disabled={Boolean(vibe.vibeFeedback)}>
                    {vibe.vibeFeedback === "good" ? "запомнили" : "нормально"}
                  </button>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => void vibe.rateVibeCheck("bad")} disabled={Boolean(vibe.vibeFeedback)}>
                    {vibe.vibeFeedback === "bad" ? "перепишем" : "плохо"}
                  </button>
                </div>
              </div>
            )}

            <button
              className="btn btn-outline"
              style={{marginTop: 12}}
              onClick={vibe.runMentalAge}
              disabled={vibe.mentalAgeLoading || countsUnknown || counts.total === 0}
            >
              {vibe.mentalAgeLoading ? "считаю..." : "рассчитать ментальный возраст"}
            </button>

            {vibe.mentalAge && (
              <div style={{marginTop:16,padding:"16px",background:"#fff",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                {vibe.mentalAge.split("\n").map((line, i) => (
                  <div key={i} style={{
                    fontFamily: i === 0 ? "'Unbounded', sans-serif" : "inherit",
                    fontWeight: i === 0 ? 700 : 400,
                    fontSize: i === 0 ? 18 : 14,
                    color: i === 0 ? "#1a1a1a" : "#555",
                    marginTop: i === 0 ? 0 : 8,
                    lineHeight: 1.5,
                  }}>{line}</div>
                ))}
              </div>
            )}

            {false && <div className="vibe-section vibe-green">
              <div className="card-title" style={{ marginBottom: 10 }}>вайбчек без прикола</div>
              <div className="vibe-helper">
                серьезный срез периода: что у тебя сейчас по темам, эмоциональному фону и куда все это движется.
              </div>

              {/* Кнопка запуска — если есть доступ */}
              {(deepVibe.deepVibeAccess === "free" || deepVibe.deepVibeAccess === "forever" || deepVibe.deepVibeAccess === "paid") && (
                <div>
                  {deepVibe.deepVibeAccess === "free" && deepVibe.deepVibeUsesLeft !== null && (
                    <div style={{textAlign:"center",fontSize:12,color:"#aaa",marginBottom:10}}>
                      осталось бесплатных: {deepVibe.deepVibeUsesLeft} из 3
                    </div>
                  )}
                  {deepVibe.deepVibeAccess === "forever" && (
                    <div style={{textAlign:"center",fontSize:12,color:"#aaa",marginBottom:10}}>
                      вечный доступ
                    </div>
                  )}
                  <button
                    className="btn"
                    style={{background:"#1a1a1a",color:"#fff",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
                    onClick={deepVibe.runDeepVibe}
                    disabled={deepVibe.deepVibeLoading || counts.total === 0}
                  >
                    {deepVibe.deepVibeLoading ? "анализирую..." : "вайбчек без прикола"}
                  </button>
                </div>
              )}

              {/* Нет доступа — показываем кнопки покупки */}
              {deepVibe.deepVibeAccess === "none" && (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <button
                    className="btn"
                    style={{background:"#1a1a1a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
                    onClick={deepVibe.buyDeepVibeOnce}
                    disabled={counts.total === 0}
                  >
                    ✦ один анализ — 5 ★
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,borderColor:"#1a1a1a"}}
                    onClick={deepVibe.buyDeepVibeForever}
                    disabled={counts.total === 0}
                  >
                    ✦ вечный доступ — 200 ★
                  </button>
                  <div style={{fontSize:11,color:"#aaa",textAlign:"center"}}>оплата через Telegram Stars</div>
                </div>
              )}

              {/* Результат с markdown */}
              {deepVibe.deepVibeResult && (
                <div style={{marginTop:16,padding:"18px",background:"#fff",borderRadius:20,boxShadow:"0 1px 4px rgba(0,0,0,0.07)",fontSize:14,lineHeight:1.8,color:"#333"}}>
                  <MarkdownText text={deepVibe.deepVibeResult} />
                  <button
                    className="btn btn-outline"
                    style={{marginTop:14,fontSize:13,display:"flex",alignItems:"center",gap:6,width:"100%"}}
                    onClick={() => shareVibeCard(deepVibe.deepVibeResult, "deep")}
                  >
                    ↗ поделиться
                  </button>
                </div>
              )}
            </div>}

          </div>
        
  );
}
