import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../presentation/screens/orders_screen.dart';
import '../../presentation/screens/tables_screen.dart';

/// Parsed “open table N in section X” style intents (no cloud LLM — flexible regex + keywords).
class VoiceTableIntent {
  VoiceTableIntent({
    required this.tableNumber,
    this.sectionContains,
    this.guestCount = 2,
  });

  final int tableNumber;
  final String? sectionContains;
  final int guestCount;
}

/// Heuristic NLU for POS: runs before fixed screen shortcuts. Returns true if handled.
class VoiceNaturalIntent {
  VoiceNaturalIntent._();

  static String? _parseSectionFragment(String t) {
    final patterns = <RegExp>[
      RegExp(r'\bin\s+section\s+(.+?)(?:\s+for\s+\d+|\s+guests|\s*$)', caseSensitive: false),
      RegExp(r'\bsection\s+(.+?)(?:\s+for\s+\d+|\s+guests|\s*$)', caseSensitive: false),
      RegExp(r'\bon\s+(?:the\s+)?(.+?)\s+(?:floor|area)\b', caseSensitive: false),
    ];
    for (final re in patterns) {
      final m = re.firstMatch(t);
      if (m != null && m.groupCount >= 1) {
        final s = m.group(1)?.trim();
        if (s != null && s.length >= 2) return s;
      }
    }
    return null;
  }

  static int? _parseGuestCount(String t) {
    final m = RegExp(r'\bfor\s+(\d+)\s+guests?\b', caseSensitive: false).firstMatch(t);
    if (m != null) return int.tryParse(m.group(1) ?? '');
    final m2 = RegExp(r'\b(\d+)\s+guests?\b', caseSensitive: false).firstMatch(t);
    if (m2 != null) return int.tryParse(m2.group(1) ?? '');
    return null;
  }

  static VoiceTableIntent? _parseTableIntent(String t) {
    final guests = _parseGuestCount(t)?.clamp(1, 99) ?? 2;
    final section = _parseSectionFragment(t);

    final tableRes = <RegExp>[
      RegExp(r'\b(?:open|go to|show|select|seat at|seat)\s+table\s*#?\s*(\d+)\b', caseSensitive: false),
      RegExp(r'\btable\s*#?\s*(\d+)\b', caseSensitive: false),
      RegExp(r'\bt\s*#?\s*(\d+)\b', caseSensitive: false),
    ];
    for (final re in tableRes) {
      final m = re.firstMatch(t);
      if (m != null) {
        final n = int.tryParse(m.group(1) ?? '');
        if (n != null && n > 0) {
          return VoiceTableIntent(tableNumber: n, sectionContains: section, guestCount: guests);
        }
      }
    }
    return null;
  }

  static String? _parseSectionOnly(String t) {
    final patterns = <RegExp>[
      RegExp(r'\b(?:show|open|go to)\s+(?:the\s+)?(.+?)\s+section\b', caseSensitive: false),
      RegExp(r'\bsection\s+(.+?)\s*$', caseSensitive: false),
    ];
    for (final re in patterns) {
      final m = re.firstMatch(t);
      if (m != null) {
        final s = m.group(1)?.trim();
        if (s != null && s.length >= 2 && !RegExp(r'^\d+$').hasMatch(s)) return s;
      }
    }
    return null;
  }

  static final _menuVerb = RegExp(
    r"^\s*(?:add|order|punch|ring in|ring|get me|give me|i want|i need|i'd like|we need|put|send|get|sell me|load|enter)\s+(?:up\s+)?(?:a |an |the )?",
    caseSensitive: false,
  );

  static String? _parseMenuItemPhrase(String raw, String t) {
    final m = _menuVerb.firstMatch(t);
    if (m == null) return null;
    var rest = raw.substring(m.end).trim();
    if (rest.isEmpty) return null;
    rest = rest
        .replaceAll(RegExp(r'\b(please|thanks|thank you|now|quickly|for me|to go)\b', caseSensitive: false), ' ')
        .trim();
    if (rest.length < 2) return null;
    // Do not treat obvious navigation as menu (e.g. "order screen" still matches "order" — keep short guard)
    if (RegExp(r'^(screen|page|home|back)$', caseSensitive: false).hasMatch(rest)) return null;
    return rest;
  }

  /// Returns true if a natural intent was executed (navigation scheduled).
  static bool tryHandle(String heard) {
    final raw = heard.trim();
    final t = raw.toLowerCase();
    if (t.isEmpty) return false;

    final nav = AppNavigator.state;
    final ctx = AppNavigator.maybeContext;
    if (nav == null || ctx == null || !ctx.mounted) return false;

    // 1) Open table N [in section …]
    final table = _parseTableIntent(t);
    if (table != null) {
      unawaited(
        nav.push<void>(
          MaterialPageRoute<void>(
            builder: (_) => TablesScreen(
              voiceTableNumber: table.tableNumber,
              voiceSectionHint: table.sectionContains,
              voiceGuestCount: table.guestCount,
            ),
          ),
        ),
      );
      return true;
    }

    // 2) Section focus only (no table number)
    final sectionOnly = _parseSectionOnly(t);
    if (sectionOnly != null && !RegExp(r'\btable\b', caseSensitive: false).hasMatch(t)) {
      unawaited(
        nav.push<void>(
          MaterialPageRoute<void>(
            builder: (_) => TablesScreen(voiceSectionHint: sectionOnly),
          ),
        ),
      );
      return true;
    }

    // 3) Menu: "punch a burger", "order chicken sandwich"
    final menu = _parseMenuItemPhrase(raw, t);
    if (menu != null) {
      unawaited(
        nav.push<void>(
          MaterialPageRoute<void>(
            builder: (_) => OrdersScreen(
              mode: OrdersMode.takeawayDraft,
              voiceMenuSearch: menu,
            ),
          ),
        ),
      );
      return true;
    }

    return false;
  }
}
