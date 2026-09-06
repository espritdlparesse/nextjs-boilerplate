import type { DbItem } from "@/app/types";
import { useShareCard } from "@/app/hooks/useShareCard";
import { generateShareCard } from "@/lib/shareCard";

export function ShareModals({ share, items, fireAnalytics, shareRunId }: {
  share: ReturnType<typeof useShareCard>;
  items: DbItem[];
  fireAnalytics: (event: string, properties?: Record<string, unknown>) => void;
  shareRunId: string | null;
}) {
  const cardDataUrl = share.shareCardDataUrl;

  return (
    <>
      {share.showSharePicker && (
        <div
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",padding:"0 0 0 0"}}
          onClick={() => share.setShowSharePicker(false)}
        >
          <div
            style={{background:"#f5f0e8",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"80vh",display:"flex",flexDirection:"column"}}
            onClick={e => e.stopPropagation()}
          >
            <div style={{padding:"20px 20px 12px",borderBottom:"1px solid #e8e3da"}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>выбери что показать на карточке</div>
              <div style={{fontSize:12,color:"#888"}}>выбрано: {share.sharePickerSelected.size} из {items.length}</div>
            </div>

            {/* Фильтры по типу */}
            <div style={{display:"flex",gap:8,padding:"10px 20px",borderBottom:"1px solid #e8e3da"}}>
              {(["music","book","movie"] as const).map(t => {
                const typeItems = items.filter(i => i.type === t);
                const allSelected = typeItems.every(i => share.sharePickerSelected.has(i.id));
                return (
                  <button key={t} className={`filter-btn${allSelected ? " active" : ""}`}
                    onClick={() => {
                      const ids = typeItems.map(i => i.id);
                      share.setSharePickerSelected(prev => {
                        const next = new Set(prev);
                        if (allSelected) ids.forEach(id => next.delete(id));
                        else ids.forEach(id => next.add(id));
                        return next;
                      });
                    }}
                  >
                    {t === "music" ? "♫ музыка" : t === "book" ? "📖 книги" : "🎬 фильмы"}
                  </button>
                );
              })}
              <button className="filter-btn" style={{marginLeft:"auto"}}
                onClick={() => share.setSharePickerSelected(new Set(items.map(i => i.id)))}
              >все</button>
            </div>

            {/* Список айтемов */}
            <div style={{overflowY:"auto",flex:1,padding:"8px 0"}}>
              {items.map(item => {
                const selected = share.sharePickerSelected.has(item.id);
                return (
                  <div key={item.id}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"10px 20px",cursor:"pointer",background:selected?"#ede7d9":"transparent"}}
                    onClick={() => share.setSharePickerSelected(prev => {
                      const next = new Set(prev);
                      selected ? next.delete(item.id) : next.add(item.id);
                      return next;
                    })}
                  >
                    <div style={{width:20,height:20,borderRadius:4,border:"1.5px solid #ccc",background:selected?"#1a1a1a":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {selected && <span style={{color:"#fff",fontSize:12}}>✓</span>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title}</div>
                      {item.creator && <div style={{fontSize:12,color:"#888",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.creator}</div>}
                    </div>
                    <div style={{fontSize:11,color:"#aaa",flexShrink:0}}>{item.type === "music" ? "♫" : item.type === "book" ? "📖" : "🎬"}</div>
                  </div>
                );
              })}
            </div>

            {/* Кнопка генерации */}
            <div style={{padding:"16px 20px 32px",borderTop:"1px solid #e8e3da"}}>
              <button
                className="btn"
                style={{background:"#1a1a1a",color:"#fff",width:"100%"}}
                disabled={share.sharePickerSelected.size === 0}
                onClick={async () => {
                  share.setShowSharePicker(false);
                  const selectedItems = items.filter(i => share.sharePickerSelected.has(i.id));
                  const dataUrl = await generateShareCard(items, share.sharePickerText, share.sharePickerType, selectedItems.length > 0 ? selectedItems : undefined);
                  share.setShareCardDataUrl(dataUrl);
                  share.setShowShareCard(true);
                }}
              >
                сгенерировать карточку →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Card Modal */}
      {share.showShareCard && cardDataUrl && (
        <div
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}
          onClick={() => share.setShowShareCard(false)}
        >
          <div
            style={{background:"#f5f0e8",borderRadius:20,overflow:"hidden",width:"100%",maxWidth:400,boxShadow:"0 8px 40px rgba(0,0,0,0.4)"}}
            onClick={e => e.stopPropagation()}
          >
            <img src={cardDataUrl} style={{width:"100%",display:"block"}} alt="share card" />
            <div style={{padding:"16px 20px 20px",display:"flex",flexDirection:"column",gap:10}}>
              <button
                className="btn"
                style={{background:"#1a1a1a",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
                onClick={async () => {
                  const res = await fetch(cardDataUrl);
                  const blob = await res.blob();
                  const file = new File([blob], "everyyou.png", { type: "image/png" });
                  if (navigator.share && navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file], text: "t.me/every_you_bot" });
                  } else {
                    const a = document.createElement("a");
                    a.href = cardDataUrl; a.download = "everyyou.png"; a.click();
                  }
                  fireAnalytics("vibecheck_shared", { runId: shareRunId, type: share.sharePickerType ?? null });
                }}
              >
                ↗ поделиться
              </button>
              <button
                className="btn btn-outline"
                style={{fontSize:13}}
                onClick={async () => {
                  const res = await fetch(cardDataUrl);
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob); a.download = "everyyou.png"; a.click();
                }}
              >
                ↓ сохранить в галерею
              </button>
              <button
                className="btn btn-outline"
                style={{fontSize:13,color:"#999",borderColor:"#ddd"}}
                onClick={() => share.setShowShareCard(false)}
              >
                закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
