import type { Namespace } from "../index";

/** Раздел «Настройки». */
const settings: Namespace = {
  ru: {
    title: "Настройки", subtitle: "Внешний вид, язык, уведомления и аккаунт — всё в одном месте.",
    appearance: "Внешний вид", appearanceHint: "Тема интерфейса. Ночью — звёзды и планеты на фоне, днём — солнечные лучи.",
    language: "Язык интерфейса", languageHint: "Меняются надписи и кнопки. Посты, комментарии и сообщения остаются на языке авторов.",
    notifications: "Уведомления", sound: "Звук уведомлений", soundHint: "Короткий сигнал при новом уведомлении или сообщении. Звучит один раз, даже если открыто несколько вкладок.",
    testSound: "Проверить звук",
    extra: "Дополнительно", cosmos: "Анимация фона", cosmosHint: "Живой космос на фоне: звёзды, планеты, метеоры и лучи. Отключите, если бережёте батарею или отвлекает.",
    account: "Аккаунт", accountHint: "Профиль, контакты и выход.", openProfile: "Открыть профиль", adminPanel: "Админ-панель",
    logout: "Выйти из аккаунта", notLoggedIn: "Вы не вошли в аккаунт. Тема, язык и звук сохраняются в этом браузере.", login: "Войти",
    on: "Вкл", off: "Выкл",
    about: "О сети", aboutText: "Expert Bailanysta — учебный проект для nFactorial: своя лента, созвездие связей, звонки и ИИ-соавтор Cosmos. Код открыт.",
    github: "Репозиторий на GitHub",
  },
  kk: {
    title: "Баптаулар", subtitle: "Көрініс, тіл, хабарландырулар және аккаунт — бір жерде.",
    appearance: "Көрініс", appearanceHint: "Интерфейс тақырыбы. Түнде — жұлдыздар мен планеталар, күндіз — күн сәулелері.",
    language: "Интерфейс тілі", languageHint: "Жазулар мен түймелер өзгереді. Жазбалар, пікірлер мен хабарламалар авторлардың тілінде қалады.",
    notifications: "Хабарландырулар", sound: "Хабарландыру дыбысы", soundHint: "Жаңа хабарландыру немесе хабарлама келгенде қысқа сигнал. Бірнеше қойынды ашық болса да бір рет шығады.",
    testSound: "Дыбысты тексеру",
    extra: "Қосымша", cosmos: "Фон анимациясы", cosmosHint: "Фондағы тірі ғарыш: жұлдыздар, планеталар, метеорлар мен сәулелер. Батареяны үнемдесеңіз немесе алаңдатса, өшіріңіз.",
    account: "Аккаунт", accountHint: "Профиль, байланыс деректері және шығу.", openProfile: "Профильді ашу", adminPanel: "Әкімші панелі",
    logout: "Аккаунттан шығу", notLoggedIn: "Сіз аккаунтқа кірмегенсіз. Тақырып, тіл және дыбыс осы браузерде сақталады.", login: "Кіру",
    on: "Қосулы", off: "Өшірулі",
    about: "Желі туралы", aboutText: "Expert Bailanysta — nFactorial үшін оқу жобасы: өз лентасы, байланыс шоқжұлдызы, қоңыраулар және Cosmos ИИ-серіктесі. Коды ашық.",
    github: "GitHub репозиторийі",
  },
  en: {
    title: "Settings", subtitle: "Appearance, language, notifications and account in one place.",
    appearance: "Appearance", appearanceHint: "Interface theme. Night shows stars and planets in the background, day shows sun rays.",
    language: "Interface language", languageHint: "Labels and buttons change. Posts, comments and messages stay in their authors' language.",
    notifications: "Notifications", sound: "Notification sound", soundHint: "A short chime on a new notification or message. Plays once even with several tabs open.",
    testSound: "Test sound",
    extra: "Extra", cosmos: "Background animation", cosmosHint: "A living cosmos behind the page: stars, planets, meteors and rays. Turn it off to save battery or reduce distraction.",
    account: "Account", accountHint: "Profile, contacts and sign-out.", openProfile: "Open profile", adminPanel: "Admin panel",
    logout: "Sign out", notLoggedIn: "You are not signed in. Theme, language and sound are saved in this browser.", login: "Sign in",
    on: "On", off: "Off",
    about: "About", aboutText: "Expert Bailanysta is a study project for nFactorial: its own feed, a constellation of connections, calls and the Cosmos AI co-author. The code is open.",
    github: "GitHub repository",
  },
};
export default settings;
