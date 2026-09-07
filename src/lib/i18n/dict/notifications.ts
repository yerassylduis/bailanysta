import type { Namespace } from "../index";

/** Неймспейс «notifications»: страница уведомлений и всплывашки realtime. Ключи одинаковы во всех трёх языках; множественное число — key.one/few/many/other. */
const notifications: Namespace = {
  ru: {
    onlyForOwn: "Уведомления только для своих", loginText: "Войдите, чтобы видеть лайки, ответы и новых подписчиков.",
    markAll: "Прочитать все", quiet: "Пока тихо", quietText: "Когда кто-то оценит или ответит на ваш пост, вы узнаете об этом здесь.",
    "type.like": "оценил(а) ваш пост", "type.comment": "ответил(а) на ваш пост", "type.follow": "подписался(ась) на вас",
    "type.mention": "упомянул(а) вас", "type.repost": "репостнул(а) ваш пост", "type.quote": "процитировал(а) ваш пост",
    "type.reply": "ответил(а) на ваш комментарий", "type.comment_like": "оценил(а) ваш комментарий", "type.call_invite": "приглашает вас в созвон",
    "type.unknown": "— новое событие",
    join: "Присоединиться", callInviteToast: "📞 {name} приглашает вас в созвон",
  },
  kk: {
    onlyForOwn: "Хабарландырулар өз адамдарымыз үшін ғана", loginText: "Лайктарды, жауаптарды және жаңа жазылушыларды көру үшін кіріңіз.",
    markAll: "Барлығын оқылды деп белгілеу", quiet: "Әзірге тыныш", quietText: "Біреу жазбаңызды бағалағанда немесе жауап бергенде, бұл жерден білесіз.",
    "type.like": "жазбаңызды бағалады", "type.comment": "жазбаңызға жауап берді", "type.follow": "сізге жазылды",
    "type.mention": "сізді атап өтті", "type.repost": "жазбаңызды репост жасады", "type.quote": "жазбаңызды дәйексөз етті",
    "type.reply": "пікіріңізге жауап берді", "type.comment_like": "пікіріңізді бағалады", "type.call_invite": "сізді қоңырауға шақырады",
    "type.unknown": "— жаңа оқиға",
    join: "Қосылу", callInviteToast: "📞 {name} сізді қоңырауға шақырады",
  },
  en: {
    onlyForOwn: "Notifications are for members only", loginText: "Sign in to see likes, replies and new followers.",
    markAll: "Mark all as read", quiet: "Quiet so far", quietText: "When someone likes or replies to your post, you'll find out here.",
    "type.like": "liked your post", "type.comment": "replied to your post", "type.follow": "followed you",
    "type.mention": "mentioned you", "type.repost": "reposted your post", "type.quote": "quoted your post",
    "type.reply": "replied to your comment", "type.comment_like": "liked your comment", "type.call_invite": "invites you to a call",
    "type.unknown": "— new activity",
    join: "Join", callInviteToast: "📞 {name} invites you to a call",
  },
};
export default notifications;
