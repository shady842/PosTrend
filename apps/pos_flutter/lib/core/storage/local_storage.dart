import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import '../constants/app_constants.dart';

class LocalStorage {
  Future<void> saveJwt(String token) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(AppConstants.jwtKey, token);
  }

  Future<String?> getJwt() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(AppConstants.jwtKey);
  }

  Future<void> saveRefreshToken(String token) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(AppConstants.refreshTokenKey, token);
  }

  Future<String?> getRefreshToken() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(AppConstants.refreshTokenKey);
  }

  Future<void> setRememberDevice(bool value) async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(AppConstants.rememberDeviceKey, value);
  }

  Future<bool> getRememberDevice() async {
    final p = await SharedPreferences.getInstance();
    return p.getBool(AppConstants.rememberDeviceKey) ?? false;
  }

  Future<void> saveBranchScope(String branchId) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(AppConstants.branchIdKey, branchId);
  }

  Future<String?> getBranchScope() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(AppConstants.branchIdKey);
  }

  Future<void> saveDeviceCode(String code) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(AppConstants.deviceCodeKey, code);
  }

  Future<String?> getDeviceCode() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(AppConstants.deviceCodeKey);
  }

  Future<void> saveDeviceDisplayName(String name) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(AppConstants.deviceDisplayNameKey, name);
  }

  Future<String?> getDeviceDisplayName() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(AppConstants.deviceDisplayNameKey);
  }

  Future<void> removeDeviceDisplayName() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(AppConstants.deviceDisplayNameKey);
  }

  Future<void> saveDeviceSecret(String secret) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(AppConstants.deviceSecretKey, secret);
  }

  Future<String?> getDeviceSecret() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(AppConstants.deviceSecretKey);
  }

  Future<void> removeDeviceSecret() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(AppConstants.deviceSecretKey);
  }

  Future<void> saveTenantJson(Map<String, dynamic> tenant) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(AppConstants.tenantJsonKey, jsonEncode(tenant));
  }

  Future<void> saveBranchJson(Map<String, dynamic> branch) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(AppConstants.branchJsonKey, jsonEncode(branch));
  }

  Future<Map<String, dynamic>?> getTenantJson() async {
    final p = await SharedPreferences.getInstance();
    final s = p.getString(AppConstants.tenantJsonKey);
    if (s == null || s.isEmpty) return null;
    return jsonDecode(s) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>?> getBranchJson() async {
    final p = await SharedPreferences.getInstance();
    final s = p.getString(AppConstants.branchJsonKey);
    if (s == null || s.isEmpty) return null;
    return jsonDecode(s) as Map<String, dynamic>;
  }

  Future<void> savePrinterConfigJson(String jsonText) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(AppConstants.printerConfigJsonKey, jsonText);
  }

  Future<String?> getPrinterConfigJson() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(AppConstants.printerConfigJsonKey);
  }

  Future<void> saveLastPrintJobJson(String jsonText) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(AppConstants.lastPrintJobJsonKey, jsonText);
  }

  Future<String?> getLastPrintJobJson() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(AppConstants.lastPrintJobJsonKey);
  }

  Future<void> clearPrefillOnly() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(AppConstants.deviceCodeKey);
    await p.remove(AppConstants.deviceDisplayNameKey);
    await p.remove(AppConstants.deviceSecretKey);
  }

  /// API origin without path, e.g. `http://192.168.1.10:3000` (no `/v1`).
  Future<void> saveApiBaseUrl(String url) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(AppConstants.apiBaseUrlKey, url.trim());
  }

  Future<String?> getApiBaseUrl() async {
    final p = await SharedPreferences.getInstance();
    return p.getString(AppConstants.apiBaseUrlKey);
  }

  Future<void> clearApiBaseUrl() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(AppConstants.apiBaseUrlKey);
  }

  Future<void> clearSession() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(AppConstants.jwtKey);
    await p.remove(AppConstants.branchIdKey);
    await p.remove(AppConstants.refreshTokenKey);
    await p.remove(AppConstants.tenantJsonKey);
    await p.remove(AppConstants.branchJsonKey);
    await p.remove(AppConstants.rememberDeviceKey);
    await p.remove(AppConstants.deviceCodeKey);
    await p.remove(AppConstants.deviceDisplayNameKey);
    await p.remove(AppConstants.deviceSecretKey);
    await p.remove(AppConstants.printerConfigJsonKey);
    await p.remove(AppConstants.lastPrintJobJsonKey);
  }
}
