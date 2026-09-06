import { useEffect, useState } from "react";
import { getTgInitData } from "@/app/apiFetch";

const MAX_LABEL_BATCHES = 50;

function adminHeaders() {
  return { "x-telegram-init-data": (window as any).Telegram?.WebApp?.initData || "" };
}

async function labelBatch() {
  const res = await fetch("/api/admin/vibe-forms", { method: "POST", headers: adminHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `ошибка ${res.status}`);
  return json as { labeled: number; remaining: number };
}

function buttonLabel(running: boolean, unlabeled: number | null) {
  if (running) return "размечаю...";
  return unlabeled === 0 ? "всё размечено" : "разметить";
}

function FormLabelingPanel() {
  const [unlabeled, setUnlabeled] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/admin/vibe-forms?limit=1", { headers: adminHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setUnlabeled(json?.remaining ?? 0))
      .catch(() => undefined);
  }, []);

  async function run() {
    setRunning(true);
    setStatus("размечаю...");
    let labeled = 0;
    try {
      for (let batch = 0; batch < MAX_LABEL_BATCHES; batch += 1) {
        const result = await labelBatch();
        labeled += result.labeled;
        setUnlabeled(result.remaining);
        setStatus(`размечено ${labeled}, осталось ${result.remaining}`);
        if (!result.labeled || !result.remaining) return;
      }
      setStatus(`размечено ${labeled}, лимит за один заход исчерпан`);
    } catch (error: any) {
      setStatus(error?.message ?? "не удалось разметить");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{background:"#fff",borderRadius:12,padding:"16px",marginBottom:24,boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
      <div style={{fontSize:12,color:"#888",marginBottom:4}}>🏷 вайбчеков без разметки</div>
      <div style={{fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:22,marginBottom:10}}>
        {unlabeled ?? "—"}
      </div>
      <button
        className="btn btn-outline btn-sm"
        style={{width:"100%"}}
        onClick={() => void run()}
        disabled={running || unlabeled === 0}
      >
        {buttonLabel(running, unlabeled)}
      </button>
      {status && <div style={{fontSize:12,color:"#888",marginTop:8}}>{status}</div>}
    </div>
  );
}

export function AdminTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  useEffect(() => {
    async function load() {
      const headers = adminHeaders();
      try {
        const [statsRes, topRes] = await Promise.all([
          fetch("/api/admin/stats", { headers }),
          fetch("/api/admin/top", { headers }),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (topRes.ok) setTopUsers(await topRes.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div style={{padding:"32px",textAlign:"center",color:"#888"}}>загружаю...</div>;
  if (!stats) return <div style={{padding:"32px",textAlign:"center",color:"#888"}}>ошибка загрузки</div>;

  return (
    <div style={{padding:"24px 16px",maxWidth:480,margin:"0 auto"}}>
      <div style={{fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:18,marginBottom:24}}>статистика</div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
        {[
          ["👤 пользователей", stats.total_users],
          ["📦 айтемов всего", stats.total_items],
          ["🎵 музыка", stats.music],
          ["📚 книги", stats.books],
          ["🎬 фильмы", stats.movies],
          ["📅 за сегодня", stats.today],
        ].map(([label, val]) => (
          <div key={String(label)} style={{background:"#fff",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
            <div style={{fontSize:12,color:"#888",marginBottom:4}}>{label}</div>
            <div style={{fontFamily:"'Unbounded',sans-serif",fontWeight:700,fontSize:22}}>{val}</div>
          </div>
        ))}
      </div>

      <FormLabelingPanel />

      {topUsers.length > 0 && (
        <>
          <div style={{fontWeight:600,fontSize:13,color:"#888",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>топ пользователей</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {topUsers.map((u: any, i: number) => (
              <div key={u.tg_user_id} style={{background:"#fff",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.07)"}}>
                <span style={{color:"#888",fontSize:13}}>#{i+1} &nbsp;<span style={{color:"#1a1a1a",fontWeight:500}}>{u.tg_user_id}</span></span>
                <span style={{fontFamily:"'Unbounded',sans-serif",fontWeight:700}}>{u.count} айт.</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

