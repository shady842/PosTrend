import 'dart:async';

import 'package:speech_to_text/speech_to_text.dart';

/// One-shot speech recognition for POS voice shortcuts (Android).
class PosVoiceService {
  PosVoiceService._();
  static final PosVoiceService instance = PosVoiceService._();

  final SpeechToText _speech = SpeechToText();
  bool _initialized = false;

  Future<bool> ensureInitialized() async {
    if (_initialized) return _speech.isAvailable;
    _initialized = true;
    return _speech.initialize(
      onError: (_) {},
      onStatus: (_) {},
    );
  }

  /// Fully tear down the current listen so a new [listenOnce] can start reliably.
  Future<void> resetSession() async {
    if (!_initialized) return;
    try {
      if (_speech.isListening) {
        await _speech.stop();
      }
    } catch (_) {
      try {
        await _speech.cancel();
      } catch (_) {}
    }
    await Future<void>.delayed(const Duration(milliseconds: 180));
  }

  /// Returns recognized text, or null if unavailable / timeout / empty.
  Future<String?> listenOnce({Duration timeout = const Duration(seconds: 14)}) async {
    final ok = await ensureInitialized();
    if (!ok) return null;

    await resetSession();

    final completer = Completer<String?>();
    Timer? timer;
    String? lastPartial;

    Future<void> finish(String? value) async {
      if (completer.isCompleted) return;
      timer?.cancel();
      timer = null;
      try {
        if (_speech.isListening) {
          await _speech.stop();
        }
      } catch (_) {
        try {
          await _speech.cancel();
        } catch (_) {}
      }
      await Future<void>.delayed(const Duration(milliseconds: 120));
      if (!completer.isCompleted) {
        completer.complete(value);
      }
    }

    timer = Timer(timeout, () {
      final t = lastPartial?.trim();
      unawaited(finish(t != null && t.isNotEmpty ? t : null));
    });

    try {
      await _speech.listen(
        onResult: (result) {
          lastPartial = result.recognizedWords.trim();
          if (result.finalResult && lastPartial != null && lastPartial!.isNotEmpty) {
            unawaited(finish(lastPartial));
          }
        },
        listenOptions: SpeechListenOptions(
          partialResults: true,
          cancelOnError: true,
        ),
      );
    } catch (_) {
      await finish(null);
    }

    return completer.future;
  }

  void cancel() {
    unawaited(resetSession());
  }
}
