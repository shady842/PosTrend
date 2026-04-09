import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/config/api_config.dart';
import '../../core/storage/local_storage.dart';
import '../../domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._storage);

  final LocalStorage _storage;

  Map<String, String> get _jsonHeaders => const {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

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

    final res = await http.post(
      Uri.parse(ApiConfig.deviceLoginUrl),
      headers: _jsonHeaders,
      body: jsonEncode(body),
    );

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

    final res = await http.post(
      Uri.parse(ApiConfig.deviceRefreshUrl),
      headers: _jsonHeaders,
      body: jsonEncode({'refresh_token': refresh}),
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
