import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../../core/config/api_config.dart';
import '../../core/storage/local_storage.dart';
import '../../domain/repositories/auth_repository.dart';

const Duration _kAuthHttpTimeout = Duration(seconds: 30);

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._storage);

  final LocalStorage _storage;

  Map<String, String> get _jsonHeaders => const {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

  Future<http.Response> _postJson(Uri uri, Object body) async {
    try {
      return await http
          .post(uri, headers: _jsonHeaders, body: jsonEncode(body))
          .timeout(
            _kAuthHttpTimeout,
            onTimeout: () {
              throw TimeoutException(
                'No response from server within ${_kAuthHttpTimeout.inSeconds}s.\n'
                'API: ${ApiConfig.baseUrl}\n'
                'On a real phone, use your PC\'s LAN IP (e.g. http://192.168.1.10:3000), '
                'not 10.0.2.2 — rebuild the app with --dart-define=API_BASE_URL=...',
              );
            },
          );
    } on SocketException catch (e) {
      throw Exception(
        'Cannot reach API at ${ApiConfig.baseUrl}\n'
        '${e.message.isNotEmpty ? e.message : (e.osError?.message ?? "network error")}\n'
        'Same Wi‑Fi as your server? Firewall allows port 3000?',
      );
    }
  }

  String _readError(http.Response res) {
    try {
      final decoded = jsonDecode(res.body);
      if (decoded is Map && decoded['message'] != null) {
        final m = decoded['message'];
        return m is List ? m.join(', ') : m.toString();
      }
    } catch (_) {}
    return 'Request failed (${res.statusCode})';
  }

  @override
  Future<void> deviceLogin({
    required String deviceCode,
    required String deviceName,
    required String deviceSecret,
    required bool rememberDevice,
  }) async {
    final trimmedCode = deviceCode.trim();
    final trimmedSecret = deviceSecret.trim();
    if (trimmedCode.isEmpty || trimmedSecret.isEmpty) {
      throw StateError('Device code and pairing secret are required.');
    }

    final body = <String, dynamic>{
      'device_code': trimmedCode,
      'device_secret': trimmedSecret,
      if (deviceName.trim().isNotEmpty) 'device_name': deviceName.trim(),
    };

    final res = await _postJson(Uri.parse(ApiConfig.deviceLoginUrl), body);

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(_readError(res));
    }

    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final token =
        (data['token'] ?? data['access_token'])?.toString() ?? '';
    final refresh = data['refresh_token']?.toString() ?? '';
    if (token.isEmpty) {
      throw Exception('Invalid response: missing token.');
    }

    final tenant = data['tenant'];
    final branch = data['branch'];
    if (tenant is! Map<String, dynamic> || branch is! Map<String, dynamic>) {
      throw Exception('Invalid response: missing tenant or branch.');
    }

    await _storage.saveJwt(token);
    await _storage.saveDeviceAuthToken(token);
    if (refresh.isNotEmpty) {
      await _storage.saveRefreshToken(refresh);
    }
    await _storage.saveBranchScope(branch['id']?.toString() ?? '');
    await _storage.saveTenantJson(
      Map<String, dynamic>.from(
        tenant.map((k, v) => MapEntry(k.toString(), v)),
      ),
    );
    await _storage.saveBranchJson(
      Map<String, dynamic>.from(
        branch.map((k, v) => MapEntry(k.toString(), v)),
      ),
    );

    await _storage.setRememberDevice(rememberDevice);
    if (rememberDevice) {
      await _storage.saveDeviceCode(trimmedCode);
      await _storage.saveDeviceSecret(trimmedSecret);
      if (deviceName.trim().isNotEmpty) {
        await _storage.saveDeviceDisplayName(deviceName.trim());
      } else {
        await _storage.removeDeviceDisplayName();
      }
    } else {
      await _storage.clearPrefillOnly();
    }
  }

  @override
  Future<void> refreshSession() async {
    final refresh = await _storage.getRefreshToken();
    if (refresh == null || refresh.isEmpty) {
      throw StateError('No refresh token stored.');
    }

    final res = await _postJson(
      Uri.parse(ApiConfig.deviceRefreshUrl),
      {'refresh_token': refresh},
    );

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(_readError(res));
    }

    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final token = data['access_token']?.toString() ?? '';
    if (token.isEmpty) {
      throw Exception('Invalid response: missing access_token.');
    }
    await _storage.saveJwt(token);
  }
}
