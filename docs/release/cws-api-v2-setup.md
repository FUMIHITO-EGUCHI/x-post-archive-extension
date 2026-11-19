# Chrome Web Store API v2 の設定

## 概要

Chrome Web Store API v2 で、GitHub Release と同じ ZIP をアップロードして審査に提出する。
Workload Identity Federation（WIF）で GitHub Actions の OIDC トークンから短命な Google アクセストークンを取得し、サービスアカウントの JSON 鍵を保管しない。

```text
vX.Y.Z タグ push → release: ビルド・ZIP・GitHub Release
                 → chrome-web-store environment で人間が承認
                 → publish-cws: WIF 認証 → ZIP アップロード → 審査提出
                 → Google の審査通過後に自動公開
手動 cws-status → 同じ environment で承認 → 読み取り専用の状態確認
```

## 前提

- Chrome Web Store に対象アイテムが作成済みで、Developer Dashboard を管理できること。
- Google Cloud プロジェクトで API 有効化、サービスアカウント、WIF と IAM の設定を行えること。
- GitHub リポジトリの environment と reviewers を設定できること。利用中の GitHub プランやリポジトリの公開範囲で必要な保護ルールが利用可能か確認する。
- 以下はリポジトリ ID `1192440497` と environment 名 `chrome-web-store` に信頼を限定する。別リポジトリに流用する場合は ID を確認して変更する。

## 1. GCP

Cloud Shell で対象のプロジェクト ID を設定し、以下を実行する。サービスアカウントにプロジェクトのロールは付与しない。

```bash
PROJECT_ID="your-project-id"
gcloud config set project "$PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA_EMAIL="cws-publisher@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable chromewebstore.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project="$PROJECT_ID"
gcloud iam service-accounts create cws-publisher --project="$PROJECT_ID" --display-name="Chrome Web Store publisher"
gcloud iam workload-identity-pools create github --project="$PROJECT_ID" --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc github-actions \
  --project="$PROJECT_ID" --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.environment=assertion.environment" \
  --attribute-condition='assertion.repository_id == "1192440497" && assertion.environment == "chrome-web-store"'
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT_ID" --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository_id/1192440497"
gcloud iam workload-identity-pools providers describe github-actions \
  --project="$PROJECT_ID" --location=global --workload-identity-pool=github --format='value(name)'
printf 'Service account: %s\n' "$SA_EMAIL"
```

最後の describe が返す完全なリソース名を `CWS_WIF_PROVIDER` に、表示されたメールアドレスを `CWS_SERVICE_ACCOUNT` に設定する。IAM の反映には時間がかかる場合がある。

## 2. Chrome Web Store Developer Dashboard

Developer Dashboard の Account セクションにサービスアカウントのメールを追加する。1 publisher に登録できるサービスアカウントは 1 つまで。Publisher ID は Publisher > Settings、Extension ID はアイテムの Package タブで確認する。

## 3. GitHub

リポジトリに environment `chrome-web-store` を作り、Required reviewers に自分を追加する。自分が起動した workflow を承認できるよう self-review を禁止しない。Deployment branches and tags は Selected にして、タグ `v*` とブランチ `master` を許可する。後者は手動の状態確認で使用する。

次を environment variables に設定する。いずれも秘密値ではないため secrets には置かない。

| 名前 | 値 |
| --- | --- |
| `CWS_WIF_PROVIDER` | 前節の provider の完全なリソース名 |
| `CWS_SERVICE_ACCOUNT` | サービスアカウントのメールアドレス |
| `CWS_PUBLISHER_ID` | Dashboard の Publisher ID |
| `CWS_EXTENSION_ID` | 対象拡張機能の ID |

## 4. 疎通確認

Actions → `cws-status` → Run workflow で `master` を選び、environment の承認後に summary の公開中バージョンを確認する。`gh workflow run cws-status.yml` でも起動できる。公開中の revision がない場合は `none` と表示される。

## 5. リリース時の流れ

タグを push すると `release` が ZIP を作成し GitHub Release を公開する。その後 `publish-cws` が承認待ちになる。承認すると同じ ZIP をアップロードし、`DEFAULT_PUBLISH` で審査に提出する。Google の審査を通過すると自動公開される。

## 6. 制約と失敗時の対処

- 審査中の提出がある場合は停止する。Dashboard で取り消すか審査完了を待ち、失敗したジョブを再実行する。
- Dashboard で visibility を変更した場合は一度手動公開が必要。
- API で新規アイテムは作成できない。先に Dashboard で作成する。
- 同じバージョンや低いバージョンは受け付けられない。同じ ZIP を Dashboard で先にアップロードしない。
- API v1.1 は 2026-10-15 に終了。WXT 0.20.11 同梱の publish-browser-extension 3.0.3 を使う `wxt submit` はこの用途には使えない。
- サービスアカウントの JSON 鍵を作成しない。
- `publish-cws` の失敗時も GitHub Release は既に存在する。原因を修正後、失敗したジョブだけ再実行する。

## 参考リンク

- [Chrome Web Store API v2](https://developer.chrome.com/blog/cws-api-v2)
- [Using the Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)
- [Service accounts](https://developer.chrome.com/docs/webstore/service-accounts)
- [google-github-actions/auth](https://github.com/google-github-actions/auth)
