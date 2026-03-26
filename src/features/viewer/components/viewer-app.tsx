import { useEffect, useState } from "react";
import { requestArchiveStats } from "../../runtime/client";
import type { ArchiveStats } from "../../../types/runtime";

const emptyStats: ArchiveStats = {
  posts: 0,
  threads: 0,
  tags: 0
};

export function ViewerApp() {
  const [stats, setStats] = useState<ArchiveStats>(emptyStats);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setStatus("loading");

      try {
        const response = await requestArchiveStats();

        if (!cancelled) {
          setStats(response.stats);
          setStatus("ready");
        }
      } catch (error) {
        console.error("Failed to load archive stats.", error);

        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="viewer-shell">
      <section className="viewer-panel">
        <p className="viewer-eyebrow">Foundation Snapshot</p>
        <h1 className="viewer-title">X post archive viewer groundwork</h1>
        <p className="viewer-copy">
          保存・検索・閲覧の本実装に進む前に、拡張の骨格、DB スキーマ、viewer の起動経路だけを整えた状態です。
        </p>

        <div className="viewer-grid">
          <StatCard label="Posts" value={stats.posts} />
          <StatCard label="Threads" value={stats.threads} />
          <StatCard label="Tags" value={stats.tags} />
        </div>

        <div className="viewer-notice">
          {status === "loading" && "IndexedDB の初期状態を確認しています。"}
          {status === "ready" && "Dexie 経由で DB に接続できる前提の viewer 初期画面です。"}
          {status === "error" && "viewer と background の接続確認に失敗しました。依存導入後に再確認してください。"}
        </div>
      </section>
    </main>
  );
}

type StatCardProps = {
  label: string;
  value: number;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <article className="viewer-card">
      <span className="viewer-card-label">{label}</span>
      <strong className="viewer-card-value">{value}</strong>
    </article>
  );
}

