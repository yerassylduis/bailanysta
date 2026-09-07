import type { Namespace } from "../index";

/** Неймспейс «explore»: созвездие (constellation), списки под графом, правый рельс, страница /explore. Ключи одинаковы во всех трёх языках; множественное число — key.one/few/many/other. */
const explore: Namespace = {
  ru: {
    // страница
    pageTitle: "Созвездие", eyebrow: "Шоқжұлдыз", heading: "Созвездие связей",
    intro: "Каждая звезда — человек, каждая линия — подписка. Размер звезды — сколько постов, сияние — сколько подписчиков. Наведите, чтобы увидеть чьё-то небо; кликните, чтобы попасть в профиль.",
    lookingFor: "Ищете конкретное?", searchLink: "Поиск по постам и тегам", orCmdK: "или ⌘K.",
    // созвездие
    loadFailed: "Не удалось загрузить созвездие.", loners: "Новые звёзды", mapAria: "Карта галактик — группы и связи между ними",
    legendMutual: "взаимная подписка", legendOneWay: "в одну сторону", legendYou: "это вы", legendGalaxyLink: "связь галактик", legendMembers: "число участников",
    hintZoomed: "тяните звёзды · клик по звезде — профиль", hintOverview: "нажмите на галактику, чтобы приблизить",
    zoomOut: "К обзору", shuffle: "Перемешать", shuffleTitle: "Расставить заново", configure: "Настроить", configureTitle: "Настроить галактику",
    // панель галактики
    panelTitle: "Галактика как группа", changeGalaxyAvatar: "Сменить аватар галактики", groupNameLabel: "Название группы или отдела", groupNamePlaceholder: "Например, Отдел маркетинга",
    anyMemberHint: "Аватар и имя может менять любой участник галактики.", linksTitle: "Связи с другими галактиками",
    noLinks: "Пока нет связей. Опишите ниже, чем ваша галактика связана с другой.", deleteLink: "Удалить связь",
    linkDescPlaceholder: "Чем связаны: общий проект, поставщик, наставничество…", linkGalaxies: "Связать галактики", noOtherGalaxies: "Других галактик пока нет.",
    // списки под графом
    people: "Люди", trendingTags: "Теги за две недели", noTags: "Тегов пока нет.",
    // правый рельс
    searchPlaceholder: "Поиск постов, #тегов, @людей", trendingNow: "Сейчас обсуждают", quiet: "Пока тихо. Напишите первый пост с #тегом.", whoToRead: "Кого почитать",
    cosmosBlurb: "ИИ-соавтор: набросок в пост, полировка, хэштеги, перевод на қазақша. Кнопка ✨ в редакторе.", loginTry: "Войти и попробовать",
    haveQuestion: "Есть вопрос?", askHelper: "Спросите помощника Көмекші", footer: "Expert Bailanysta · «байланыс» — связь. Сделано для nFactorial, 2026.",
  },
  kk: {
    pageTitle: "Шоқжұлдыз", eyebrow: "Шоқжұлдыз", heading: "Байланыстар шоқжұлдызы",
    intro: "Әр жұлдыз — адам, әр сызық — жазылым. Жұлдыздың өлшемі — жазбалар саны, жарқырауы — жазылушылар саны. Біреудің аспанын көру үшін меңзерді апарыңыз; профильге өту үшін басыңыз.",
    lookingFor: "Нақты бір нәрсе іздеп жүрсіз бе?", searchLink: "Жазбалар мен тегтер бойынша іздеу", orCmdK: "немесе ⌘K.",
    loadFailed: "Шоқжұлдызды жүктеу мүмкін болмады.", loners: "Жаңа жұлдыздар", mapAria: "Галактикалар картасы — топтар және олардың арасындағы байланыстар",
    legendMutual: "өзара жазылым", legendOneWay: "бір жақты", legendYou: "бұл сіз", legendGalaxyLink: "галактикалар байланысы", legendMembers: "қатысушылар саны",
    hintZoomed: "жұлдыздарды сүйреңіз · жұлдызға басу — профиль", hintOverview: "жақындату үшін галактикаға басыңыз",
    zoomOut: "Шолуға", shuffle: "Араластыру", shuffleTitle: "Қайта орналастыру", configure: "Баптау", configureTitle: "Галактиканы баптау",
    panelTitle: "Галактика — топ ретінде", changeGalaxyAvatar: "Галактика аватарын ауыстыру", groupNameLabel: "Топтың немесе бөлімнің атауы", groupNamePlaceholder: "Мысалы, Маркетинг бөлімі",
    anyMemberHint: "Аватар мен атауды галактиканың кез келген қатысушысы өзгерте алады.", linksTitle: "Басқа галактикалармен байланыстар",
    noLinks: "Байланыстар әзірге жоқ. Галактикаңыз басқасымен қалай байланысты екенін төменде сипаттаңыз.", deleteLink: "Байланысты жою",
    linkDescPlaceholder: "Қалай байланысты: ортақ жоба, жеткізуші, тәлімгерлік…", linkGalaxies: "Галактикаларды байланыстыру", noOtherGalaxies: "Басқа галактикалар әзірге жоқ.",
    people: "Адамдар", trendingTags: "Екі аптадағы тегтер", noTags: "Тегтер әзірге жоқ.",
    searchPlaceholder: "Жазбалар, #тегтер, @адамдар іздеу", trendingNow: "Қазір талқыланып жатқандар", quiet: "Әзірге тыныш. #тегпен бірінші жазбаны жазыңыз.", whoToRead: "Кімді оқуға болады",
    cosmosBlurb: "ИИ-серіктес: нобайдан жазба, жылтырату, хэштегтер, қазақшаға аудару. Редактордағы ✨ түймесі.", loginTry: "Кіріп, байқап көру",
    haveQuestion: "Сұрағыңыз бар ма?", askHelper: "Көмекші боттан сұраңыз", footer: "Expert Bailanysta · «байланыс» — адамдар арасындағы қатынас. nFactorial үшін жасалды, 2026.",
  },
  en: {
    pageTitle: "Constellation", eyebrow: "Shoqzhuldyz", heading: "Constellation of connections",
    intro: "Every star is a person, every line a follow. A star's size is how many posts, its glow how many followers. Hover to see someone's sky; click to open the profile.",
    lookingFor: "Looking for something specific?", searchLink: "Search posts and tags", orCmdK: "or ⌘K.",
    loadFailed: "Couldn't load the constellation.", loners: "New stars", mapAria: "Galaxy map — groups and the links between them",
    legendMutual: "mutual follow", legendOneWay: "one-way", legendYou: "that's you", legendGalaxyLink: "galaxy link", legendMembers: "member count",
    hintZoomed: "drag the stars · click a star for the profile", hintOverview: "click a galaxy to zoom in",
    zoomOut: "Overview", shuffle: "Shuffle", shuffleTitle: "Rearrange", configure: "Configure", configureTitle: "Configure galaxy",
    panelTitle: "Galaxy as a group", changeGalaxyAvatar: "Change galaxy avatar", groupNameLabel: "Group or department name", groupNamePlaceholder: "e.g. Marketing department",
    anyMemberHint: "Any member of the galaxy can change its avatar and name.", linksTitle: "Links with other galaxies",
    noLinks: "No links yet. Describe below how your galaxy is connected to another.", deleteLink: "Delete link",
    linkDescPlaceholder: "How they're connected: shared project, supplier, mentoring…", linkGalaxies: "Link galaxies", noOtherGalaxies: "No other galaxies yet.",
    people: "People", trendingTags: "Tags of the last two weeks", noTags: "No tags yet.",
    searchPlaceholder: "Search posts, #tags, @people", trendingNow: "Trending now", quiet: "Quiet so far. Write the first post with a #tag.", whoToRead: "Who to read",
    cosmosBlurb: "AI co-author: a draft into a post, polishing, hashtags, translation into Kazakh. The ✨ button in the editor.", loginTry: "Sign in and try",
    haveQuestion: "Have a question?", askHelper: "Ask the Kömekşi assistant", footer: "Expert Bailanysta · “bailanys” means connection. Made for nFactorial, 2026.",
  },
};
export default explore;
