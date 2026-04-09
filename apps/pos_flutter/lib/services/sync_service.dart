import 'dart:async';

import '../core/network/connectivity_service.dart';
import '../core/storage/local_storage.dart';
import '../data/local/app_database.dart';
import 'menu_sync_service.dart';
import 'offline_sync_engine.dart';
import 'sync_conflict_resolver.dart';

class SyncService {
  SyncService(
    this._connectivity,
    this._menuSync,
    this._storage,
    this._appDb,
  );

  final ConnectivityService _connectivity;
  final MenuSyncService? _menuSync;
  final LocalStorage _storage;
  final AppDatabase _appDb;
  StreamSubscription<bool>? _sub;
  Timer? _timer;

  Future<void> _runEnginePullPush() async {
    final engine = OfflineSyncEngine(_storage, _appDb);
    await engine.runPush();
    final pull = await engine.runPull();
    if (_menuSync != null) {
      await SyncConflictResolver(_menuSync).applyPullResponse(pull);
    }
  }

  void start() {
    _sub = _connectivity.watchOnline().listen((online) async {
      if (online) {
        await _menuSync?.syncIfPossible();
        await _runEnginePullPush();
      }
    });
    _timer = Timer.periodic(const Duration(seconds: 45), (_) async {
      if (!await _connectivity.isOnline()) return;
      await _runEnginePullPush();
    });
  }

  Future<void> runNow() async {
    await _menuSync?.syncIfPossible();
    await _runEnginePullPush();
    await Future<void>.delayed(const Duration(milliseconds: 200));
  }

  void dispose() {
    _sub?.cancel();
    _timer?.cancel();
  }
}
