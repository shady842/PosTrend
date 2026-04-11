import 'dart:async';

import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb;
import 'package:flutter/material.dart';

import '../../core/network/connectivity_service.dart';
import '../../core/storage/local_storage.dart';
import '../../services/pos_realtime_sync.dart';
import '../../services/voice/pos_voice_service.dart';
import '../../services/voice/voice_navigation.dart';
import '../../widgets/large_touch_button.dart';
import 'kds_screen.dart';
import 'delivery_screen.dart';
import 'journal_screen.dart';
import 'orders_screen.dart';
import 'payment_screen.dart';
import 'settings_screen.dart';
import 'shift_wizard_screen.dart';
import 'tables_screen.dart';

class PosHomeScreen extends StatefulWidget {
  const PosHomeScreen({super.key});

  @override
  State<PosHomeScreen> createState() => _PosHomeScreenState();
}

class _PosHomeScreenState extends State<PosHomeScreen> {
  final _storage = LocalStorage();
  bool _online = true;
  bool _voiceCommandsEnabled = false;
  bool _voiceListening = false;

  Future<void> _openPaymentByOrderId() async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Take payment'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            labelText: 'Order ID',
            hintText: 'Paste server order UUID',
            border: OutlineInputBorder(),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Open'),
          ),
        ],
      ),
    );
    if (!mounted || ok != true) return;
    final id = ctrl.text.trim();
    if (id.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter an order ID')),
      );
      return;
    }
    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => PaymentScreen(orderId: id),
      ),
    );
  }

  Future<void> _reloadVoicePref() async {
    final v = await _storage.getVoiceCommandsEnabled();
    if (mounted) setState(() => _voiceCommandsEnabled = v);
  }

  Future<void> _onVoiceMicPressed() async {
    if (_voiceListening) return;
    setState(() => _voiceListening = true);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Listening… speak a command (e.g. “orders”, “kitchen”).'),
          duration: Duration(seconds: 14),
        ),
      );
    }
    try {
      final text = await PosVoiceService.instance.listenOnce();
      if (!mounted) return;
      if (text == null || text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No speech heard — try again')),
        );
        return;
      }
      final raw = await _storage.getVoiceShortcutsLines();
      if (!mounted) return;
      final custom = parseVoiceShortcutLines(raw);
      await VoiceNavigation.dispatch(
        context: context,
        heard: text,
        customPhraseToTarget: custom,
        openPaymentFlow: _openPaymentByOrderId,
      );
    } finally {
      if (mounted) setState(() => _voiceListening = false);
    }
  }

  @override
  void initState() {
    super.initState();
    unawaited(_reloadVoicePref());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(PosRealtimeSync.instance.start());
    });
    ConnectivityService().watchOnline().listen((online) {
      if (mounted) setState(() => _online = online);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isTablet = MediaQuery.of(context).size.shortestSide >= 600;
    final showVoiceFab =
        !kIsWeb && defaultTargetPlatform == TargetPlatform.android && _voiceCommandsEnabled;

    return Scaffold(
      floatingActionButton: showVoiceFab
          ? FloatingActionButton.large(
              onPressed: _voiceListening ? null : _onVoiceMicPressed,
              tooltip: 'Voice command',
              child: _voiceListening
                  ? const Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white),
                    )
                  : const Icon(Icons.mic),
            )
          : null,
      appBar: AppBar(
        title: const Text('POS Home'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Center(
              child: ListenableBuilder(
                listenable: PosRealtimeSync.instance,
                builder: (context, _) {
                  final live = PosRealtimeSync.instance.connected;
                  return Tooltip(
                    message: live
                        ? 'Realtime: connected (orders branch)'
                        : 'Realtime: disconnected',
                    child: Icon(
                      Icons.podcasts,
                      color: live ? Colors.lightGreenAccent : Colors.white54,
                      size: 22,
                    ),
                  );
                },
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                _online ? 'Online' : 'Offline',
                style: TextStyle(
                  color: _online ? Colors.green : Colors.orange,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(14),
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.22),
                Theme.of(context).colorScheme.tertiaryContainer.withValues(alpha: 0.12),
                Theme.of(context).colorScheme.surface,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
          ),
          child: GridView.count(
            padding: const EdgeInsets.all(14),
            crossAxisCount: isTablet ? 3 : 2,
            crossAxisSpacing: 14,
            mainAxisSpacing: 14,
            childAspectRatio: 2.1,
            children: [
              LargeTouchButton(
                label: 'Orders',
                icon: Icons.receipt_long,
                color: Colors.indigo,
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OrdersScreen())),
              ),
              LargeTouchButton(
                label: 'Tables',
                icon: Icons.table_restaurant,
                color: Colors.teal,
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const TablesScreen())),
              ),
              LargeTouchButton(
                label: 'Delivery',
                icon: Icons.delivery_dining,
                color: Colors.deepOrange,
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const DeliveryScreen()),
                ),
              ),
              LargeTouchButton(
                label: 'Payment',
                icon: Icons.payments,
                color: Colors.purple,
                onPressed: _openPaymentByOrderId,
              ),
              LargeTouchButton(
                label: 'KDS',
                icon: Icons.kitchen,
                color: Colors.blue,
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const KdsScreen()),
                ),
              ),
              LargeTouchButton(
                label: 'Journal',
                icon: Icons.menu_book_outlined,
                color: Colors.deepPurple,
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const JournalScreen()),
                ),
              ),
              LargeTouchButton(
                label: 'Shift',
                icon: Icons.point_of_sale,
                color: Colors.green,
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ShiftWizardScreen()),
                ),
              ),
              LargeTouchButton(
                label: 'Settings',
                icon: Icons.settings,
                color: Colors.brown,
                onPressed: () async {
                  await Navigator.push<void>(
                    context,
                    MaterialPageRoute<void>(builder: (_) => const SettingsScreen()),
                  );
                  await _reloadVoicePref();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
