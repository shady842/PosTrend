import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app.dart';
import 'bootstrap/sqlite_bootstrap.dart';
import 'core/config/api_config.dart';
import 'core/storage/local_storage.dart';
import 'services/voice/voice_settings.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await bootstrapSqlite();
  await VoiceSettings.instance.load();
  final savedApi = await LocalStorage().getApiBaseUrl();
  if (savedApi != null && savedApi.isNotEmpty) {
    ApiConfig.setRuntimeBaseUrl(savedApi);
  }
  final mobile = !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);
  if (mobile) {
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
      DeviceOrientation.portraitUp,
    ]);
  }
  // POS should run fullscreen on Android so system bars do not cover actions.
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }
  runApp(const PosTrendPosApp());
}
