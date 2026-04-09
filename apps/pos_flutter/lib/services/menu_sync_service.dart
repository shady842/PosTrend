import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/api_config.dart';
import '../core/storage/local_storage.dart';
import '../data/local/app_database.dart';
import '../data/local/pos_local_repository.dart';

/// Fetches [GET /v1/pos/menu] and persists to SQLite (offline catalog).
class MenuSyncService {
  MenuSyncService(this._storage, this._appDb);

  final LocalStorage _storage;
  final AppDatabase _appDb;

  PosLocalRepository get _repo => PosLocalRepository(_appDb);

  Future<bool> syncIfPossible() async {
    try {
      final token = await _storage.getJwt();
      if (token == null || token.isEmpty) return false;
      final res = await http
          .get(
            Uri.parse(ApiConfig.posMenuUrl),
            headers: {
              'Authorization': 'Bearer $token',
              'Accept': 'application/json',
            },
          )
          .timeout(const Duration(seconds: 45));
      if (res.statusCode < 200 || res.statusCode >= 300) return false;
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      await _repo.replaceMenuFromApiPayload(data);
      return true;
    } catch (_) {
      return false;
    }
  }
}
