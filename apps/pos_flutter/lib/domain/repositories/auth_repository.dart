abstract class AuthRepository {
  /// Pairing login: [deviceName] is sent as `device_name` to update the device label on the server.
  /// [deviceSecret] is the registration secret (hex) shown once in admin.
  Future<void> deviceLogin({
    required String deviceCode,
    required String deviceName,
    required String deviceSecret,
    required bool rememberDevice,
  });

  /// Uses stored refresh token; updates access token.
  Future<void> refreshSession();
}
