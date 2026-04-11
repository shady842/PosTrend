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

  /// Returns recognized text, or null if unavailable / timeout / empty.
  Future<String?> listenOnce({Duration timeout = const Duration(seconds: 14)}) async {
    final ok = await ensureInitialized();
    if (!ok) return null;

    final completer = Completer<String?>();
    Timer? timer;

    void complete(String? value) {
      if (completer.isCompleted) return;
      timer?.cancel();
      unawaited(_speech.stop());
      completer.complete(value);
    }

    String? lastPartial;
    timer = Timer(timeout, () {
      final t = lastPartial?.trim();
      complete(t != null && t.isNotEmpty ? t : null);
    });

    await _speech.listen(
      onResult: (result) {
        lastPartial = result.recognizedWords.trim();
        if (result.finalResult && lastPartial != null && lastPartial!.isNotEmpty) {
          complete(lastPartial);
        }
      },
      listenOptions: SpeechListenOptions(
        partialResults: true,
        cancelOnError: true,
      ),
    );

    return completer.future;
  }

  void cancel() {
    unawaited(_speech.stop());
  }
}
