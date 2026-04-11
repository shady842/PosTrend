import 'package:flutter/material.dart';

import '../../presentation/screens/delivery_screen.dart';
import '../../presentation/screens/journal_screen.dart';
import '../../presentation/screens/kds_screen.dart';
import '../../presentation/screens/orders_screen.dart';
import '../../presentation/screens/settings_screen.dart';
import '../../presentation/screens/shift_wizard_screen.dart';
import '../../presentation/screens/tables_screen.dart';

const _allowedTargets = <String>{
  'orders',
  'tables',
  'delivery',
  'payment',
  'kds',
  'journal',
  'shift',
  'settings',
  'back',
};

/// Parses optional lines: `phrase = target` (target must be a known screen id).
Map<String, String> parseVoiceShortcutLines(String raw) {
  final out = <String, String>{};
  for (final line in raw.split('\n')) {
    final t = line.trim();
    if (t.isEmpty || t.startsWith('#')) continue;
    final eq = t.indexOf('=');
    if (eq <= 0) continue;
    final phrase = t.substring(0, eq).trim().toLowerCase();
    final target = t.substring(eq + 1).trim().toLowerCase();
    if (phrase.isEmpty || target.isEmpty) continue;
    if (!_allowedTargets.contains(target)) continue;
    out[phrase] = target;
  }
  return out;
}

typedef OpenPaymentFlow = Future<void> Function();

/// Maps spoken text to navigation on the POS home stack.
class VoiceNavigation {
  static const _pairs = <(List<String>, String)>[
    (['orders', 'order list', 'open orders', 'receipt', 'tickets'], 'orders'),
    (['tables', 'floor plan', 'dine in', 'dining', 'seating'], 'tables'),
    (['delivery', 'takeout car', 'driver'], 'delivery'),
    (['payment', 'pay', 'checkout', 'collect money', 'card payment'], 'payment'),
    (['kitchen', 'kds', 'kitchen display', 'prep', 'prepare'], 'kds'),
    (['journal', 'closed checks', 'history', 'day book'], 'journal'),
    (['shift', 'open shift', 'close shift', 'cash drawer', 'z report'], 'shift'),
    (['settings', 'setup', 'configuration', 'printer'], 'settings'),
    (['go back', 'go home', 'home screen', 'close screen', 'pop', 'cancel screen'], 'back'),
  ];

  static Future<void> dispatch({
    required BuildContext context,
    required String heard,
    required Map<String, String> customPhraseToTarget,
    required OpenPaymentFlow openPaymentFlow,
  }) async {
    if (!context.mounted) return;
    final text = heard.toLowerCase().trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No speech captured — try again')),
      );
      return;
    }

    for (final entry in customPhraseToTarget.entries) {
      if (text.contains(entry.key)) {
        await _go(context, entry.value, openPaymentFlow);
        return;
      }
    }

    for (final pair in _pairs) {
      for (final phrase in pair.$1) {
        if (text.contains(phrase)) {
          await _go(context, pair.$2, openPaymentFlow);
          return;
        }
      }
    }

    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('No match for: "$heard". Try a screen name (orders, tables, kds, …) or add shortcuts in Settings.'),
      ),
    );
  }

  static Future<void> _go(
    BuildContext context,
    String target,
    OpenPaymentFlow openPaymentFlow,
  ) async {
    if (!context.mounted) return;
    switch (target) {
      case 'back':
        if (Navigator.of(context).canPop()) {
          Navigator.of(context).pop();
        }
        return;
      case 'orders':
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(builder: (_) => const OrdersScreen()),
        );
        return;
      case 'tables':
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(builder: (_) => const TablesScreen()),
        );
        return;
      case 'delivery':
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(builder: (_) => const DeliveryScreen()),
        );
        return;
      case 'payment':
        await openPaymentFlow();
        return;
      case 'kds':
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(builder: (_) => const KdsScreen()),
        );
        return;
      case 'journal':
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(builder: (_) => const JournalScreen()),
        );
        return;
      case 'shift':
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(builder: (_) => const ShiftWizardScreen()),
        );
        return;
      case 'settings':
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(builder: (_) => const SettingsScreen()),
        );
        return;
      default:
        return;
    }
  }
}
