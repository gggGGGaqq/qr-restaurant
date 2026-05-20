USE qr_restaurant;

INSERT INTO `tables` (id, number) VALUES
  (1, '1'),
  (2, '2'),
  (3, '3'),
  (4, '4'),
  (5, '5'),
  (6, '6')
ON DUPLICATE KEY UPDATE number = VALUES(number);

INSERT INTO restaurant_settings (id, name, accent_color, cover_image, service_rate) VALUES
  (1, 'Demo Bistro', '#2f6f5e', NULL, 0.1000)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  accent_color = VALUES(accent_color),
  cover_image = VALUES(cover_image),
  service_rate = VALUES(service_rate);

INSERT INTO menu_items (id, category, name, price, description, image, active) VALUES
  (1, 'grill', 'Стейк-боул на гриле', 18.50, 'Обжаренный стейк, зелень, запеченные овощи, фирменный соус.', '/menu/steak-bowl.jpg', TRUE),
  (2, 'grill', 'Курица с лимоном и травами', 15.00, 'Куриное бедро, лимонное масло, зеленый салат, хрустящий картофель.', '/menu/lemon-chicken.jpg', TRUE),
  (3, 'hot', 'Ризотто с грибами', 13.75, 'Рис арборио, запеченные грибы, пармезан, масло с петрушкой.', '/menu/mushroom-risotto.jpg', TRUE),
  (4, 'salad', 'Салат с томатами и бурратой', 10.50, 'Буррата, спелые томаты, базилик, оливковое масло, морская соль.', '/menu/burrata-salad.jpg', TRUE),
  (5, 'dessert', 'Шоколадный тарт', 7.25, 'Ганаш из темного шоколада, песочная основа, поджаренные орехи.', '/menu/chocolate-tart.jpg', TRUE),
  (6, 'drink', 'Цитрусовый спарклинг', 4.50, 'Домашняя цитрусовая газировка с мятой и минеральной водой.', '/menu/citrus-sparkling.jpg', TRUE),
  (7, 'hot', 'Домашние пельмени с бульоном', 9.80, 'Сочные пельмени ручной лепки, прозрачный бульон, зелень и черный перец.', '/menu/dumplings-broth.jpg', TRUE),
  (8, 'hot', 'Паста с томатами и базиликом', 11.40, 'Паста аль денте, томатный соус, базилик, чеснок и пармезан.', '/menu/tomato-basil-pasta.jpg', TRUE),
  (9, 'grill', 'Лосось на гриле с овощами', 17.20, 'Филе лосося, овощи на гриле, лимон и легкий сливочный соус.', '/menu/grilled-salmon-vegetables.jpg', TRUE),
  (10, 'salad', 'Цезарь с курицей', 9.90, 'Романо, куриное филе, пармезан, сухарики и фирменный соус цезарь.', '/menu/chicken-caesar.jpg', TRUE),
  (11, 'salad', 'Салат с киноа и авокадо', 10.80, 'Киноа, авокадо, огурец, томаты, микс зелени и лаймовая заправка.', '/menu/quinoa-avocado-salad.jpg', TRUE),
  (12, 'dessert', 'Чизкейк с ягодами', 6.90, 'Нежный чизкейк, ягодный соус и свежая мята.', '/menu/berry-cheesecake.jpg', TRUE),
  (13, 'drink', 'Облепиховый морс', 3.80, 'Яркий домашний морс из облепихи с медом и цитрусом.', '/menu/sea-buckthorn-mors.jpg', TRUE),
  (14, 'drink', 'Айс-латте с ванилью', 4.20, 'Охлажденный эспрессо, молоко, ванильный сироп и лед.', '/menu/vanilla-iced-latte.jpg', TRUE)
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  name = VALUES(name),
  price = VALUES(price),
  description = VALUES(description),
  image = VALUES(image),
  active = VALUES(active);

INSERT INTO menu_item_modifiers (id, menu_item_id, name, price_delta, active, sort_order) VALUES
  (1, 1, 'Прожарка medium rare', 0.00, TRUE, 1),
  (2, 1, 'Прожарка well done', 0.00, TRUE, 2),
  (3, 1, 'Дополнительный соус', 0.50, TRUE, 3),
  (4, 2, 'Без лимона', 0.00, TRUE, 1),
  (5, 2, 'Острый соус', 0.50, TRUE, 2),
  (6, 3, 'Больше пармезана', 0.80, TRUE, 1),
  (7, 4, 'Без базилика', 0.00, TRUE, 1),
  (8, 5, 'Шарик мороженого', 1.20, TRUE, 1),
  (9, 6, 'Меньше льда', 0.00, TRUE, 1),
  (10, 7, 'Со сметаной', 0.00, TRUE, 1),
  (11, 7, 'Острый бульон', 0.50, TRUE, 2),
  (12, 8, 'Больше пармезана', 0.80, TRUE, 1),
  (13, 9, 'Соус терияки', 0.70, TRUE, 1),
  (14, 10, 'Без сухариков', 0.00, TRUE, 1),
  (15, 11, 'Добавить фету', 1.00, TRUE, 1),
  (16, 12, 'Ягодный соус', 0.60, TRUE, 1),
  (17, 13, 'Без сахара', 0.00, TRUE, 1),
  (18, 14, 'На овсяном молоке', 0.80, TRUE, 1)
ON DUPLICATE KEY UPDATE
  menu_item_id = VALUES(menu_item_id),
  name = VALUES(name),
  price_delta = VALUES(price_delta),
  active = VALUES(active),
  sort_order = VALUES(sort_order);
