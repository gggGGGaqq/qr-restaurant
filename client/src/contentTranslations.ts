type ContentLanguage = "ru" | "kk";

const menuItemTranslations: Record<number, { name: string; description: string }> = {
  1: {
    name: "Грильдегі стейк-боул",
    description: "Қуырылған стейк, көк шөптер, пеште піскен көкөністер және фирмалық тұздық.",
  },
  2: {
    name: "Лимон мен хош иісті шөптер қосылған тауық еті",
    description: "Тауықтың сан еті, лимон майы, жасыл салат және қытырлақ картоп.",
  },
  3: {
    name: "Саңырауқұлақ қосылған ризотто",
    description: "Арборио күріші, пеште піскен саңырауқұлақтар, пармезан және ақжелкен майы.",
  },
  4: {
    name: "Қызанақ пен буррата қосылған салат",
    description: "Буррата, піскен қызанақтар, базилик, зәйтүн майы және теңіз тұзы.",
  },
  5: {
    name: "Шоколадты тарт",
    description: "Қою шоколад ганашы, үгілмелі негіз және қуырылған жаңғақтар.",
  },
  6: {
    name: "Цитрусты спарклинг",
    description: "Жалбыз бен минералды су қосылған үй лимонады.",
  },
  7: {
    name: "Сорпасы бар үй пельмендері",
    description: "Қолмен түйілген шырынды пельмендер, мөлдір сорпа, көк шөп және қара бұрыш.",
  },
  8: {
    name: "Қызанақ пен базилик қосылған паста",
    description: "Аль денте паста, қызанақ тұздығы, базилик, сарымсақ және пармезан.",
  },
  9: {
    name: "Көкөністермен грильдегі лосось",
    description: "Лосось филесі, гриль көкөністері, лимон және жеңіл кілегейлі тұздық.",
  },
  10: {
    name: "Тауық қосылған Цезарь",
    description: "Романо, тауық филесі, пармезан, қытырлақ нан және фирмалық цезарь тұздығы.",
  },
  11: {
    name: "Киноа мен авокадо салаты",
    description: "Киноа, авокадо, қияр, қызанақ, көк шөп миксі және лайм тұздығы.",
  },
  12: {
    name: "Жидек қосылған чизкейк",
    description: "Нәзік чизкейк, жидек тұздығы және жаңа жалбыз.",
  },
  13: {
    name: "Шырғанақ морсы",
    description: "Бал мен цитрус қосылған ашық дәмді үй шырғанақ морсы.",
  },
  14: {
    name: "Ванильді айс-латте",
    description: "Салқын эспрессо, сүт, ваниль сиропы және мұз.",
  },
};

const modifierTranslations: Record<number, string> = {
  1: "Medium rare қуыру",
  2: "Well done қуыру",
  3: "Қосымша тұздық",
  4: "Лимонсыз",
  5: "Ащы тұздық",
  6: "Қосымша пармезан",
  7: "Базиликсіз",
  8: "Бір шар балмұздақ",
  9: "Мұзы азырақ",
  10: "Қаймақпен",
  11: "Ащы сорпа",
  12: "Қосымша пармезан",
  13: "Терияки тұздығы",
  14: "Қытырлақ нансыз",
  15: "Фета қосу",
  16: "Жидек тұздығы",
  17: "Қантсыз",
  18: "Сұлы сүтімен",
};

const fallbackTextTranslations: Record<string, string> = {
  "Стейк-боул на гриле": menuItemTranslations[1].name,
  "Курица с лимоном и травами": menuItemTranslations[2].name,
  "Ризотто с грибами": menuItemTranslations[3].name,
  "Салат с томатами и бурратой": menuItemTranslations[4].name,
  "Шоколадный тарт": menuItemTranslations[5].name,
  "Цитрусовый спарклинг": menuItemTranslations[6].name,
  "Обжаренный стейк, зелень, запеченные овощи, фирменный соус.": menuItemTranslations[1].description,
  "Куриное бедро, лимонное масло, зеленый салат, хрустящий картофель.": menuItemTranslations[2].description,
  "Рис арборио, запеченные грибы, пармезан, масло с петрушкой.": menuItemTranslations[3].description,
  "Буррата, спелые томаты, базилик, оливковое масло, морская соль.": menuItemTranslations[4].description,
  "Ганаш из темного шоколада, песочная основа, поджаренные орехи.": menuItemTranslations[5].description,
  "Домашняя цитрусовая газировка с мятой и минеральной водой.": menuItemTranslations[6].description,
  "Прожарка medium rare": modifierTranslations[1],
  "Прожарка well done": modifierTranslations[2],
  "Дополнительный соус": modifierTranslations[3],
  "Без лимона": modifierTranslations[4],
  "Острый соус": modifierTranslations[5],
  "Больше пармезана": modifierTranslations[6],
  "Без базилика": modifierTranslations[7],
  "Шарик мороженого": modifierTranslations[8],
  "Меньше льда": modifierTranslations[9],
};

export function localizeMenuItemName(
  input: { id: number; name: string },
  language: ContentLanguage,
): string {
  if (language !== "kk") return input.name;
  return menuItemTranslations[input.id]?.name ?? fallbackTextTranslations[input.name] ?? input.name;
}

export function localizeMenuItemDescription(
  input: { id: number; description: string | null },
  language: ContentLanguage,
): string | null {
  if (!input.description || language !== "kk") return input.description;
  return menuItemTranslations[input.id]?.description ?? fallbackTextTranslations[input.description] ?? input.description;
}

export function localizeModifierName(
  input: { id?: number | null; modifierId?: number | null; name: string },
  language: ContentLanguage,
): string {
  if (language !== "kk") return input.name;
  const key = input.modifierId ?? input.id ?? null;
  return (key ? modifierTranslations[key] : null) ?? fallbackTextTranslations[input.name] ?? input.name;
}

export function localizeText(value: string, language: ContentLanguage): string {
  if (language !== "kk") return value;
  return fallbackTextTranslations[value] ?? value;
}
