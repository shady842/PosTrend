import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/api_config.dart';
import '../core/storage/local_storage.dart';
import '../data/local/app_database.dart';
import '../data/local/sync_outbox_repository.dart';

const _kPullCursorKey = 'sync_pull_cursor';

/// Batches local outbox operations to [POST /v1/sync/push] and runs [GET /v1/sync/pull].
class OfflineSyncEngine {
  OfflineSyncEngine(this._storage, this._appDb);

  final LocalStorage _storage;
  final AppDatabase _appDb;

  SyncOutboxRepository get _outbox => SyncOutboxRepository(_appDb);

  Map<String, String> get _jsonHeaders => {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

  Future<String?> _bearer() async {
    final t = await _storage.getJwt();
    if (t == null || t.isEmpty) return null;
    return t;
  }

  String? _deviceIdFromJwt(String jwt) {
    final parts = jwt.split('.');
    if (parts.length < 2) return null;
    var payload = parts[1];
    switch (payload.length % 4) {
      case 2:
        payload += '==';
        break;
      case 3:
        payload += '=';
        break;
      case 1:
        return null;
      default:
        break;
    }
    try {
      final jsonStr = utf8.decode(base64Url.decode(payload));
      final map = jsonDecode(jsonStr) as Map<String, dynamic>;
      final sub = map['sub'] as String?;
      if (sub != null && sub.startsWith('device:')) {
        return sub.substring(7);
      }
    } catch (_) {}
    return null;
  }

  /// Push pending outbox rows (idempotent server-side ledger).
  Future<void> runPush() async {
    final token = await _bearer();
    if (token == null) return;

    final rows = await _outbox.loadPendingBatch(limit: 25);
    if (rows.isEmpty) return;

    final ops = <Map<String, dynamic>>[];
    final rowIds = <String>[];
    for (final r in rows) {
      final id = r['id'] as String;
      final domain = r['domain'] as String;
      final opType = r['op_type'] as String;
      final idem = r['idempotency_key'] as String;
      final payload =
          jsonDecode(r['payload'] as String) as Map<String, dynamic>;
      rowIds.add(id);
      ops.add({
        'domain': domain,
        'type': opType,
        'idempotency_key': idem,
        'payload': payload,
      });
    }

    final deviceId = _deviceIdFromJwt(token);
    final body = <String, dynamic>{'ops': ops};
    if (deviceId != null) body['device_id'] = deviceId;

    http.Response res;
    try {
      res = await http
          .post(
            Uri.parse(ApiConfig.syncPushUrl),
            headers: {
              ..._jsonHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 60));
    } catch (e) {
      for (var i = 0; i < rowIds.length; i++) {
        final r = rows[i];
        final id = r['id'] as String;
        final n = ((r['attempt_count'] as num?)?.toInt() ?? 0) + 1;
        await _outbox.markFailed(
          id: id,
          attemptCount: n,
          error: e.toString(),
        );
      }
      return;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      for (var i = 0; i < rowIds.length; i++) {
        final r = rows[i];
        final id = r['id'] as String;
        final n = ((r['attempt_count'] as num?)?.toInt() ?? 0) + 1;
        await _outbox.markFailed(
          id: id,
          attemptCount: n,
          error: 'HTTP ${res.statusCode}: ${res.body}',
        );
      }
      return;
    }

    Map<String, dynamic> data;
    try {
      data = jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      for (var i = 0; i < rowIds.length; i++) {
        final r = rows[i];
        final id = r['id'] as String;
        final n = ((r['attempt_count'] as num?)?.toInt() ?? 0) + 1;
        await _outbox.markFailed(
          id: id,
          attemptCount: n,
          error: 'Invalid sync response',
        );
      }
      return;
    }

    final results = data['results'] as List<dynamic>? ?? [];
    for (var i = 0; i < rowIds.length; i++) {
      final id = rowIds[i];
      final r = rows[i];
      if (i >= results.length) {
        final n = ((r['attempt_count'] as num?)?.toInt() ?? 0) + 1;
        await _outbox.markFailed(
          id: id,
          attemptCount: n,
          error: 'Missing result for op',
        );
        continue;
      }
      final item = results[i];
      if (item is! Map) {
        final n = ((r['attempt_count'] as num?)?.toInt() ?? 0) + 1;
        await _outbox.markFailed(
          id: id,
          attemptCount: n,
          error: 'Bad result entry',
        );
        continue;
      }
      final status = item['status'] as String? ?? '';
      if (status == 'applied' || status == 'duplicate') {
        await _outbox.markSynced(id);
      } else {
        final err = item['error']?.toString() ?? 'rejected';
        final n = ((r['attempt_count'] as num?)?.toInt() ?? 0) + 1;
        await _outbox.markFailed(
          id: id,
          attemptCount: n,
          error: err,
        );
      }
    }
  }

  /// Pull server hints (menu refresh, open shift). Updates stored cursor.
  Future<Map<String, dynamic>?> runPull() async {
    final token = await _bearer();
    if (token == null) return null;
    final cursor = await _outbox.getSyncState(_kPullCursorKey);
    try {
      final res = await http
          .get(
            Uri.parse(ApiConfig.syncPullUrl(cursor)),
            headers: {
              ..._jsonHeaders,
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 35));
      if (res.statusCode < 200 || res.statusCode >= 300) return null;
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final next = data['cursor_next'] as String?;
      if (next != null && next.isNotEmpty) {
        await _outbox.setSyncState(_kPullCursorKey, next);
      }
      return data;
    } catch (_) {
      return null;
    }
  }
}
