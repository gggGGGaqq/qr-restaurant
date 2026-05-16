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
  (6, 'drink', 'Цитрусовый спарклинг', 4.50, 'Домашняя цитрусовая газировка с мятой и минеральной водой.', '/menu/citrus-sparkling.jpg', TRUE)
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
  (9, 6, 'Меньше льда', 0.00, TRUE, 1)
ON DUPLICATE KEY UPDATE
  menu_item_id = VALUES(menu_item_id),
  name = VALUES(name),
  price_delta = VALUES(price_delta),
  active = VALUES(active),
  sort_order = VALUES(sort_order);
