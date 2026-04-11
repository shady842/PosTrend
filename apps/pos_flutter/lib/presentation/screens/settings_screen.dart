import 'package:flutter/material.dart';
import '../../core/config/api_config.dart';
import '../../core/storage/local_storage.dart';
import '../../services/pos_realtime_sync.dart';
import '../../services/voice/voice_settings.dart';
import 'api_url_editor.dart';
import 'cashier_login_screen.dart';
import 'device_login_screen.dart';
import 'printing/printer_settings_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _storage = LocalStorage();
  final _voiceShortcuts = TextEditingController();
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    await VoiceSettings.instance.load();
    final lines = await _storage.getVoiceShortcutsLines();
    if (!mounted) return;
    setState(() {
      _voiceShortcuts.text = lines;
      _loaded = true;
    });
  }

  @override
  void dispose() {
    _voiceShortcuts.dispose();
    super.dispose();
  }

  Future<void> _saveShortcuts() async {
    await _storage.saveVoiceShortcutsLines(_voiceShortcuts.text);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Voice shortcuts saved')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: !_loaded
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
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
                  const Divider(height: 28),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Voice commands (Android)'),
                    subtitle: const Text(
                      'Floating mic on every screen. Say “orders”, “kitchen”, “go back”, etc., or add phrases below.',
                    ),
                    value: VoiceSettings.instance.enabled,
                    onChanged: (v) async {
                      await VoiceSettings.instance.setEnabled(v);
                      if (mounted) setState(() {});
                    },
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Hands-free (continuous listening)'),
                    subtitle: const Text(
                      'After each command, listen again until you say “stop listening” or tap Stop.',
                    ),
                    value: VoiceSettings.instance.continuous,
                    onChanged: VoiceSettings.instance.enabled
                        ? (v) async {
                            await VoiceSettings.instance.setContinuous(v);
                            if (mounted) setState(() {});
                          }
                        : null,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Extra phrases (optional)',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'One per line: phrase = screen. Screen ids: orders, tables, delivery, payment, kds, journal, shift, settings, back.\nExample: front of house = tables',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).hintColor),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _voiceShortcuts,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      alignLabelWithHint: true,
                      hintText: 'my phrase = kds',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: _saveShortcuts,
                      icon: const Icon(Icons.save_outlined),
                      label: const Text('Save voice shortcuts'),
                    ),
                  ),
                  const SizedBox(height: 20),
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
                      final deviceToken = await _storage.getDeviceAuthToken();
                      if (deviceToken != null && deviceToken.isNotEmpty) {
                        await _storage.saveJwt(deviceToken);
                      } else {
                        await _storage.saveJwt('');
                      }
                      await _storage.saveRefreshToken('');
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
