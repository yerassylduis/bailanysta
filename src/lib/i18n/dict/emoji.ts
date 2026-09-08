import type { Namespace } from "../index";

/** Пикер эмодзи, голосовые сообщения и звонок из чата. */
const emoji: Namespace = {
  ru: {
    title: "Эмодзи", recent: "Недавние", bailanysta: "Bailanysta", smileys: "Смайлы", gestures: "Жесты", hearts: "Сердца", nature: "Природа", food: "Еда", objects: "Предметы", symbols: "Символы",
    noRecent: "Здесь появятся эмодзи, которые вы выбирали.",
    voice: "Голосовое сообщение", recording: "Идёт запись", stopAndSend: "Остановить и отправить", cancelRecording: "Отменить запись", micDenied: "Нет доступа к микрофону",
    noRecorder: "Браузер не поддерживает запись голоса", voiceSent: "Голосовое отправлено", play: "Слушать", pause: "Пауза", speed: "Скорость",
    call: "Позвонить", callHint: "Аудио- или видеозвонок: в комнате выберите, что включить", callStarting: "Создаём звонок…", callMessage: "📞 Приглашаю в созвон «{title}»: {link}",
    callTitleDm: "Звонок с {name}", callTitleGroup: "Созвон группы «{title}»",
  },
  kk: {
    title: "Эмодзи", recent: "Жақындағы", bailanysta: "Bailanysta", smileys: "Смайлдар", gestures: "Ишаралар", hearts: "Жүректер", nature: "Табиғат", food: "Тағам", objects: "Заттар", symbols: "Символдар",
    noRecent: "Мұнда сіз таңдаған эмодзилер көрінеді.",
    voice: "Дауыстық хабарлама", recording: "Жазылып жатыр", stopAndSend: "Тоқтатып жіберу", cancelRecording: "Жазуды тоқтату", micDenied: "Микрофонға қолжетімділік жоқ",
    noRecorder: "Браузер дауыс жазуды қолдамайды", voiceSent: "Дауыстық жіберілді", play: "Тыңдау", pause: "Кідірту", speed: "Жылдамдық",
    call: "Қоңырау шалу", callHint: "Аудио немесе бейнеқоңырау: бөлмеде не қосуды таңдайсыз", callStarting: "Қоңырау жасалып жатыр…", callMessage: "📞 «{title}» қоңырауына шақырамын: {link}",
    callTitleDm: "{name} — қоңырау", callTitleGroup: "«{title}» тобының қоңырауы",
  },
  en: {
    title: "Emoji", recent: "Recent", bailanysta: "Bailanysta", smileys: "Smileys", gestures: "Gestures", hearts: "Hearts", nature: "Nature", food: "Food", objects: "Objects", symbols: "Symbols",
    noRecent: "Emoji you pick will appear here.",
    voice: "Voice message", recording: "Recording", stopAndSend: "Stop and send", cancelRecording: "Cancel recording", micDenied: "Microphone access denied",
    noRecorder: "This browser cannot record voice", voiceSent: "Voice message sent", play: "Play", pause: "Pause", speed: "Speed",
    call: "Call", callHint: "Audio or video call: choose what to enable in the room", callStarting: "Starting the call…", callMessage: "📞 Join the call “{title}”: {link}",
    callTitleDm: "Call with {name}", callTitleGroup: "Group call “{title}”",
  },
};
export default emoji;
