import 'package:flutter/foundation.dart';

import '../../core/storage/local_storage.dart';

/// In-memory voice prefs so the global overlay updates when Settings changes.
class VoiceSettings extends ChangeNotifier {
  VoiceSettings._();
  static final VoiceSettings instance = VoiceSettings._();

  final _storage = LocalStorage();
  bool enabled = false;
  bool continuous = false;

  Future<void> load() async {
    enabled = await _storage.getVoiceCommandsEnabled();
    continuous = await _storage.getVoiceContinuousEnabled();
    notifyListeners();
  }

  Future<void> setEnabled(bool value) async {
    await _storage.setVoiceCommandsEnabled(value);
    enabled = value;
    notifyListeners();
  }

  Future<void> setContinuous(bool value) async {
    await _storage.setVoiceContinuousEnabled(value);
    continuous = value;
    notifyListeners();
  }
}
