CREATE DATABASE IF NOT EXISTS qr_restaurant
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE qr_restaurant;

CREATE TABLE IF NOT EXISTS `tables` (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  number VARCHAR(24) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tables_number (number)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS restaurant_settings (
  id TINYINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL DEFAULT 'QR Restaurant',
  accent_color VARCHAR(16) NOT NULL DEFAULT '#2f6f5e',
  cover_image VARCHAR(500) NULL,
  service_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.1000,
  PRIMARY KEY (id),
  CONSTRAINT chk_restaurant_settings_id CHECK (id = 1),
  CONSTRAINT chk_restaurant_settings_service_rate CHECK (service_rate >= 0 AND service_rate <= 0.25)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(36) NOT NULL,
  table_id INT UNSIGNED NOT NULL,
  status ENUM('ACTIVE', 'EXPIRED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sessions_table_status (table_id, status),
  KEY idx_sessions_last_activity (last_activity),
  CONSTRAINT fk_sessions_table
    FOREIGN KEY (table_id) REFERENCES `tables` (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS session_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id CHAR(36) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_session_events_session (session_id, created_at),
  CONSTRAINT fk_session_events_session
    FOREIGN KEY (session_id) REFERENCES sessions (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category ENUM('grill', 'hot', 'salad', 'dessert', 'drink') NOT NULL DEFAULT 'hot',
  name VARCHAR(120) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT NULL,
  image VARCHAR(500) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  KEY idx_menu_items_active (active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_item_modifiers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  menu_item_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  price_delta DECIMAL(10, 2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_menu_item_modifiers_item (menu_item_id, active),
  CONSTRAINT fk_menu_item_modifiers_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) NOT NULL,
  table_id INT UNSIGNED NOT NULL,
  session_id CHAR(36) NOT NULL,
  status ENUM('NEW', 'ACCEPTED', 'COOKING', 'READY', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'NEW',
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_status_created (status, created_at),
  KEY idx_orders_table_created (table_id, created_at),
  KEY idx_orders_session_created (session_id, created_at),
  CONSTRAINT fk_orders_table
    FOREIGN KEY (table_id) REFERENCES `tables` (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_orders_session
    FOREIGN KEY (session_id) REFERENCES sessions (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id CHAR(36) NOT NULL,
  menu_item_id INT UNSIGNED NOT NULL,
  qty INT UNSIGNED NOT NULL,
  note TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_menu_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items (id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_order_items_qty CHECK (qty > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_item_modifiers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_item_id BIGINT UNSIGNED NOT NULL,
  modifier_id INT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  price_delta DECIMAL(10, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_order_item_modifiers_item (order_item_id),
  CONSTRAINT fk_order_item_modifiers_item
    FOREIGN KEY (order_item_id) REFERENCES order_items (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_item_modifiers_modifier
    FOREIGN KEY (modifier_id) REFERENCES menu_item_modifiers (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id CHAR(36) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  from_status ENUM('NEW', 'ACCEPTED', 'COOKING', 'READY', 'COMPLETED', 'REJECTED') NULL,
  to_status ENUM('NEW', 'ACCEPTED', 'COOKING', 'READY', 'COMPLETED', 'REJECTED') NOT NULL,
  payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_events_order (order_id, created_at),
  CONSTRAINT fk_order_events_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS service_requests (
  id CHAR(36) NOT NULL,
  table_id INT UNSIGNED NOT NULL,
  session_id CHAR(36) NOT NULL,
  type ENUM('WAITER', 'WATER', 'BILL', 'CLEANUP') NOT NULL,
  status ENUM('OPEN', 'DONE') NOT NULL DEFAULT 'OPEN',
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_service_requests_status_created (status, created_at),
  KEY idx_service_requests_session (session_id, created_at),
  CONSTRAINT fk_service_requests_table
    FOREIGN KEY (table_id) REFERENCES `tables` (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_service_requests_session
    FOREIGN KEY (session_id) REFERENCES sessions (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;
