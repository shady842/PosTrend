import 'dart:convert';

import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

class AppDatabase {
  static Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'postrend_pos.db');
    _db = await openDatabase(
      path,
      version: 6,
      onCreate: (db, version) async {
        await _createOrdersAndDraft(db);
        await _createMenuSchemaV3(db);
        await _ensureDraftRow(db);
        await _createTablesOfflineTables(db);
        await _createPaymentActionsQueue(db);
        await _createSyncOutboxAndState(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await _migrateV1ToV2(db);
        }
        if (oldVersion < 3) {
          await _migrateV2ToV3(db);
        }
        if (oldVersion < 4) {
          await _createTablesOfflineTables(db);
        }
        if (oldVersion < 5) {
          await _createPaymentActionsQueue(db);
        }
        if (oldVersion < 6) {
          await _createSyncOutboxAndState(db);
          await _migrateLegacyQueuesToSyncOutbox(db);
        }
      },
    );
    return _db!;
  }

  Future<void> _createOrdersAndDraft(Database db) async {
    await db.execute('''
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE draft_cart (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');
  }

  /// Full menu schema (API + offline). No seed — sync loads data.
  Future<void> _createMenuSchemaV3(Database db) async {
    await db.execute('''
      CREATE TABLE menu_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    ''');
    await db.execute('''
      CREATE TABLE menu_items (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        barcode TEXT,
        image_url TEXT,
        is_combo INTEGER NOT NULL DEFAULT 0,
        display_order INTEGER NOT NULL DEFAULT 0,
        price_cents INTEGER NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE menu_item_variants (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price_cents INTEGER NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        sku TEXT,
        barcode TEXT,
        FOREIGN KEY (item_id) REFERENCES menu_items (id)
      )
    ''');
    await db.execute('''
      CREATE TABLE item_modifier_groups (
        item_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        name TEXT NOT NULL,
        min_select INTEGER NOT NULL DEFAULT 0,
        max_select INTEGER NOT NULL DEFAULT 1,
        is_required INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (item_id, group_id),
        FOREIGN KEY (item_id) REFERENCES menu_items (id)
      )
    ''');
    await db.execute('''
      CREATE TABLE modifier_options (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price_cents INTEGER NOT NULL DEFAULT 0,
        display_order INTEGER NOT NULL DEFAULT 0
      )
    ''');
    await db.execute('''
      CREATE TABLE menu_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');
  }

  Future<void> _migrateV1ToV2(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS menu_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price_cents INTEGER NOT NULL,
        FOREIGN KEY (category_id) REFERENCES menu_categories (id)
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS menu_modifiers (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price_delta_cents INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (item_id) REFERENCES menu_items (id)
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS draft_cart (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');
    await _seedMenu(db);
    await _ensureDraftRow(db);
  }

  Future<void> _migrateV2ToV3(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS menu_item_variants (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price_cents INTEGER NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        sku TEXT,
        barcode TEXT,
        FOREIGN KEY (item_id) REFERENCES menu_items (id)
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS item_modifier_groups (
        item_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        name TEXT NOT NULL,
        min_select INTEGER NOT NULL DEFAULT 0,
        max_select INTEGER NOT NULL DEFAULT 1,
        is_required INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (item_id, group_id),
        FOREIGN KEY (item_id) REFERENCES menu_items (id)
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS modifier_options (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price_cents INTEGER NOT NULL DEFAULT 0,
        display_order INTEGER NOT NULL DEFAULT 0
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS menu_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');
    await _tryAddColumn(db, 'menu_items', 'description', 'TEXT');
    await _tryAddColumn(db, 'menu_items', 'barcode', 'TEXT');
    await _tryAddColumn(db, 'menu_items', 'image_url', 'TEXT');
    await _tryAddColumn(db, 'menu_items', 'is_combo', 'INTEGER NOT NULL DEFAULT 0');
    await _tryAddColumn(db, 'menu_items', 'display_order', 'INTEGER NOT NULL DEFAULT 0');
  }

  Future<void> _tryAddColumn(
    Database db,
    String table,
    String column,
    String definition,
  ) async {
    try {
      await db.execute('ALTER TABLE $table ADD COLUMN $column $definition');
    } catch (_) {}
  }

  Future<void> _ensureDraftRow(Database db) async {
    await db.insert(
      'draft_cart',
      {
        'id': 1,
        'payload': '{"lines":[]}',
        'updated_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.ignore,
    );
  }

  Future<void> _seedMenu(Database db) async {
    final batch = db.batch();
    batch.insert('menu_categories', {
      'id': 'cat_bev',
      'name': 'Beverages',
      'sort_order': 0,
    });
    batch.insert('menu_categories', {
      'id': 'cat_main',
      'name': 'Mains',
      'sort_order': 1,
    });
    batch.insert('menu_categories', {
      'id': 'cat_des',
      'name': 'Desserts',
      'sort_order': 2,
    });

    void item(String id, String cat, String name, int cents) {
      batch.insert('menu_items', {
        'id': id,
        'category_id': cat,
        'name': name,
        'price_cents': cents,
      });
    }

    item('item_coffee', 'cat_bev', 'Coffee', 350);
    item('item_tea', 'cat_bev', 'Tea', 300);
    item('item_soda', 'cat_bev', 'Soda', 250);
    item('item_burger', 'cat_main', 'Burger', 1200);
    item('item_pizza', 'cat_main', 'Pizza', 1500);
    item('item_pasta', 'cat_main', 'Pasta', 1100);
    item('item_cake', 'cat_des', 'Cake', 600);
    item('item_icecream', 'cat_des', 'Ice cream', 450);

    void mod(String id, String item, String name, int delta) {
      batch.insert('menu_modifiers', {
        'id': id,
        'item_id': item,
        'name': name,
        'price_delta_cents': delta,
      });
    }

    mod('mod_bg_cheese', 'item_burger', 'Extra cheese', 150);
    mod('mod_bg_bacon', 'item_burger', 'Bacon', 200);
    mod('mod_bg_patty', 'item_burger', 'Extra patty', 400);
    mod('mod_pz_xcheese', 'item_pizza', 'Extra cheese', 200);
    mod('mod_pz_gf', 'item_pizza', 'Gluten-free crust', 350);

    await batch.commit(noResult: true);
  }

  Future<void> _createTablesOfflineTables(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS tables_layout_cache (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS table_actions_queue (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0
      )
    ''');
  }

  Future<void> _createPaymentActionsQueue(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS payment_actions_queue (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0
      )
    ''');
  }

  Future<void> _createSyncOutboxAndState(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS sync_outbox (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        op_type TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        synced INTEGER NOT NULL DEFAULT 0,
        next_retry_at TEXT
      )
    ''');
    await db.execute('''
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_outbox_idem_pending
      ON sync_outbox(idempotency_key) WHERE synced = 0
    ''');
    await db.execute('''
      CREATE TABLE IF NOT EXISTS sync_state (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
      )
    ''');
  }

  Future<void> _migrateLegacyQueuesToSyncOutbox(Database db) async {
    const uuid = Uuid();

    final orderRows = await db.query('orders', where: 'synced = ?', whereArgs: [0]);
    for (final r in orderRows) {
      final legacyId = r['id'] as String;
      final raw = jsonDecode(r['payload'] as String) as Map<String, dynamic>;
      final linesIn = raw['lines'] as List<dynamic>? ?? [];
      final clientOrderId = uuid.v4();
      final lines = <Map<String, dynamic>>[];
      for (final e in linesIn) {
        final m = Map<String, dynamic>.from(e as Map);
        final mods = (m['modifiers'] as List<dynamic>? ?? [])
            .map((x) => <String, dynamic>{'id': (x as Map)['id']})
            .toList();
        lines.add({
          'menu_item_id': m['item_id'],
          'qty': m['qty'],
          if (m['variant_id'] != null) 'variant_id': m['variant_id'],
          'notes': m['notes'] ?? '',
          'modifiers': mods,
        });
      }
      final createdAt = r['created_at'] as String? ?? DateTime.now().toIso8601String();
      await db.insert('sync_outbox', {
        'id': 'mig_ord_$legacyId',
        'domain': 'order',
        'op_type': 'create_takeaway',
        'idempotency_key': 'mig_order_$legacyId',
        'payload': jsonEncode({
          'client_order_id': clientOrderId,
          'lines': lines,
        }),
        'created_at': createdAt,
        'attempt_count': 0,
        'last_error': null,
        'synced': 0,
        'next_retry_at': null,
      });
      await db.update(
        'orders',
        {'synced': 1},
        where: 'id = ?',
        whereArgs: [legacyId],
      );
    }

    final payRows =
        await db.query('payment_actions_queue', where: 'synced = ?', whereArgs: [0]);
    for (final r in payRows) {
      final rowId = r['id'] as String;
      final action = r['action'] as String;
      final payload =
          jsonDecode(r['payload'] as String) as Map<String, dynamic>;
      final createdAt = r['created_at'] as String? ?? DateTime.now().toIso8601String();
      if (action == 'add_payment') {
        final idem =
            (payload['idempotency_key'] as String?) ?? 'mig_pay_$rowId';
        await db.insert('sync_outbox', {
          'id': 'mig_pay_$rowId',
          'domain': 'payment',
          'op_type': 'add',
          'idempotency_key': idem,
          'payload': jsonEncode({
            'order_id': payload['order_id'],
            'payment_method': payload['payment_method'],
            'amount': payload['amount'],
            'idempotency_key': idem,
            if (payload['offline_status'] != null)
              'offline_status': payload['offline_status'],
          }),
          'created_at': createdAt,
          'attempt_count': 0,
          'last_error': null,
          'synced': 0,
          'next_retry_at': null,
        });
      } else if (action == 'split_payment') {
        final splits = payload['splits'] as List<dynamic>? ?? [];
        await db.insert('sync_outbox', {
          'id': 'mig_spl_$rowId',
          'domain': 'payment',
          'op_type': 'split',
          'idempotency_key': 'mig_split_$rowId',
          'payload': jsonEncode({
            'order_id': payload['order_id'],
            'splits': splits,
          }),
          'created_at': createdAt,
          'attempt_count': 0,
          'last_error': null,
          'synced': 0,
          'next_retry_at': null,
        });
      } else if (action == 'close_order') {
        final oid = payload['order_id'] as String;
        await db.insert('sync_outbox', {
          'id': 'mig_cls_$rowId',
          'domain': 'order',
          'op_type': 'close',
          'idempotency_key': 'close_$oid',
          'payload': jsonEncode({'order_id': oid}),
          'created_at': createdAt,
          'attempt_count': 0,
          'last_error': null,
          'synced': 0,
          'next_retry_at': null,
        });
      }
      await db.update(
        'payment_actions_queue',
        {'synced': 1},
        where: 'id = ?',
        whereArgs: [rowId],
      );
    }

    final tableRows =
        await db.query('table_actions_queue', where: 'synced = ?', whereArgs: [0]);
    for (final r in tableRows) {
      final rowId = r['id'] as String;
      final action = r['action'] as String;
      final payload =
          jsonDecode(r['payload'] as String) as Map<String, dynamic>;
      final createdAt = r['created_at'] as String? ?? DateTime.now().toIso8601String();
      String opType;
      switch (action) {
        case 'open_table':
          opType = 'open_table';
          break;
        case 'transfer_table':
          opType = 'transfer_table';
          break;
        case 'merge_orders':
          opType = 'merge_orders';
          break;
        default:
          opType = action;
      }
      await db.insert('sync_outbox', {
        'id': 'mig_tbl_$rowId',
        'domain': 'table',
        'op_type': opType,
        'idempotency_key': 'mig_table_$rowId',
        'payload': jsonEncode(payload),
        'created_at': createdAt,
        'attempt_count': 0,
        'last_error': null,
        'synced': 0,
        'next_retry_at': null,
      });
      await db.update(
        'table_actions_queue',
        {'synced': 1},
        where: 'id = ?',
        whereArgs: [rowId],
      );
    }
  }
}
