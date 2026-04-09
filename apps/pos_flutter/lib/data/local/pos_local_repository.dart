import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';

import '../../domain/entities/cart_line.dart';
import '../../domain/entities/pos_menu.dart';
import 'app_database.dart';
import 'sync_outbox_repository.dart';

class PosLocalRepository {
  PosLocalRepository(this._appDb);

  final AppDatabase _appDb;

  Future<Database> get _db => _appDb.database;

  SyncOutboxRepository get _syncOutbox => SyncOutboxRepository(_appDb);

  static int _apiMoneyToCents(dynamic v) {
    if (v == null) return 0;
    return ((v as num).toDouble() * 100).round();
  }

  MenuItem _rowToMenuItem(Map<String, Object?> r) {
    return MenuItem(
      id: r['id']! as String,
      categoryId: r['category_id']! as String,
      name: r['name']! as String,
      priceCents: (r['price_cents'] as num).toInt(),
      description: r['description'] as String?,
      barcode: r['barcode'] as String?,
      imageUrl: r['image_url'] as String?,
      isCombo: ((r['is_combo'] as int?) ?? 0) != 0,
      displayOrder: (r['display_order'] as int?) ?? 0,
    );
  }

  Future<List<MenuCategory>> loadCategories() async {
    final db = await _db;
    final rows = await db.query(
      'menu_categories',
      orderBy: 'sort_order ASC, name ASC',
    );
    return rows
        .map(
          (r) => MenuCategory(
            id: r['id']! as String,
            name: r['name']! as String,
            sortOrder: (r['sort_order'] as int?) ?? 0,
          ),
        )
        .toList();
  }

  /// When [search] is non-empty, returns matches across all categories.
  /// Otherwise filters by [categoryId] (required for category browsing).
  Future<List<MenuItem>> loadItemsForDisplay({
    required String? categoryId,
    String search = '',
  }) async {
    final db = await _db;
    final q = search.trim().toLowerCase();
    if (q.isEmpty) {
      final id = categoryId;
      if (id == null) {
        final rows = await db.query(
          'menu_items',
          orderBy: 'display_order ASC, name ASC',
        );
        return rows.map(_rowToMenuItem).toList();
      }
      final rows = await db.query(
        'menu_items',
        where: 'category_id = ?',
        whereArgs: [id],
        orderBy: 'display_order ASC, name ASC',
      );
      return rows.map(_rowToMenuItem).toList();
    }

    final like = '%$q%';
    final rows = await db.rawQuery(
      '''
      SELECT * FROM menu_items
      WHERE lower(name) LIKE ?
         OR lower(ifnull(description, '')) LIKE ?
         OR lower(ifnull(barcode, '')) LIKE ?
      ORDER BY display_order ASC, name ASC
      ''',
      [like, like, like],
    );
    return rows.map(_rowToMenuItem).toList();
  }

  Future<List<MenuVariant>> loadVariants(String itemId) async {
    final db = await _db;
    final rows = await db.query(
      'menu_item_variants',
      where: 'item_id = ?',
      whereArgs: [itemId],
      orderBy: 'is_default DESC, name ASC',
    );
    return rows
        .map(
          (r) => MenuVariant(
            id: r['id']! as String,
            itemId: itemId,
            name: r['name']! as String,
            priceCents: (r['price_cents'] as num).toInt(),
            isDefault: ((r['is_default'] as int?) ?? 0) != 0,
            sku: r['sku'] as String?,
            barcode: r['barcode'] as String?,
          ),
        )
        .toList();
  }

  Future<List<MenuModifier>> loadModifiersForItem(String itemId) async {
    final db = await _db;
    final rows = await db.rawQuery(
      '''
      SELECT o.id AS oid,
             o.group_id AS gid,
             o.name AS oname,
             o.price_cents AS opc,
             g.name AS gname,
             g.sort_order AS gsort,
             o.display_order AS oord
      FROM modifier_options o
      INNER JOIN item_modifier_groups g
        ON o.group_id = g.group_id AND g.item_id = ?
      WHERE g.item_id = ?
      ORDER BY g.sort_order ASC, g.name ASC, o.display_order ASC, o.name ASC
      ''',
      [itemId, itemId],
    );
    if (rows.isNotEmpty) {
      return rows
          .map(
            (r) => MenuModifier(
              id: r['oid']! as String,
              itemId: itemId,
              name: '${r['gname']}: ${r['oname']}',
              priceDeltaCents: (r['opc']! as num).toInt(),
              groupId: r['gid'] as String?,
            ),
          )
          .toList();
    }
    try {
      final legacy = await db.query(
        'menu_modifiers',
        where: 'item_id = ?',
        whereArgs: [itemId],
        orderBy: 'name ASC',
      );
      return legacy
          .map(
            (r) => MenuModifier(
              id: r['id']! as String,
              itemId: itemId,
              name: r['name']! as String,
              priceDeltaCents: (r['price_delta_cents'] as num).toInt(),
            ),
          )
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<String?> getMenuMeta(String key) async {
    final db = await _db;
    final rows = await db.query(
      'menu_meta',
      where: 'key = ?',
      whereArgs: [key],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return rows.first['value'] as String?;
  }

  /// Replaces all catalog tables with API payload from [GET /v1/pos/menu].
  Future<void> replaceMenuFromApiPayload(Map<String, dynamic> data) async {
    final db = await _db;
    final categories = (data['categories'] as List<dynamic>? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    final items = (data['items'] as List<dynamic>? ?? [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();

    final needsUncat = items.any((m) {
      final c = m['category_id'];
      if (c == null) return true;
      return c.toString().trim().isEmpty;
    });

    await db.transaction((txn) async {
      await txn.delete('modifier_options');
      await txn.delete('item_modifier_groups');
      await txn.delete('menu_item_variants');
      final mm = await txn.rawQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='menu_modifiers'",
      );
      if (mm.isNotEmpty) {
        await txn.delete('menu_modifiers');
      }
      await txn.delete('menu_items');
      await txn.delete('menu_categories');

      for (final c in categories) {
        await txn.insert(
          'menu_categories',
          {
            'id': c['id'] as String,
            'name': c['name'] as String,
            'sort_order': (c['display_order'] as num?)?.toInt() ?? 0,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }

      if (needsUncat) {
        await txn.insert(
          'menu_categories',
          {
            'id': 'uncategorized',
            'name': 'Other',
            'sort_order': 9999,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }

      for (final m in items) {
        final id = m['id'] as String;
        var cid = m['category_id']?.toString().trim();
        if (cid == null || cid.isEmpty) {
          cid = 'uncategorized';
        }
        await txn.insert(
          'menu_items',
          {
            'id': id,
            'category_id': cid,
            'name': m['name'] as String,
            'description': m['description'] as String?,
            'barcode': m['barcode'] as String?,
            'image_url': m['image_url'] as String?,
            'is_combo': (m['is_combo'] == true) ? 1 : 0,
            'display_order': 0,
            'price_cents': _apiMoneyToCents(m['price']),
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );

        for (final v in (m['variants'] as List<dynamic>? ?? [])) {
          final vm = Map<String, dynamic>.from(v as Map);
          await txn.insert(
            'menu_item_variants',
            {
              'id': vm['id'] as String,
              'item_id': id,
              'name': vm['name'] as String,
              'price_cents': _apiMoneyToCents(vm['price']),
              'is_default': (vm['is_default'] == true) ? 1 : 0,
              'sku': vm['sku'] as String?,
              'barcode': vm['barcode'] as String?,
            },
            conflictAlgorithm: ConflictAlgorithm.replace,
          );
        }

        var gOrder = 0;
        for (final g in (m['modifiers'] as List<dynamic>? ?? [])) {
          final gm = Map<String, dynamic>.from(g as Map);
          final gid = gm['id'] as String;
          await txn.insert(
            'item_modifier_groups',
            {
              'item_id': id,
              'group_id': gid,
              'name': gm['name'] as String,
              'min_select': (gm['min_select'] as num?)?.toInt() ?? 0,
              'max_select': (gm['max_select'] as num?)?.toInt() ?? 1,
              'is_required': (gm['is_required'] == true) ? 1 : 0,
              'sort_order': gOrder++,
            },
            conflictAlgorithm: ConflictAlgorithm.replace,
          );
          for (final o in (gm['options'] as List<dynamic>? ?? [])) {
            final om = Map<String, dynamic>.from(o as Map);
            await txn.insert(
              'modifier_options',
              {
                'id': om['id'] as String,
                'group_id': gid,
                'name': om['name'] as String,
                'price_cents': _apiMoneyToCents(om['price']),
                'display_order': (om['display_order'] as num?)?.toInt() ?? 0,
              },
              conflictAlgorithm: ConflictAlgorithm.replace,
            );
          }
        }
      }

      final branchId = data['branch_id']?.toString() ?? '';
      await txn.insert(
        'menu_meta',
        {
          'key': 'last_menu_sync_at',
          'value': DateTime.now().toUtc().toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      await txn.insert(
        'menu_meta',
        {'key': 'menu_branch_id', 'value': branchId},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    });
  }

  Future<List<CartLine>> loadDraft() async {
    final db = await _db;
    final rows = await db.query('draft_cart', where: 'id = 1', limit: 1);
    if (rows.isEmpty) return [];
    final payload = rows.first['payload'] as String? ?? '{"lines":[]}';
    return CartLine.decodeCart(payload);
  }

  Future<void> saveDraft(List<CartLine> lines) async {
    final db = await _db;
    await db.update(
      'draft_cart',
      {
        'payload': CartLine.encodeCart(lines),
        'updated_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [1],
    );
  }

  /// Queues a takeaway order for [POST /v1/sync/push] (`order` / `create_takeaway`).
  Future<void> queueOrderForSync(List<CartLine> lines) async {
    if (lines.isEmpty) return;
    const uuid = Uuid();
    final clientOrderId = uuid.v4();
    final lineMaps = lines
        .map(
          (l) => <String, dynamic>{
            'menu_item_id': l.itemId,
            'qty': l.qty,
            if (l.variantId != null) 'variant_id': l.variantId,
            'notes': l.notes,
            'modifiers':
                l.modifiers.map((m) => <String, dynamic>{'id': m.id}).toList(),
          },
        )
        .toList();
    await _syncOutbox.enqueue(
      domain: 'order',
      opType: 'create_takeaway',
      idempotencyKey: 'order_$clientOrderId',
      payload: {
        'client_order_id': clientOrderId,
        'lines': lineMaps,
      },
    );
  }

  Future<int> countPendingOrders() => _syncOutbox.countPendingOrders();
}
