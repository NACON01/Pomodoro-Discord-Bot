# ポモドーロタイマー Discord Bot

Discord上でポモドーロテクニックを実践できるBotです。

## 機能

- ⏰ カスタマイズ可能なポモドーロタイマー
- 🔊 音声チャンネルでの通知音再生
- 💬 チャットでの通知メッセージ
- ⏸️ 一時停止・再開機能
- ⏱️ 時間延長機能
- 🔄 自動的な作業・休憩サイクル
- 🎵 カスタム通知音対応

## セットアップ手順

### 1. Discord Developer Portal でアプリケーションを作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」をクリック
3. アプリケーション名を入力（例：Pomodoro Timer）
4. 「Create」をクリック

### 2. Botを作成

1. 左サイドバーの「Bot」をクリック
2. 「Add Bot」をクリック
3. 「Yes, do it!」で確認
4. Botトークンをコピーして保存（後で使用）

### 3. Bot権限を設定

「Bot」セクションで以下の権限を有効にする：
- Send Messages
- Use Slash Commands
- Connect (音声チャンネル用)
- Speak (音声チャンネル用)

### 4. OAuth2 URLを生成

1. 左サイドバーの「OAuth2」→「URL Generator」をクリック
2. Scopesで「bot」と「applications.commands」を選択
3. Bot Permissionsで必要な権限を選択：
   - Send Messages
   - Use Slash Commands
   - Connect
   - Speak
4. 生成されたURLをコピー

### 5. Botをサーバーに招待

1. 生成したURLをブラウザで開く
2. Botを追加したいサーバーを選択
3. 「認証」をクリック

## ローカル実行

### 必要な環境

- Node.js 18以上
- FFmpeg（音声再生用）

### インストール

\`\`\`bash
npm install
\`\`\`

### 環境変数設定

`.env`ファイルを作成：

\`\`\`
DISCORD_BOT_TOKEN=your_bot_token_here
\`\`\`

### 通知音ファイルの配置

`sounds`フォルダを作成し、以下のファイルを配置：

- `default.mp3` - デフォルト通知音
- `{ユーザーID}.mp3` - ユーザー個別の通知音（オプション）

### 実行

\`\`\`bash
npm start
\`\`\`

## ホスティング方法

### Railway でのホスティング

1. [Railway](https://railway.app) にアカウント作成
2. 「New Project」→「Deploy from GitHub repo」
3. リポジトリを選択
4. 環境変数 `DISCORD_BOT_TOKEN` を設定
5. デプロイ

### Heroku でのホスティング

1. Heroku アカウント作成
2. Heroku CLI をインストール
3. プロジェクトフォルダで以下を実行：

\`\`\`bash
heroku create your-pomodoro-bot
heroku config:set DISCORD_BOT_TOKEN=your_token_here
git push heroku main
\`\`\`

### VPS でのホスティング

1. VPS（Ubuntu等）を準備
2. Node.js とFFmpegをインストール
3. プロジェクトをクローン
4. PM2で常駐化：

\`\`\`bash
npm install -g pm2
pm2 start bot.js --name pomodoro-bot
pm2 startup
pm2 save
\`\`\`

## 使用方法

### コマンド

- `/pomodoro` - ポモドーロタイマーを開始
  - `work_time`: 作業時間（分、デフォルト25分）
  - `break_time`: 休憩時間（分、デフォルト5分）
  - `notification_interval`: 通知間隔（分、デフォルト1分）

- `/pomodoro_stop` - タイマーを停止
- `/pomodoro_status` - 現在の状態を表示

### 基本的な使い方

1. 音声チャンネルに参加
2. `/pomodoro` コマンドを実行
3. 作業時間終了時に通知が来る
4. 「停止」ボタンで通知を止める
5. 「休憩開始」ボタンで休憩時間開始
6. 休憩終了後、「作業開始」で次のサイクル

### カスタム通知音

`sounds/{ユーザーID}.mp3` ファイルを配置することで、個人用の通知音を設定できます。

## トラブルシューティング

### 音声が再生されない

- FFmpegがインストールされているか確認
- Botに音声チャンネルの権限があるか確認
- 通知音ファイルが正しく配置されているか確認

### コマンドが表示されない

- Botに「Use Slash Commands」権限があるか確認
- Botが正常に起動しているか確認

## 注意事項

- 長時間の実行には安定したホスティング環境が必要
- 音声ファイルはmp3形式のみ対応
- 同時に複数のポモドーロセッションは実行できません
