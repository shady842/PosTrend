import 'menu_sync_service.dart';

/// Applies server hints after [GET /v1/sync/pull] (e.g. refresh catalog when newer menu exists).
class SyncConflictResolver {
  SyncConflictResolver(this._menuSync);

  final MenuSyncService _menuSync;

  Future<void> applyPullResponse(Map<String, dynamic>? pull) async {
    if (pull == null) return;
    final hints = pull['hints'];
    if (hints is! Map) return;
    if (hints['refresh_menu'] == true) {
      await _menuSync.syncIfPossible();
    }
  }
}
