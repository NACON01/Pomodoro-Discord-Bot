import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js"
import { joinVoiceChannel, createAudioPlayer, createAudioResource } from "@discordjs/voice"
import fs from "fs"
import path from "path"

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
})

// ポモドーロセッションを管理するMap
const pomodoroSessions = new Map()

// デフォルト設定
const DEFAULT_WORK_TIME = 25 // 分
const DEFAULT_BREAK_TIME = 5 // 分
const DEFAULT_NOTIFICATION_INTERVAL = 1 // 分

class PomodoroSession {
  constructor(userId, channelId, voiceChannelId, workTime, breakTime, notificationInterval) {
    this.userId = userId
    this.channelId = channelId
    this.voiceChannelId = voiceChannelId
    this.workTime = workTime * 60 * 1000 // ミリ秒に変換
    this.breakTime = breakTime * 60 * 1000
    this.notificationInterval = notificationInterval * 60 * 1000
    this.isWorking = true
    this.isPaused = false
    this.timer = null
    this.notificationTimer = null
    this.connection = null
    this.player = null
    this.startTime = Date.now()
    this.remainingTime = this.workTime
    this.cycle = 1
  }

  start() {
    this.startTime = Date.now()
    this.timer = setTimeout(() => {
      this.onTimerComplete()
    }, this.remainingTime)
  }

  pause() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.notificationTimer) {
      clearInterval(this.notificationTimer)
      this.notificationTimer = null
    }
    this.remainingTime -= Date.now() - this.startTime
    this.isPaused = true
  }

  resume() {
    this.isPaused = false
    this.start()
  }

  extend(minutes) {
    this.remainingTime += minutes * 60 * 1000
    if (this.timer) {
      clearTimeout(this.timer)
      this.start()
    }
  }

  async onTimerComplete() {
    const channel = client.channels.cache.get(this.channelId)

    if (this.isWorking) {
      // 作業時間終了
      await this.sendNotification(channel, "🍅 作業時間終了！", "お疲れ様でした！休憩時間を開始しますか？")
      await this.playNotificationSound()
      this.startNotificationLoop()
    } else {
      // 休憩時間終了
      await this.sendNotification(channel, "⏰ 休憩時間終了！", "次の作業セッションを開始しますか？")
      await this.playNotificationSound()
      this.startNotificationLoop()
    }
  }

  async sendNotification(channel, title, description) {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(this.isWorking ? 0xff6b6b : 0x4ecdc4)
      .addFields(
        { name: "サイクル", value: `${this.cycle}回目`, inline: true },
        {
          name: "次の時間",
          value: this.isWorking ? `休憩 ${this.breakTime / 60000}分` : `作業 ${this.workTime / 60000}分`,
          inline: true,
        },
      )

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("pomodoro_stop").setLabel("停止").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("pomodoro_extend_5").setLabel("+5分延長").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("pomodoro_extend_10").setLabel("+10分延長").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("pomodoro_next")
        .setLabel(this.isWorking ? "休憩開始" : "作業開始")
        .setStyle(ButtonStyle.Success),
    )

    await channel.send({ embeds: [embed], components: [row] })
  }

  async playNotificationSound() {
    if (!this.voiceChannelId) return

    try {
      const voiceChannel = client.channels.cache.get(this.voiceChannelId)
      if (!voiceChannel) return

      this.connection = joinVoiceChannel({
        channelId: this.voiceChannelId,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      })

      this.player = createAudioPlayer()

      // カスタム通知音があるかチェック
      const customSoundPath = path.join(process.cwd(), "sounds", `${this.userId}.mp3`)
      const defaultSoundPath = path.join(process.cwd(), "sounds", "default.mp3")

      let soundPath = defaultSoundPath
      if (fs.existsSync(customSoundPath)) {
        soundPath = customSoundPath
      }

      if (fs.existsSync(soundPath)) {
        const resource = createAudioResource(soundPath)
        this.player.play(resource)
        this.connection.subscribe(this.player)
      }
    } catch (error) {
      console.error("音声再生エラー:", error)
    }
  }

  startNotificationLoop() {
    this.notificationTimer = setInterval(async () => {
      await this.playNotificationSound()
    }, this.notificationInterval)
  }

  stopNotifications() {
    if (this.notificationTimer) {
      clearInterval(this.notificationTimer)
      this.notificationTimer = null
    }
    if (this.connection) {
      this.connection.destroy()
      this.connection = null
    }
  }

  switchPhase() {
    this.stopNotifications()
    this.isWorking = !this.isWorking
    this.remainingTime = this.isWorking ? this.workTime : this.breakTime

    if (this.isWorking) {
      this.cycle++
    }

    this.start()
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.stopNotifications()
    pomodoroSessions.delete(this.userId)
  }
}

// スラッシュコマンドの定義
const commands = [
  new SlashCommandBuilder()
    .setName("pomodoro")
    .setDescription("ポモドーロタイマーを開始します")
    .addIntegerOption((option) =>
      option.setName("work_time").setDescription("作業時間（分）").setMinValue(1).setMaxValue(120),
    )
    .addIntegerOption((option) =>
      option.setName("break_time").setDescription("休憩時間（分）").setMinValue(1).setMaxValue(60),
    )
    .addIntegerOption((option) =>
      option.setName("notification_interval").setDescription("通知間隔（分）").setMinValue(1).setMaxValue(10),
    ),

  new SlashCommandBuilder().setName("pomodoro_stop").setDescription("ポモドーロタイマーを停止します"),

  new SlashCommandBuilder().setName("pomodoro_status").setDescription("現在のポモドーロセッションの状態を表示します"),

  new SlashCommandBuilder()
    .setName("upload_sound")
    .setDescription("カスタム通知音をアップロードします（mp3ファイルを添付してください）"),
]

client.once("ready", async () => {
  console.log(`${client.user.tag} でログインしました！`)

  // soundsディレクトリを作成
  if (!fs.existsSync("sounds")) {
    fs.mkdirSync("sounds")
  }

  // デフォルト通知音を作成（実際の使用時は適切なmp3ファイルを配置）
  const defaultSoundPath = path.join(process.cwd(), "sounds", "default.mp3")
  if (!fs.existsSync(defaultSoundPath)) {
    console.log("デフォルト通知音ファイル (sounds/default.mp3) を配置してください")
  }

  // スラッシュコマンドを登録
  try {
    await client.application.commands.set(commands)
    console.log("スラッシュコマンドを登録しました")
  } catch (error) {
    console.error("スラッシュコマンドの登録に失敗しました:", error)
  }
})

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const { commandName, user, channel, member } = interaction

    if (commandName === "pomodoro") {
      // 既存のセッションがあるかチェック
      if (pomodoroSessions.has(user.id)) {
        await interaction.reply("既にポモドーロセッションが実行中です。先に停止してください。")
        return
      }

      const workTime = interaction.options.getInteger("work_time") || DEFAULT_WORK_TIME
      const breakTime = interaction.options.getInteger("break_time") || DEFAULT_BREAK_TIME
      const notificationInterval =
        interaction.options.getInteger("notification_interval") || DEFAULT_NOTIFICATION_INTERVAL

      // ユーザーがボイスチャンネルにいるかチェック
      const voiceChannelId = member.voice.channelId

      const session = new PomodoroSession(
        user.id,
        channel.id,
        voiceChannelId,
        workTime,
        breakTime,
        notificationInterval,
      )

      pomodoroSessions.set(user.id, session)
      session.start()

      const embed = new EmbedBuilder()
        .setTitle("🍅 ポモドーロタイマー開始！")
        .setDescription("作業時間が開始されました。集中して頑張りましょう！")
        .setColor(0xff6b6b)
        .addFields(
          { name: "作業時間", value: `${workTime}分`, inline: true },
          { name: "休憩時間", value: `${breakTime}分`, inline: true },
          { name: "通知間隔", value: `${notificationInterval}分`, inline: true },
        )

      await interaction.reply({ embeds: [embed] })
    } else if (commandName === "pomodoro_stop") {
      const session = pomodoroSessions.get(user.id)
      if (!session) {
        await interaction.reply("実行中のポモドーロセッションがありません。")
        return
      }

      session.stop()
      await interaction.reply("ポモドーロセッションを停止しました。")
    } else if (commandName === "pomodoro_status") {
      const session = pomodoroSessions.get(user.id)
      if (!session) {
        await interaction.reply("実行中のポモドーロセッションがありません。")
        return
      }

      const elapsed = Date.now() - session.startTime
      const remaining = Math.max(0, session.remainingTime - elapsed)
      const remainingMinutes = Math.ceil(remaining / 60000)

      const embed = new EmbedBuilder()
        .setTitle("📊 ポモドーロセッション状態")
        .setColor(session.isWorking ? 0xff6b6b : 0x4ecdc4)
        .addFields(
          { name: "現在の状態", value: session.isWorking ? "🍅 作業中" : "☕ 休憩中", inline: true },
          { name: "残り時間", value: `${remainingMinutes}分`, inline: true },
          { name: "サイクル", value: `${session.cycle}回目`, inline: true },
          { name: "一時停止中", value: session.isPaused ? "はい" : "いいえ", inline: true },
        )

      await interaction.reply({ embeds: [embed] })
    } else if (commandName === "upload_sound") {
      await interaction.reply("この機能は実装中です。現在はサーバーに直接mp3ファイルを配置してください。")
    }
  } else if (interaction.isButton()) {
    const { customId, user } = interaction
    const session = pomodoroSessions.get(user.id)

    if (!session) {
      await interaction.reply({ content: "セッションが見つかりません。", ephemeral: true })
      return
    }

    if (customId === "pomodoro_stop") {
      session.stopNotifications()
      await interaction.reply("通知を停止しました。")
    } else if (customId === "pomodoro_extend_5") {
      session.extend(5)
      await interaction.reply("5分延長しました。")
    } else if (customId === "pomodoro_extend_10") {
      session.extend(10)
      await interaction.reply("10分延長しました。")
    } else if (customId === "pomodoro_next") {
      session.switchPhase()
      const nextPhase = session.isWorking ? "作業" : "休憩"
      await interaction.reply(`${nextPhase}時間を開始しました！`)
    }
  }
})

// Botトークンでログイン
client.login(process.env.DISCORD_BOT_TOKEN)
