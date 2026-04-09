import 'package:flutter/material.dart';
import '../../core/network/connectivity_service.dart';
import '../../core/storage/local_storage.dart';
import '../../data/local/app_database.dart';
import '../../services/menu_sync_service.dart';
import '../../services/sync_service.dart';
import 'pos_home_screen.dart';

class SyncLoadingScreen extends StatefulWidget {
  const SyncLoadingScreen({super.key});

  @override
  State<SyncLoadingScreen> createState() => _SyncLoadingScreenState();
}

class _SyncLoadingScreenState extends State<SyncLoadingScreen> {
  late final SyncService _syncService;

  @override
  void initState() {
    super.initState();
    final db = AppDatabase();
    _syncService = SyncService(
      ConnectivityService(),
      MenuSyncService(LocalStorage(), db),
      LocalStorage(),
      db,
    );
    _start();
  }

  Future<void> _start() async {
    _syncService.start();
    await _syncService.runNow();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const PosHomeScreen()),
    );
  }

  @override
  void dispose() {
    _syncService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 12),
            Text('Syncing local data...'),
          ],
        ),
      ),
    );
  }
}
