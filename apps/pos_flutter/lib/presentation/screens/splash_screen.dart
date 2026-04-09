import 'package:flutter/material.dart';

import '../../core/storage/local_storage.dart';
import '../../core/utils/jwt_exp.dart';
import '../../data/repositories/auth_repository_impl.dart';
import 'device_login_screen.dart';
import 'sync_loading_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;

    final storage = LocalStorage();
    final token = await storage.getJwt();
    final remember = await storage.getRememberDevice();
    final refresh = await storage.getRefreshToken();

    if (token != null &&
        token.isNotEmpty &&
        !isJwtExpiredOrInvalid(token)) {
      _go(const SyncLoadingScreen());
      return;
    }

    if (remember &&
        refresh != null &&
        refresh.isNotEmpty &&
        (token == null || token.isEmpty || isJwtExpiredOrInvalid(token))) {
      try {
        await AuthRepositoryImpl(storage).refreshSession();
        if (mounted) _go(const SyncLoadingScreen());
        return;
      } catch (_) {
        /* fall through to login */
      }
    }

    if (mounted) _go(const DeviceLoginScreen());
  }

  void _go(Widget page) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => page),
    );
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text(
          'PosTrend POS',
          style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800),
        ),
      ),
    );
  }
}
