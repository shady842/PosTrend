import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:sqflite/sqflite.dart';

import '../core/config/api_config.dart';
import '../core/storage/local_storage.dart';
import '../data/local/app_database.dart';
import '../data/local/sync_outbox_repository.dart';
import '../domain/entities/table_layout.dart';
import 'offline_sync_engine.dart';

enum TableActionResult {
  applied,
  queued,
  failed,
}

class TablesLayoutService {
  TablesLayoutService(this._storage, this._appDb);

  final LocalStorage _storage;
  final AppDatabase _appDb;

  Future<Database> get _db => _appDb.database;

  SyncOutboxRepository get _outbox => SyncOutboxRepository(_appDb);

  Map<String, String> get _jsonAuthHeaders => {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

  Future<String?> _bearer() async {
    final t = await _storage.getJwt();
    if (t == null || t.isEmpty) return null;
    return t;
  }

  Future<void> _saveLayoutCache(String body) async {
    final db = await _db;
    await db.insert(
      'tables_layout_cache',
      {
        'id': 1,
        'payload': body,
        'updated_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<BranchTableLayout?> loadCachedLayout() async {
    final db = await _db;
    final rows = await db.query('tables_layout_cache', where: 'id = 1', limit: 1);
    if (rows.isEmpty) return null;
    final raw = rows.first['payload'] as String?;
    if (raw == null || raw.isEmpty) return null;
    return BranchTableLayout.tryParse(raw);
  }

  Future<DateTime?> cacheUpdatedAt() async {
    final db = await _db;
    final rows = await db.query('tables_layout_cache', where: 'id = 1', limit: 1);
    if (rows.isEmpty) return null;
    final s = rows.first['updated_at'] as String?;
    if (s == null) return null;
    return DateTime.tryParse(s);
  }

  /// Pulls layout from API, updates SQLite cache. Runs unified sync push afterward.
  Future<BranchTableLayout?> fetchLayoutRemote() async {
    final token = await _bearer();
    if (token == null) return null;
    final res = await http
        .get(
          Uri.parse(ApiConfig.posOrdersLayoutUrl),
          headers: {
            ..._jsonAuthHeaders,
            'Authorization': 'Bearer $token',
          },
        )
        .timeout(const Duration(seconds: 35));
    if (res.statusCode < 200 || res.statusCode >= 300) return null;
    await _saveLayoutCache(res.body);
    await OfflineSyncEngine(_storage, _appDb).runPush();
    return BranchTableLayout.tryParse(res.body);
  }

  Future<BranchTableLayout?> loadLayoutPreferRemote() async {
    final remote = await fetchLayoutRemote();
    if (remote != null) return remote;
    return loadCachedLayout();
  }

  Future<void> _enqueue(String action, Map<String, dynamic> payload) async {
    final idem = 'tbl_${action}_${DateTime.now().toUtc().microsecondsSinceEpoch}';
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
        return;
    }
    await _outbox.enqueue(
      domain: 'table',
      opType: opType,
      idempotencyKey: idem,
      payload: payload,
    );
  }

  Future<int> pendingQueueCount() => _outbox.countPendingTable();

  Future<void> flushActionQueue() async {
    await OfflineSyncEngine(_storage, _appDb).runPush();
  }

  Future<TableActionResult> openTable(String tableId, {int guestCount = 2}) async {
    final token = await _bearer();
    if (token == null) return TableActionResult.failed;
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.posOrdersOpenTableUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'table_id': tableId,
              'guest_count': guestCount,
            }),
          )
          .timeout(const Duration(seconds: 25));
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return TableActionResult.applied;
      }
      if (res.statusCode >= 500 || res.statusCode == 429) {
        await _enqueue('open_table', {
          'table_id': tableId,
          'guest_count': guestCount,
        });
        return TableActionResult.queued;
      }
      return TableActionResult.failed;
    } catch (_) {
      await _enqueue('open_table', {
        'table_id': tableId,
        'guest_count': guestCount,
      });
      return TableActionResult.queued;
    }
  }

  Future<TableActionResult> transferOrder(String orderId, String toTableId) async {
    final token = await _bearer();
    if (token == null) return TableActionResult.failed;
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.posOrdersTransferTableUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'order_id': orderId,
              'to_table_id': toTableId,
            }),
          )
          .timeout(const Duration(seconds: 25));
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return TableActionResult.applied;
      }
      if (res.statusCode >= 500 || res.statusCode == 429) {
        await _enqueue('transfer_table', {
          'order_id': orderId,
          'to_table_id': toTableId,
        });
        return TableActionResult.queued;
      }
      return TableActionResult.failed;
    } catch (_) {
      await _enqueue('transfer_table', {
        'order_id': orderId,
        'to_table_id': toTableId,
      });
      return TableActionResult.queued;
    }
  }

  Future<TableActionResult> mergeOrders(String sourceOrderId, String targetOrderId) async {
    final token = await _bearer();
    if (token == null) return TableActionResult.failed;
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.posOrdersMergeOrdersUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'source_order_id': sourceOrderId,
              'target_order_id': targetOrderId,
            }),
          )
          .timeout(const Duration(seconds: 25));
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return TableActionResult.applied;
      }
      if (res.statusCode >= 500 || res.statusCode == 429) {
        await _enqueue('merge_orders', {
          'source_order_id': sourceOrderId,
          'target_order_id': targetOrderId,
        });
        return TableActionResult.queued;
      }
      return TableActionResult.failed;
    } catch (_) {
      await _enqueue('merge_orders', {
        'source_order_id': sourceOrderId,
        'target_order_id': targetOrderId,
      });
      return TableActionResult.queued;
    }
  }
}
