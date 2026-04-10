import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app.dart';
import 'core/config/api_config.dart';
import 'core/storage/local_storage.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final savedApi = await LocalStorage().getApiBaseUrl();
  if (savedApi != null && savedApi.isNotEmpty) {
    ApiConfig.setRuntimeBaseUrl(savedApi);
  }
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
    DeviceOrientation.portraitUp,
  ]);
  // POS should run fullscreen so Android system bars do not cover actions.
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  runApp(const PosTrendPosApp());
}
