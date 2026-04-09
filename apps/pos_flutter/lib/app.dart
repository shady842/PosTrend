import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'presentation/screens/splash_screen.dart';

class PosTrendPosApp extends StatelessWidget {
  const PosTrendPosApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PosTrend POS',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      home: const SplashScreen(),
    );
  }
}
