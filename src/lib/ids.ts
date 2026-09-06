import { customAlphabet } from "nanoid";
/** Короткие URL-safe идентификаторы без похожих символов. */
export const newId = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 12);
export const nowIso = () => new Date().toISOString();
