# 📺 Vtuber Schedule Viewer (Web / GitHub Pages)

ホロライブ、にじさんじ、ぶいすぽっ！の配信予定・LIVE配信状況をまとめて確認できるWebアプリケーションです。  
GitHub Actions による定期自動スクレイピングと、GitHub Pages による高速・無料の静的ホスティングにより、PC・スマホを問わずいつでも最新の配信スケジュールを快適にチェックできます。

---

## ✨ 主な機能

- 🔴 **LIVE中配信の最上位表示**: 現在配信中の枠にLIVEバッジを表示し、一目で識別可能
- ⚡ **超高速タブ切り替え**: Hololive / Nijisanji / VSPO / ★ Favorites（お気に入り）
- 🔍 **リアルタイム検索 & フィルター**: 配信者名・タイトルでの即時絞り込み、LIVEのみ、本日のみ抽出
- ⭐ **お気に入り機能**: 推しのメンバーを ★ マークで登録。端末の `localStorage` に保存され、いつでも一覧確認
- 🔄 **自動更新 & 手動更新**: 3分 / 5分間隔での自動再取得、ワンタップ手動更新
- 📱 **スマホファースト**: モバイル画面に最適化されたレスポンシブデザイン（Tailwind CSS）
- 🌐 **マルチプラットフォームバッジ**: YouTube / Twitch を色分け表示

---

## 🛠 技術構成

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React
- **Backend / Scraper**: Python 3.11 (requests, BeautifulSoup4, lxml)
- **CI / CD**: GitHub Actions (30分間隔の定期実行 + mainブランチpush時)
- **Hosting**: GitHub Pages

---

## 🚀 ローカルでの動かし方

```bash
# 1. 依存ライブラリのインストール
npm install

# 2. 最新スケジュールの手動スクレイピング
python scripts/scrape.py

# 3. 開発サーバーの起動
npm run dev
```

---

## 📦 GitHub Pages への公開手順

1. GitHub 上で新規リポジトリ（例: `vtuber-schedule-viewer`）を作成
2. リポジトリ設定で GitHub Pages を有効化:
   - **Settings** > **Pages** > **Build and deployment**
   - **Source** を `GitHub Actions` に設定
3. 本プロジェクトをプッシュ:
   ```bash
   git remote add origin https://github.com/takimasa5516/vtuber-schedule-viewer.git
   git branch -M main
   git push -u origin main
   ```
4. GitHub Actions が自動で走り、数分後に `https://takimasa5516.github.io/vtuber-schedule-viewer/` で公開されます。
