import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import 'app_database.dart';

class SyncOutboxDiagnostics {
  SyncOutboxDiagnostics({
    required this.pendingCount,
    required this.latestError,
  });

  final int pendingCount;
  final String? latestError;
}

class SyncOutboxRepository {
  SyncOutboxRepository(this._appDb);

  final AppDatabase _appDb;

  Future<Database> get _db => _appDb.database;

  Future<void> enqueue({
    required String domain,
    required String opType,
    required String idempotencyKey,
    required Map<String, dynamic> payload,
  }) async {
    final db = await _db;
    final id = 'sb_${DateTime.now().toUtc().microsecondsSinceEpoch}';
    try {
      await db.insert('sync_outbox', {
        'id': id,
        'domain': domain,
        'op_type': opType,
        'idempotency_key': idempotencyKey,
        'payload': jsonEncode(payload),
        'created_at': DateTime.now().toIso8601String(),
        'attempt_count': 0,
        'last_error': null,
        'synced': 0,
        'next_retry_at': null,
      });
    } on DatabaseException catch (e) {
      if (e.toString().contains('UNIQUE constraint')) return;
      rethrow;
    }
  }

  Future<int> countPendingOrders() async {
    final db = await _db;
    final n = Sqflite.firstIntValue(
      await db.rawQuery(
        "SELECT COUNT(*) FROM sync_outbox WHERE synced = 0 AND domain = 'order' AND op_type = 'create_takeaway'",
      ),
    );
    return n ?? 0;
  }

  Future<int> countPendingAll() async {
    final db = await _db;
    final n = Sqflite.firstIntValue(
      await db.rawQuery('SELECT COUNT(*) FROM sync_outbox WHERE synced = 0'),
    );
    return n ?? 0;
  }

  Future<SyncOutboxDiagnostics> diagnostics() async {
    final db = await _db;
    final pending = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM sync_outbox WHERE synced = 0'),
        ) ??
        0;
    final rows = await db.rawQuery(
      '''
      SELECT last_error
      FROM sync_outbox
      WHERE synced = 0 AND last_error IS NOT NULL AND last_error <> ''
      ORDER BY created_at DESC
      LIMIT 1
      ''',
    );
    final latest = rows.isEmpty ? null : (rows.first['last_error'] as String?);
    return SyncOutboxDiagnostics(pendingCount: pending, latestError: latest);
  }

  Future<int> countPendingPaymentUi() async {
    final db = await _db;
    final n = Sqflite.firstIntValue(
      await db.rawQuery(
        "SELECT COUNT(*) FROM sync_outbox WHERE synced = 0 AND (domain = 'payment' OR (domain = 'order' AND op_type = 'close'))",
      ),
    );
    return n ?? 0;
  }

  Future<List<Map<String, Object?>>> loadPendingBatch({int limit = 25}) async {
    final db = await _db;
    final now = DateTime.now().toIso8601String();
    return db.rawQuery(
      '''
      SELECT * FROM sync_outbox
      WHERE synced = 0 AND (next_retry_at IS NULL OR next_retry_at <= ?)
      ORDER BY created_at ASC
      LIMIT ?
      ''',
      [now, limit],
    );
  }

  Future<void> markSynced(String id) async {
    final db = await _db;
    await db.update(
      'sync_outbox',
      {'synced': 1, 'last_error': null, 'next_retry_at': null},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> markFailed({
    required String id,
    required int attemptCount,
    required String error,
  }) async {
    final db = await _db;
    final backoffSec = _backoffSeconds(attemptCount);
    final next = DateTime.now().add(Duration(seconds: backoffSec));
    await db.update(
      'sync_outbox',
      {
        'attempt_count': attemptCount,
        'last_error': error.length > 500 ? error.substring(0, 500) : error,
        'next_retry_at': next.toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static int _backoffSeconds(int attempt) {
    const base = 5;
    final exp = base * (1 << (attempt.clamp(0, 8)));
    return exp.clamp(5, 900);
  }

  Future<String?> getSyncState(String key) async {
    final db = await _db;
    final rows = await db.query(
      'sync_state',
      where: 'k = ?',
      whereArgs: [key],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return rows.first['v'] as String?;
  }

  Future<void> setSyncState(String key, String value) async {
    final db = await _db;
    await db.insert(
      'sync_state',
      {'k': key, 'v': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Queue [POST /v1/sync/push] `shift` / `open` (e.g. from Settings when offline).
  Future<void> enqueueShiftOpen({
    required String name,
    required String openedBy,
    required double startingAmount,
  }) async {
    final idem = 'shift_open_${DateTime.now().toUtc().microsecondsSinceEpoch}';
    await enqueue(
      domain: 'shift',
      opType: 'open',
      idempotencyKey: idem,
      payload: {
        'name': name,
        'opened_by': openedBy,
        'starting_amount': startingAmount,
      },
    );
  }

  /// Queue shift close; use stable [shiftId] from server / pull response.
  Future<void> enqueueShiftClose({
    required String shiftId,
    required String closedBy,
    required double endingAmount,
  }) async {
    await enqueue(
      domain: 'shift',
      opType: 'close',
      idempotencyKey: 'shift_close_$shiftId',
      payload: {
        'shift_id': shiftId,
        'closed_by': closedBy,
        'ending_amount': endingAmount,
      },
    );
  }

  Future<int> countPendingTable() async {
    final db = await _db;
    final n = Sqflite.firstIntValue(
      await db.rawQuery(
        "SELECT COUNT(*) FROM sync_outbox WHERE synced = 0 AND domain = 'table'",
      ),
    );
    return n ?? 0;
  }
}
