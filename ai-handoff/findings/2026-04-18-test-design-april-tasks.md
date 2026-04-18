# Finding Note: テスト設計 — 2026-04-18 実装4タスク

## Topic

2026-04-18 に実装された下記4タスクのテスト設計。

1. タグ付けパフォーマンス改善（use-tag-operations.ts）
2. 動画ループ再生（media-lightbox.tsx）
3. バックアップ復元マージ/置き換え（archive-maintenance-service.ts）
4. 重複自動停止上限 999（archive.ts）

テスト基盤は未設定のため、以下の2層で設計する:

- **Unit / Integration テストコード** — Vitest + @testing-library/react を想定したスタブ。将来フレームワーク導入時にそのまま使える
- **Manual ブラウザ手順** — 即時検証のための操作手順

---

## Task 1: タグ付けパフォーマンス改善

### 変更の要点

`handleAddTagToPost` は `response.ok` のとき `updatePostTags`（局所更新）+ `refreshArchiveMetadata` を呼ぶ。`reloadCurrentArchive`（全件再ロード）は呼ばない。
`handleRemoveTagFromPost` は `activeTagFilter === normalizedName` のとき `removePostFromCurrentPage` を、それ以外は `updatePostTags` でフィルタ除去する。

### Unit テストコード（純粋関数 `addOrReplaceTag`）

```typescript
// src/features/viewer/components/use-tag-operations.test.ts
import { describe, expect, it } from "vitest";
// addOrReplaceTag は内部関数なので、テスト用にエクスポートするか
// use-tag-operations.ts の末尾に export { addOrReplaceTag } を追加する

import { addOrReplaceTag } from "./use-tag-operations";
import type { ArchiveTagRecord, PostTagRecord } from "../../../types/archive";

function mockPostTag(overrides: Partial<PostTagRecord> = {}): PostTagRecord {
  return {
    id: "pt-1",
    x_post_id: "post-1",
    tag_id: "tag-1",
    normalized_name: "foo",
    display_name: "Foo",
    system_key: null,
    source: "manual",
    assigned_at: Date.now(),
    ...overrides
  };
}

function mockArchiveTag(overrides: Partial<ArchiveTagRecord> = {}): ArchiveTagRecord {
  return {
    tag_id: "tag-1",
    normalized_name: "foo",
    display_name: "Foo",
    system_key: null,
    source: "manual",
    ...overrides
  };
}

describe("addOrReplaceTag", () => {
  it("空配列に対して新しいタグを追加する", () => {
    const result = addOrReplaceTag([], mockPostTag({ normalized_name: "foo" }));
    expect(result).toHaveLength(1);
    expect(result[0].normalized_name).toBe("foo");
  });

  it("同じ normalized_name が存在するとき既存エントリを置き換える", () => {
    const existing: ArchiveTagRecord[] = [
      mockArchiveTag({ normalized_name: "foo", display_name: "Old" })
    ];
    const result = addOrReplaceTag(
      existing,
      mockPostTag({ normalized_name: "foo", display_name: "New" })
    );
    expect(result).toHaveLength(1);
    expect(result[0].display_name).toBe("New");
  });

  it("異なる normalized_name は末尾に追加する", () => {
    const existing: ArchiveTagRecord[] = [mockArchiveTag({ normalized_name: "foo" })];
    const result = addOrReplaceTag(
      existing,
      mockPostTag({ normalized_name: "bar" })
    );
    expect(result).toHaveLength(2);
    expect(result[1].normalized_name).toBe("bar");
  });

  it("元の配列を変更しない（イミュータブル）", () => {
    const existing: ArchiveTagRecord[] = [mockArchiveTag({ normalized_name: "foo" })];
    addOrReplaceTag(existing, mockPostTag({ normalized_name: "bar" }));
    expect(existing).toHaveLength(1);
  });
});
```

### Integration テストコード（hook の振る舞い）

```typescript
// src/features/viewer/components/use-tag-operations.test.ts (続き)
import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTagOperations } from "./use-tag-operations";
import * as client from "../../runtime/client";

vi.mock("../../runtime/client");

const defaultProps = {
  activeTagFilter: null,
  posts: [],
  refreshArchiveMetadata: vi.fn().mockResolvedValue(undefined),
  removePostFromCurrentPage: vi.fn(),
  reloadCurrentArchive: vi.fn().mockResolvedValue(undefined),
  updatePostTags: vi.fn()
};

describe("handleAddTagToPost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("displayName が空のとき何もしない", async () => {
    const { result } = renderHook(() => useTagOperations(defaultProps));
    await act(() => result.current.handleAddTagToPost("post-1", "   "));
    expect(client.requestAddPostTagByName).not.toHaveBeenCalled();
  });

  it("response.ok のとき updatePostTags を呼び reloadCurrentArchive は呼ばない", async () => {
    vi.mocked(client.requestAddPostTagByName).mockResolvedValue({
      ok: true,
      postTag: mockPostTag()
    });
    const props = { ...defaultProps };
    const { result } = renderHook(() => useTagOperations(props));
    await act(() => result.current.handleAddTagToPost("post-1", "foo"));

    expect(props.updatePostTags).toHaveBeenCalledWith("post-1", expect.any(Function));
    expect(props.refreshArchiveMetadata).toHaveBeenCalled();
    expect(props.reloadCurrentArchive).not.toHaveBeenCalled();
  });

  it("response.ok が false のとき reloadCurrentArchive を呼ぶ", async () => {
    vi.mocked(client.requestAddPostTagByName).mockResolvedValue({ ok: false });
    const props = { ...defaultProps };
    const { result } = renderHook(() => useTagOperations(props));
    await act(() => result.current.handleAddTagToPost("post-1", "foo"));

    expect(props.updatePostTags).not.toHaveBeenCalled();
    expect(props.reloadCurrentArchive).toHaveBeenCalled();
  });
});

describe("handleRemoveTagFromPost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("activeTagFilter と一致するタグを削除したとき removePostFromCurrentPage を呼ぶ", async () => {
    vi.mocked(client.requestRemovePostTagByName).mockResolvedValue(undefined);
    const props = { ...defaultProps, activeTagFilter: "foo" };
    const { result } = renderHook(() => useTagOperations(props));
    await act(() => result.current.handleRemoveTagFromPost("post-1", "foo"));

    expect(props.removePostFromCurrentPage).toHaveBeenCalledWith("post-1");
    expect(props.updatePostTags).not.toHaveBeenCalled();
    expect(props.refreshArchiveMetadata).toHaveBeenCalled();
  });

  it("activeTagFilter と一致しないタグを削除したとき updatePostTags を呼ぶ", async () => {
    vi.mocked(client.requestRemovePostTagByName).mockResolvedValue(undefined);
    const props = { ...defaultProps, activeTagFilter: "bar" };
    const { result } = renderHook(() => useTagOperations(props));
    await act(() => result.current.handleRemoveTagFromPost("post-1", "foo"));

    expect(props.updatePostTags).toHaveBeenCalledWith("post-1", expect.any(Function));
    expect(props.removePostFromCurrentPage).not.toHaveBeenCalled();
    expect(props.refreshArchiveMetadata).toHaveBeenCalled();
  });

  it("updatePostTags に渡された関数は対象タグを配列から除外する", async () => {
    vi.mocked(client.requestRemovePostTagByName).mockResolvedValue(undefined);
    let capturedUpdater: ((tags: ArchiveTagRecord[]) => ArchiveTagRecord[]) | null = null;
    const props = {
      ...defaultProps,
      activeTagFilter: "bar",
      updatePostTags: vi.fn((_id, updater) => {
        capturedUpdater = updater;
      })
    };
    const { result } = renderHook(() => useTagOperations(props));
    await act(() => result.current.handleRemoveTagFromPost("post-1", "foo"));

    const tags = [mockArchiveTag({ normalized_name: "foo" }), mockArchiveTag({ normalized_name: "bar" })];
    const filtered = capturedUpdater!(tags);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].normalized_name).toBe("bar");
  });
});
```

### Manual ブラウザ手順

```
前提: 投稿が 100 件以上ある状態でビューアを開く

[TC-TAG-1] タグ追加で全件再ロードが発生しないこと
  1. フィルタなしで投稿一覧を表示する
  2. 任意の投稿の「タグを追加」を開いて新しいタグ名を入力し確定する
  3. ページ全体のローディングスピナーが出ないことを確認する
  4. タグが追加された投稿のタグ欄にすぐ反映されることを確認する

[TC-TAG-2] タグフィルタ中に対象タグを削除すると投稿がリストから消えること
  1. タグ "foo" でフィルタを適用する
  2. フィルタ中の任意の投稿から "foo" タグを削除する
  3. その投稿がリストから即座に消えることを確認する
  4. ページ全体の再ロードが発生しないことを確認する

[TC-TAG-3] 別タグのフィルタ中に無関係タグを削除してもリストが変わらないこと
  1. タグ "bar" でフィルタを適用する
  2. 任意の投稿から "foo" タグを削除する
  3. 投稿はリストに残り、タグ欄から "foo" だけ消えることを確認する
```

---

## Task 2: 動画ループ再生

### Unit テストコード（DOM 検証）

```typescript
// src/features/viewer/components/media-lightbox.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { VideoLightboxDialog } from "./media-lightbox";
import { createRef } from "react";
import type { MediaRecord } from "../../../types/archive";

function mockMediaRecord(overrides: Partial<MediaRecord> = {}): MediaRecord {
  return {
    media_id: "m-1",
    x_post_id: "post-1",
    media_type: "video",
    opfs_path: "videos/m-1.mp4",
    mime_type: "video/mp4",
    width: 1280,
    height: 720,
    alt_text: null,
    file_size: null,
    checksum: null,
    storage_status: "ready",
    last_error: null,
    created_at: Date.now(),
    ...overrides
  };
}

describe("VideoLightboxDialog", () => {
  it("<video> 要素に loop 属性が設定されている", () => {
    const { container } = render(
      <VideoLightboxDialog
        activeVideo={{
          media: mockMediaRecord(),
          objectUrl: "blob:http://localhost/fake",
          status: "ready"
        }}
        language="ja"
        closeButtonRef={createRef()}
        dialogRef={createRef()}
        onClose={vi.fn()}
      />
    );
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video!.loop).toBe(true);
  });

  it("<video> 要素に autoPlay 属性も残っている", () => {
    const { container } = render(
      <VideoLightboxDialog
        activeVideo={{
          media: mockMediaRecord(),
          objectUrl: "blob:http://localhost/fake",
          status: "ready"
        }}
        language="ja"
        closeButtonRef={createRef()}
        dialogRef={createRef()}
        onClose={vi.fn()}
      />
    );
    const video = container.querySelector("video");
    expect(video!.autoplay).toBe(true);
  });
});
```

### Manual ブラウザ手順

```
前提: 動画付きの投稿が保存済みであること

[TC-VIDEO-1] 動画終了後に自動で先頭から再生されること
  1. 動画付き投稿のサムネイルをクリックしてライトボックスを開く
  2. 動画が再生されることを確認する
  3. 動画が終端に達したとき、停止せず自動的に先頭から再生が始まることを確認する

[TC-VIDEO-2] ループ中も controls が操作できること
  1. ループ再生中にシークバーをドラッグしてシークできることを確認する
  2. 一時停止・再生が正常に動作することを確認する
```

---

## Task 3: バックアップ復元マージ/置き換え

### Unit テストコード（`normalizeImportArchiveBackupOptions`）

```typescript
// src/features/archive/archive-maintenance-service.test.ts
import { describe, it, expect, vi } from "vitest";
// normalizeImportArchiveBackupOptions は内部関数なので export が必要
import { normalizeImportArchiveBackupOptions } from "./archive-maintenance-service";

describe("normalizeImportArchiveBackupOptions", () => {
  it("undefined のとき mode=replace, onProgress=undefined を返す", () => {
    expect(normalizeImportArchiveBackupOptions(undefined)).toEqual({
      mode: "replace",
      onProgress: undefined
    });
  });

  it("function を渡したとき mode=replace, onProgress=fn を返す（後方互換）", () => {
    const fn = vi.fn();
    const result = normalizeImportArchiveBackupOptions(fn);
    expect(result.mode).toBe("replace");
    expect(result.onProgress).toBe(fn);
  });

  it("{mode: 'merge'} のとき mode=merge を返す", () => {
    expect(normalizeImportArchiveBackupOptions({ mode: "merge" })).toEqual({
      mode: "merge",
      onProgress: undefined
    });
  });

  it("{mode: 'replace', onProgress: fn} のとき両方返す", () => {
    const fn = vi.fn();
    const result = normalizeImportArchiveBackupOptions({ mode: "replace", onProgress: fn });
    expect(result.mode).toBe("replace");
    expect(result.onProgress).toBe(fn);
  });
});
```

### Manual ブラウザ手順

```
[TC-RESTORE-1] 置き換えモード: 既存データが削除されて ZIP で上書きされること
  準備:
    a. 投稿を 5 件保存する
    b. バックアップ ZIP を書き出す（この時点の 5 件が ZIP に入る）
    c. さらに 3 件保存する（計 8 件）
  手順:
    1. 設定 > バックアップから復元 を開く
    2. 復元モードで「置き換え」を選択する
    3. 手順 b の ZIP を選択して復元する
  期待結果:
    - 投稿数が 5 件に戻っている（手順 c で追加した 3 件は消える）
    - タグ・メディアも ZIP の内容だけになっている

[TC-RESTORE-2] マージモード: 既存データを残して ZIP の内容が追加されること
  準備:
    a. 投稿を 5 件保存し、バックアップ ZIP を書き出す
    b. 5 件のうち 2 件を削除し、新規 3 件を追加する（計 6 件）
  手順:
    1. 設定 > バックアップから復元 を開く
    2. 復元モードで「マージ」を選択する
    3. 手順 a の ZIP を選択して復元する
  期待結果:
    - 投稿数が 8 件（元 5 件 + 新規 3 件、重複分は追加されない）
    - 手順 b で削除した 2 件が復元されている
    - 手順 b で追加した 3 件も残っている

[TC-RESTORE-3] マージモード: 重複投稿が上書きされないこと
  準備:
    a. 投稿 A を保存し、バックアップ ZIP を書き出す
    b. 投稿 A のタグを追加・変更する（DB の状態を ZIP と変える）
  手順:
    1. マージモードで手順 a の ZIP を復元する
  期待結果:
    - 投稿 A は手順 b の状態（タグ付き）が保持されている
    - ZIP 内の旧状態で上書きされていない

[TC-RESTORE-4] マージモードでは確認ダイアログが出ないこと
  1. マージモードを選択して復元ボタンを押す
  2. window.confirm が表示されないことを確認する

[TC-RESTORE-5] 置き換えモードでは確認ダイアログが出ること
  1. 置き換えモードを選択して復元ボタンを押す
  2. window.confirm が表示されることを確認する
```

---

## Task 4: 重複自動停止上限 999

### Unit テストコード（定数検証）

```typescript
// src/types/archive.test.ts
import { describe, it, expect } from "vitest";
import {
  MAX_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD,
  MIN_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD,
  DEFAULT_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD
} from "./archive";

describe("bulk import duplicate threshold constants", () => {
  it("MAX は 999 である", () => {
    expect(MAX_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD).toBe(999);
  });

  it("MIN は 1 である（変更なし）", () => {
    expect(MIN_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD).toBe(1);
  });

  it("DEFAULT は MIN 以上 MAX 以下である", () => {
    expect(DEFAULT_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD).toBeGreaterThanOrEqual(
      MIN_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD
    );
    expect(DEFAULT_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD).toBeLessThanOrEqual(
      MAX_BULK_IMPORT_DUPLICATE_BATCH_THRESHOLD
    );
  });
});
```

### UI テストコード（input[max] 属性）

```typescript
// src/features/viewer/components/settings-basic-panel.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { SettingsBasicPanel } from "./settings-basic-panel";
import { defaultArchiveSettings } from "../../../types/archive";

describe("SettingsBasicPanel — duplicate threshold input", () => {
  it("max 属性が 999 である", () => {
    const { container } = render(
      <SettingsBasicPanel
        language="en"
        archiveSettings={defaultArchiveSettings}
        onArchiveSettingsChange={vi.fn()}
      />
    );
    // 数値入力を特定する（aria-label か data-testid で取得推奨）
    const inputs = container.querySelectorAll("input[type='number']");
    const thresholdInput = [...inputs].find(
      (el) => (el as HTMLInputElement).min === "1"
    ) as HTMLInputElement | undefined;

    expect(thresholdInput).not.toBeUndefined();
    expect(thresholdInput!.max).toBe("999");
  });
});
```

### Manual ブラウザ手順

```
[TC-DUP-1] 設定画面で 999 まで入力できること
  1. 設定 > 基本設定 を開く
  2. 「重複自動停止しきい値」の入力欄に 999 を入力する
  3. 値が 999 で保存されることを確認する

[TC-DUP-2] 1000 は入力できない（クランプされること）
  1. 入力欄に 1000 を入力してフォーカスを外す
  2. 値が 999 にクランプされることを確認する（またはブラウザが 999 に丸める）

[TC-DUP-3] 保存した設定が一括取り込みに反映されること
  1. しきい値を 999 に設定して保存する
  2. likes または bookmarks ページで一括取り込みを開始する
  3. 重複のみのバッチが 999 回連続するまで停止しないことを（取り込み件数が少ない場合は完了まで停止しないことを）確認する
```

---

## Conclusion

| タスク | 純粋関数 UT | hook/DOM テスト | Manual 手順数 |
|---|---|---|---|
| タグ付けパフォーマンス | `addOrReplaceTag` 4ケース | `useTagOperations` 6ケース | 3 |
| 動画ループ | — | `VideoLightboxDialog` 2ケース | 2 |
| マージ/置き換え | `normalizeImportArchiveBackupOptions` 4ケース | — | 5 |
| 重複上限 999 | 定数 3ケース | input[max] 1ケース | 3 |

**テストフレームワーク導入時の推奨構成:**
- Vitest + @testing-library/react + jsdom
- `addOrReplaceTag`、`normalizeImportArchiveBackupOptions` は現時点で内部関数なので、各ファイルから named export する必要がある

## Confidence

high（実装コードを直接読んで設計）

## Evidence

- `src/features/viewer/components/use-tag-operations.ts`（Codex 変更後）
- `src/features/viewer/components/media-lightbox.tsx`（`loop` 追加確認）
- `src/features/archive/archive-maintenance-service.ts`（`mergeArchiveDatabaseRecords` 実装確認）
- `src/types/archive.ts`（`MAX = 999` 確認）

## Rejected Hypotheses

- 「マージ時に既存タグIDを使って post_tags を追加する」実装が省略されている可能性 → `buildResolvedTagRecords` で `tagByBackupId` マップを構築し `collectNewPostTags` に渡しているため対応済みと判断

## Suggested Action For Codex

- `addOrReplaceTag` を `use-tag-operations.ts` から `export` して UT を追加する（1行変更）
- `normalizeImportArchiveBackupOptions` を `archive-maintenance-service.ts` から `export` して UT を追加する（1行変更）
- 上記 export 追加は既存の動作に影響しない
