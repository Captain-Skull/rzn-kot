import { InlineKeyboard } from "grammy";

export const catalogKeyboard =  new InlineKeyboard()
	.text("Валюта", "open-catalog_currency")
	.row()
	.text("Популярность", "open-catalog_popularity")
	.row()
	.text("Подписки", "open-catalog_subs")
	.row()
	.text("🔙 Назад", "return")


export const currencyCatalogKeyboard = new InlineKeyboard()
	.text("Получить кодами", "open-catalog_codes")
	.row()
	.text("Получить по id", "open-catalog_id")
	.row()
	.text("🔙 Назад", "open-shop")