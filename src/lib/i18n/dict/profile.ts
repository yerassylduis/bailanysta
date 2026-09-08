import type { Namespace } from "../index";

/** Неймспейс «profile». Ключи одинаковы во всех трёх языках; множественное число — key.one/few/many/other. */
const profile: Namespace = {
  ru: {
    followersTitle: "Подписчики", followingTitle: "Подписки", emptyFollowers: "Пока никто не подписался", emptyFollowing: "Пока ни на кого не подписан(а)",
    error: "Ошибка", avatarUpdated: "Аватар обновлён", uploadFailed: "Не удалось загрузить", coverUpdated: "Фон обновлён", coverUploadFailed: "Не удалось загрузить фон",
    notFoundTitle: "Такого человека здесь нет", notFoundText: "@{handle} ещё не присоединился к Expert Bailanysta.", toFeed: "В ленту", updated: "Профиль обновлён",
    coverN: "Фон {n}", ownImage: "Своя картинка", coverReset: "Фон сброшен", reset: "Сбросить", changeAvatar: "Сменить аватар", avatarRemoved: "Аватар убран", removeAvatar: "Убрать аватар",
    editBtn: "Редактировать", logout: "Выйти", writeMessage: "Написать сообщение", bioPlaceholder: "Пара слов о себе",
    phone: "Телефон", email: "Почта", birthday: "Дата рождения", contactsHint: "Телефон и почта используются для входа по коду; другим пользователям они не показываются.",
    withUsSince: "с нами с {date}",
    "statPosts.one": "пост", "statPosts.few": "поста", "statPosts.many": "постов",
    "statFollowers.one": "подписчик", "statFollowers.few": "подписчика", "statFollowers.many": "подписчиков",
    statFollowing: "подписок",
    "statLikes.one": "лайк", "statLikes.few": "лайка", "statLikes.many": "лайков",
    postsHeading: "Посты", emptyOwnTitle: "Вы ещё ничего не написали", emptyTitle: "Здесь пока пусто",
    emptyOwnText: "Первый пост — самый лёгкий. Cosmos поможет.", emptyText: "Автор ещё собирается с мыслями.",
  },
  kk: {
    followersTitle: "Жазылушылар", followingTitle: "Жазылымдар", emptyFollowers: "Әзірге ешкім жазылмаған", emptyFollowing: "Әзірге ешкімге жазылмаған",
    error: "Қате", avatarUpdated: "Аватар жаңартылды", uploadFailed: "Жүктеу мүмкін болмады", coverUpdated: "Фон жаңартылды", coverUploadFailed: "Фонды жүктеу мүмкін болмады",
    notFoundTitle: "Мұнда мұндай адам жоқ", notFoundText: "@{handle} Expert Bailanysta-ға әлі қосылмаған.", toFeed: "Лентаға", updated: "Профиль жаңартылды",
    coverN: "Фон {n}", ownImage: "Өз суретім", coverReset: "Фон әдепкі күйге келтірілді", reset: "Қалпына келтіру", changeAvatar: "Аватарды ауыстыру", avatarRemoved: "Аватар алынды", removeAvatar: "Аватарды алып тастау",
    editBtn: "Өңдеу", logout: "Шығу", writeMessage: "Хабарлама жазу", bioPlaceholder: "Өзіңіз туралы бірер сөз",
    phone: "Телефон", email: "Пошта", birthday: "Туған күні", contactsHint: "Телефон мен пошта код арқылы кіру үшін қолданылады; басқа пайдаланушыларға көрсетілмейді.",
    withUsSince: "бізбен бірге {date} бастап",
    "statPosts.other": "жазба", "statFollowers.other": "жазылушы", statFollowing: "жазылым", "statLikes.other": "лайк",
    postsHeading: "Жазбалар", emptyOwnTitle: "Сіз әлі ештеңе жазбадыңыз", emptyTitle: "Мұнда әзірге бос",
    emptyOwnText: "Бірінші жазба — ең жеңілі. Cosmos көмектеседі.", emptyText: "Автор әлі ойын жинап жатыр.",
  },
  en: {
    followersTitle: "Followers", followingTitle: "Following", emptyFollowers: "No followers yet", emptyFollowing: "Not following anyone yet",
    error: "Error", avatarUpdated: "Avatar updated", uploadFailed: "Upload failed", coverUpdated: "Cover updated", coverUploadFailed: "Couldn't upload the cover",
    notFoundTitle: "No such person here", notFoundText: "@{handle} hasn't joined Expert Bailanysta yet.", toFeed: "To the feed", updated: "Profile updated",
    coverN: "Cover {n}", ownImage: "Own picture", coverReset: "Cover reset", reset: "Reset", changeAvatar: "Change avatar", avatarRemoved: "Avatar removed", removeAvatar: "Remove avatar",
    editBtn: "Edit profile", logout: "Sign out", writeMessage: "Send a message", bioPlaceholder: "A few words about yourself",
    phone: "Phone", email: "Email", birthday: "Date of birth", contactsHint: "Phone and email are used to sign in with a code; other users don't see them.",
    withUsSince: "with us since {date}",
    "statPosts.one": "post", "statPosts.other": "posts", "statFollowers.one": "follower", "statFollowers.other": "followers", statFollowing: "following",
    "statLikes.one": "like", "statLikes.other": "likes",
    postsHeading: "Posts", emptyOwnTitle: "You haven't written anything yet", emptyTitle: "Nothing here yet",
    emptyOwnText: "The first post is the easiest. Cosmos will help.", emptyText: "The author is still gathering their thoughts.",
  },
};
export default profile;
