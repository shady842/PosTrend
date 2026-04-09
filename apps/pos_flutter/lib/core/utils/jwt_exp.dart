import 'dart:convert';

bool isJwtExpiredOrInvalid(String? jwt, {int leewaySeconds = 30}) {
  if (jwt == null || jwt.isEmpty) return true;
  try {
    final parts = jwt.split('.');
    if (parts.length != 3) return true;
    var payload = parts[1];
    final mod = payload.length % 4;
    if (mod == 1) payload += '===';
    if (mod == 2) payload += '==';
    if (mod == 3) payload += '=';
    final json =
        jsonDecode(utf8.decode(base64Url.decode(payload))) as Map<String, dynamic>;
    final exp = json['exp'];
    if (exp is! num) return false;
    final now = DateTime.now().millisecondsSinceEpoch / 1000;
    return now >= exp.toInt() - leewaySeconds;
  } catch (_) {
    return true;
  }
}
