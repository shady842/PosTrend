import 'package:flutter/material.dart';
import '../../core/config/api_config.dart';
import '../../core/storage/local_storage.dart';
import '../../services/pos_realtime_sync.dart';
import 'api_url_editor.dart';
import 'cashier_login_screen.dart';
import 'device_login_screen.dart';
import 'printing/printer_settings_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Device settings and POS hardware preferences.'),
            const SizedBox(height: 16),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('API server URL'),
              subtitle: Text(
                ApiConfig.baseUrl,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
              ),
              trailing: const Icon(Icons.edit),
              onTap: () => showApiUrlEditor(context),
            ),
            const SizedBox(height: 8),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const PrinterSettingsScreen(),
                  ),
                );
              },
              icon: const Icon(Icons.print),
              label: const Text('Printer settings'),
            ),
            const SizedBox(height: 10),
            ElevatedButton.icon(
              onPressed: () async {
                await PosRealtimeSync.instance.stop();
                final s = LocalStorage();
                final deviceToken = await s.getDeviceAuthToken();
                if (deviceToken != null && deviceToken.isNotEmpty) {
                  await s.saveJwt(deviceToken);
                } else {
                  await s.saveJwt('');
                }
                await s.saveRefreshToken('');
                if (!context.mounted) return;
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const CashierLoginScreen()),
                  (route) => false,
                );
              },
              icon: const Icon(Icons.badge_outlined),
              label: const Text('Switch cashier'),
            ),
            const SizedBox(height: 10),
            ElevatedButton.icon(
              onPressed: () async {
                await PosRealtimeSync.instance.stop();
                await LocalStorage().clearSession();
                if (!context.mounted) return;
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const DeviceLoginScreen()),
                  (route) => false,
                );
              },
              icon: const Icon(Icons.logout),
              label: const Text('Logout device'),
            ),
          ],
        ),
      ),
    );
  }
}
