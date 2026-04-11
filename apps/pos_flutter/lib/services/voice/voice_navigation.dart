import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import 'voice_natural_intent.dart';
import '../../presentation/widgets/payment_by_order_id_sheet.dart';
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

class VoiceNavigation {
  VoiceNavigation._();

  /// Multi-word phrases use substring match; short single words use word boundaries to reduce false positives.
  static bool phraseMatches(String haystack, String phrase) {
    final h = haystack.toLowerCase().trim();
    final p = phrase.toLowerCase().trim();
    if (p.isEmpty) return false;
    if (p.contains(' ')) return h.contains(p);
    if (p.length <= 2) return h.contains(p);
    return RegExp(r'\b' + RegExp.escape(p) + r'\b').hasMatch(h);
  }

  static const _pairs = <(List<String>, String)>[
    (['orders', 'order list', 'open orders', 'receipt', 'tickets'], 'orders'),
    (['tables', 'floor plan', 'dine in', 'dining', 'seating'], 'tables'),
    (['delivery', 'takeout car', 'driver'], 'delivery'),
    (['payment', 'pay', 'checkout', 'collect money', 'card payment'], 'payment'),
    (['kitchen', 'kds', 'kitchen display', 'prep', 'prepare'], 'kds'),
    (['journal', 'closed checks', 'history', 'day book'], 'journal'),
    (['shift', 'open shift', 'close shift', 'cash drawer', 'z report'], 'shift'),
    (['settings', 'setup', 'configuration', 'printer'], 'settings'),
    (
      [
        'go back',
        'go home',
        'take me back',
        'navigate back',
        'back one screen',
        'close screen',
        'cancel screen',
        'return',
        'previous',
        'pop',
        'back',
      ],
      'back',
    ),
  ];

  static void _snack(String message) {
    final ctx = AppNavigator.maybeContext;
    if (ctx == null || !ctx.mounted) return;
    ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(message)));
  }

  /// Does not [await] route pushes so the global voice mic is free immediately after a command.
  static void dispatch({
    required String heard,
    required Map<String, String> customPhraseToTarget,
  }) {
    final ctx = AppNavigator.maybeContext;
    if (ctx == null || !ctx.mounted) return;

    final text = heard.toLowerCase().trim();
    if (text.isEmpty) {
      _snack('No speech captured — try again');
      return;
    }

    for (final entry in customPhraseToTarget.entries) {
      if (phraseMatches(text, entry.key)) {
        _go(ctx, entry.value);
        return;
      }
    }

    if (VoiceNaturalIntent.tryHandle(heard)) return;

    for (final pair in _pairs) {
      for (final phrase in pair.$1) {
        if (phraseMatches(text, phrase)) {
          _go(ctx, pair.$2);
          return;
        }
      }
    }

    _snack('No match for: "$heard". Try "orders", "kitchen", "go back", or add shortcuts in Settings.');
  }

  static void _go(BuildContext context, String target) {
    if (!context.mounted) return;
    final nav = Navigator.of(context);
    switch (target) {
      case 'back':
        unawaited(nav.maybePop());
        return;
      case 'orders':
        unawaited(
          nav.push<void>(
            MaterialPageRoute<void>(builder: (_) => const OrdersScreen()),
          ),
        );
        return;
      case 'tables':
        unawaited(
          nav.push<void>(
            MaterialPageRoute<void>(builder: (_) => const TablesScreen()),
          ),
        );
        return;
      case 'delivery':
        unawaited(
          nav.push<void>(
            MaterialPageRoute<void>(builder: (_) => const DeliveryScreen()),
          ),
        );
        return;
      case 'payment':
        unawaited(PaymentByOrderIdSheet.show(context));
        return;
      case 'kds':
        unawaited(
          nav.push<void>(
            MaterialPageRoute<void>(builder: (_) => const KdsScreen()),
          ),
        );
        return;
      case 'journal':
        unawaited(
          nav.push<void>(
            MaterialPageRoute<void>(builder: (_) => const JournalScreen()),
          ),
        );
        return;
      case 'shift':
        unawaited(
          nav.push<void>(
            MaterialPageRoute<void>(builder: (_) => const ShiftWizardScreen()),
          ),
        );
        return;
      case 'settings':
        unawaited(
          nav.push<void>(
            MaterialPageRoute<void>(builder: (_) => const SettingsScreen()),
          ),
        );
        return;
      default:
        return;
    }
  }
}
