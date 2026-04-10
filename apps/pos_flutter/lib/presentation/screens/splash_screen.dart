import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/storage/local_storage.dart';
import '../../core/utils/jwt_exp.dart';
import '../../data/repositories/auth_repository_impl.dart';
import 'cashier_login_screen.dart';
import 'device_login_screen.dart';
import 'sync_loading_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  String _jwtRole(String token) {
    try {
      final part = token.split('.')[1];
      final normalized = base64Url.normalize(part);
      final payload = jsonDecode(utf8.decode(base64Url.decode(normalized)))
          as Map<String, dynamic>;
      return (payload['role'] ?? '').toString();
    } catch (_) {
      return '';
    }
  }

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
    final savedCode = await storage.getDeviceCode();
    final savedSecret = await storage.getDeviceSecret();
    final savedName = await storage.getDeviceDisplayName();

    if (token != null &&
        token.isNotEmpty &&
        !isJwtExpiredOrInvalid(token)) {
      final role = _jwtRole(token);
      _go(role == 'pos_device'
          ? const CashierLoginScreen()
          : const SyncLoadingScreen());
      return;
    }

    if (remember &&
        refresh != null &&
        refresh.isNotEmpty &&
        (token == null || token.isEmpty || isJwtExpiredOrInvalid(token))) {
      try {
        await AuthRepositoryImpl(storage).refreshSession();
        final refreshed = await storage.getJwt();
        final role = refreshed == null ? '' : _jwtRole(refreshed);
        if (mounted) {
          _go(role == 'pos_device'
              ? const CashierLoginScreen()
              : const SyncLoadingScreen());
        }
        return;
      } catch (_) {
        /* fall through to login */
      }
    }

    if (remember &&
        (savedCode?.isNotEmpty ?? false) &&
        (savedSecret?.isNotEmpty ?? false) &&
        (token == null || token.isEmpty || isJwtExpiredOrInvalid(token))) {
      try {
        await AuthRepositoryImpl(storage).deviceLogin(
          deviceCode: savedCode!,
          deviceName: savedName ?? "",
          deviceSecret: savedSecret!,
          rememberDevice: true,
        );
        if (mounted) _go(const CashierLoginScreen());
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
