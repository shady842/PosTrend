import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/api_config.dart';
import '../core/storage/local_storage.dart';

class DeliveryOpenResult {
  DeliveryOpenResult({
    required this.orderId,
    required this.orderNumber,
  });

  final String orderId;
  final String orderNumber;
}

class DeliveryService {
  DeliveryService(this._storage);

  final LocalStorage _storage;

  Map<String, String> get _jsonAuthHeaders => {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

  Future<String?> _bearer() async {
    final t = await _storage.getJwt();
    if (t == null || t.isEmpty) return null;
    return t;
  }

  String _messageFromResponse(http.Response res) {
    try {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final m = body['message'];
      if (m is String && m.isNotEmpty) return m;
      if (m is List && m.isNotEmpty) return m.join(', ');
    } catch (_) {}
    return 'Request failed (${res.statusCode})';
  }

  Future<String> createCustomer({
    required String fullName,
    required String phone,
    required String address,
  }) async {
    final token = await _bearer();
    if (token == null) throw Exception('Not authenticated');
    final res = await http
        .post(
          Uri.parse(ApiConfig.customersUrl),
          headers: {
            ..._jsonAuthHeaders,
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'full_name': fullName.trim(),
            'contact_info': {
              'phone': phone.trim(),
              'address': address.trim(),
            }
          }),
        )
        .timeout(const Duration(seconds: 25));
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(_messageFromResponse(res));
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final id = (body['id'] ?? '').toString();
    if (id.isEmpty) throw Exception('Customer creation failed.');
    return id;
  }

  Future<DeliveryOpenResult> openDelivery({
    required String customerId,
    required String contactName,
    required String phone,
    required String address,
    String? instructions,
  }) async {
    final token = await _bearer();
    if (token == null) throw Exception('Not authenticated');
    final res = await http
        .post(
          Uri.parse(ApiConfig.posOrdersDeliveryUrl),
          headers: {
            ..._jsonAuthHeaders,
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'customer_id': customerId,
            'delivery_contact_name': contactName.trim(),
            'delivery_phone': phone.trim(),
            'delivery_address': address.trim(),
            if (instructions != null && instructions.trim().isNotEmpty)
              'delivery_instructions': instructions.trim(),
          }),
        )
        .timeout(const Duration(seconds: 25));
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(_messageFromResponse(res));
    }
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final orderId = (body['id'] ?? '').toString();
    final orderNumber = (body['orderNumber'] ?? '').toString();
    if (orderId.isEmpty) throw Exception('Delivery order creation failed.');
    return DeliveryOpenResult(orderId: orderId, orderNumber: orderNumber);
  }
}
