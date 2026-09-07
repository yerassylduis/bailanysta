import type { Namespace } from "../index";

/** Общие слова — используются из любого компонента. Не редактируется группами миграции: свои слова кладите в свой неймспейс. */
const common: Namespace = {
  ru: {
    cancel: "Отмена", save: "Сохранить", saving: "Сохраняем…", delete: "Удалить", close: "Закрыть", back: "Назад", edit: "Изменить", done: "Готово",
    loading: "Загрузка…", error: "Что-то пошло не так", retry: "Повторить", send: "Отправить", search: "Поиск", open: "Открыть", add: "Добавить", remove: "Убрать",
    create: "Создать", upload: "Загрузить", copy: "Копировать", copied: "Скопировано", yes: "Да", no: "Нет", more: "Ещё", less: "Свернуть", you: "вы", optional: "необязательно",
    name: "Имя", today: "сегодня", yesterday: "вчера", justNow: "только что", never: "никогда", unknown: "неизвестно", all: "Все", nothing: "Пока пусто",
    "people.one": "{count} человек", "people.few": "{count} человека", "people.many": "{count} человек", "people.other": "{count} человека",
    "posts.one": "{count} пост", "posts.few": "{count} поста", "posts.many": "{count} постов", "posts.other": "{count} поста",
    "followers.one": "{count} подписчик", "followers.few": "{count} подписчика", "followers.many": "{count} подписчиков", "followers.other": "{count} подписчика",
    "following.one": "{count} подписка", "following.few": "{count} подписки", "following.many": "{count} подписок", "following.other": "{count} подписки",
    "likes.one": "{count} лайк", "likes.few": "{count} лайка", "likes.many": "{count} лайков", "likes.other": "{count} лайка",
    "comments.one": "{count} комментарий", "comments.few": "{count} комментария", "comments.many": "{count} комментариев", "comments.other": "{count} комментария",
    "min.other": "{count} мин", "hours.other": "{count} ч", "days.other": "{count} дн",
  },
  kk: {
    cancel: "Бас тарту", save: "Сақтау", saving: "Сақталуда…", delete: "Жою", close: "Жабу", back: "Артқа", edit: "Өзгерту", done: "Дайын",
    loading: "Жүктелуде…", error: "Бірдеңе дұрыс болмады", retry: "Қайталау", send: "Жіберу", search: "Іздеу", open: "Ашу", add: "Қосу", remove: "Алып тастау",
    create: "Жасау", upload: "Жүктеу", copy: "Көшіру", copied: "Көшірілді", yes: "Иә", no: "Жоқ", more: "Тағы", less: "Жасыру", you: "сіз", optional: "міндетті емес",
    name: "Аты", today: "бүгін", yesterday: "кеше", justNow: "жаңа ғана", never: "ешқашан", unknown: "белгісіз", all: "Барлығы", nothing: "Әзірге бос",
    "people.other": "{count} адам", "posts.other": "{count} жазба", "followers.other": "{count} жазылушы", "following.other": "{count} жазылым",
    "likes.other": "{count} лайк", "comments.other": "{count} пікір",
    "min.other": "{count} мин", "hours.other": "{count} сағ", "days.other": "{count} күн",
  },
  en: {
    cancel: "Cancel", save: "Save", saving: "Saving…", delete: "Delete", close: "Close", back: "Back", edit: "Edit", done: "Done",
    loading: "Loading…", error: "Something went wrong", retry: "Retry", send: "Send", search: "Search", open: "Open", add: "Add", remove: "Remove",
    create: "Create", upload: "Upload", copy: "Copy", copied: "Copied", yes: "Yes", no: "No", more: "More", less: "Less", you: "you", optional: "optional",
    name: "Name", today: "today", yesterday: "yesterday", justNow: "just now", never: "never", unknown: "unknown", all: "All", nothing: "Nothing here yet",
    "people.one": "{count} person", "people.other": "{count} people", "posts.one": "{count} post", "posts.other": "{count} posts",
    "followers.one": "{count} follower", "followers.other": "{count} followers", "following.one": "{count} following", "following.other": "{count} following",
    "likes.one": "{count} like", "likes.other": "{count} likes", "comments.one": "{count} comment", "comments.other": "{count} comments",
    "min.other": "{count} min", "hours.other": "{count} h", "days.other": "{count} d",
  },
};
export default common;
