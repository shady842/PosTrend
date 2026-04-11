import 'package:flutter/material.dart';
import 'core/navigation/app_navigator.dart';
import 'core/theme/app_theme.dart';
import 'presentation/screens/splash_screen.dart';
import 'presentation/widgets/voice_command_overlay.dart';
import 'services/voice/voice_settings.dart';

class PosTrendPosApp extends StatelessWidget {
  const PosTrendPosApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: AppNavigator.key,
      title: 'PosTrend POS',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      home: const SplashScreen(),
      builder: (context, child) {
        return ListenableBuilder(
          listenable: VoiceSettings.instance,
          builder: (context, _) {
            return Stack(
              fit: StackFit.expand,
              children: [
                if (child != null) child,
                const VoiceCommandOverlay(),
              ],
            );
          },
        );
      },
    );
  }
}
