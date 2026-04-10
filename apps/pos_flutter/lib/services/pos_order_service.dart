import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/api_config.dart';
import '../core/storage/local_storage.dart';

class PosOrderItem {
  PosOrderItem({
    required this.id,
    required this.name,
    required this.qty,
    required this.lineTotal,
    required this.status,
    required this.notes,
    required this.seatNo,
  });

  final String id;
  final String name;
  final int qty;
  final int lineTotal;
  final String status;
  final String notes;
  final int? seatNo;
}

class PosOrderSnapshot {
  PosOrderSnapshot({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.subtotal,
    required this.tax,
    required this.service,
    required this.total,
    required this.items,
  });

  final String id;
  final String? orderNumber;
  final String status;
  final int subtotal;
  final int tax;
  final int service;
  final int total;
  final List<PosOrderItem> items;
}

class PosOrderService {
  PosOrderService(this._storage);

  final LocalStorage _storage;

  Map<String, String> get _headers => const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

  Future<String> _jwt() async {
    final t = await _storage.getJwt();
    if (t == null || t.isEmpty) {
      throw Exception('POS session expired. Login again.');
    }
    return t;
  }

  int _moneyToCents(dynamic value) {
    if (value is num) return (value.toDouble() * 100).round();
    return ((double.tryParse('$value') ?? 0) * 100).round();
  }

  int? _toInt(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString());
  }

  PosOrderSnapshot _parseOrder(Map<String, dynamic> map) {
    final rawItems = (map['items'] as List<dynamic>? ?? const []);
    final items = rawItems
        .whereType<Map>()
        .map((x) => Map<String, dynamic>.from(x))
        .map(
          (x) => PosOrderItem(
            id: (x['id'] ?? '').toString(),
            name: (x['nameSnapshot'] ?? 'Item').toString(),
            qty: ((x['qty'] as num?) ?? num.tryParse('${x['qty']}') ?? 1).toInt(),
            lineTotal: _moneyToCents(x['lineTotal']),
            status: (x['status'] ?? '').toString(),
            notes: (x['notes'] ?? '').toString(),
            seatNo: _toInt(x['seatNo'] ?? x['seat_no']),
          ),
        )
        .toList();
    return PosOrderSnapshot(
      id: (map['id'] ?? '').toString(),
      orderNumber: map['orderNumber']?.toString(),
      status: (map['status'] ?? '').toString(),
      subtotal: _moneyToCents(map['subtotal']),
      tax: _moneyToCents(map['tax']),
      service: _moneyToCents(map['service']),
      total: _moneyToCents(map['total']),
      items: items,
    );
  }

  Future<PosOrderSnapshot> getOrder(String orderId) async {
    final jwt = await _jwt();
    final res = await http.get(
      Uri.parse(ApiConfig.posOrderUrl(orderId)),
      headers: {..._headers, 'Authorization': 'Bearer $jwt'},
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Failed to load order');
    }
    return _parseOrder(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<PosOrderSnapshot> addItem({
    required String orderId,
    required String menuItemId,
    required int qty,
    String? variantId,
    String? notes,
    int? seatNo,
  }) async {
    final jwt = await _jwt();
    final res = await http.post(
      Uri.parse(ApiConfig.posOrdersAddItemUrl),
      headers: {..._headers, 'Authorization': 'Bearer $jwt'},
      body: jsonEncode({
        'order_id': orderId,
        'menu_item_id': menuItemId,
        'qty': qty,
        if (variantId != null && variantId.isNotEmpty) 'variant_id': variantId,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (seatNo != null && seatNo > 0) 'seat_no': seatNo,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Could not add item to order');
    }
    return _parseOrder(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<PosOrderSnapshot> addModifier({
    required String orderItemId,
    required String modifierOptionId,
  }) async {
    final jwt = await _jwt();
    final res = await http.post(
      Uri.parse(ApiConfig.posOrdersAddModifierUrl),
      headers: {..._headers, 'Authorization': 'Bearer $jwt'},
      body: jsonEncode({
        'order_item_id': orderItemId,
        'modifier_option_id': modifierOptionId,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Could not add modifier');
    }
    return _parseOrder(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<PosOrderSnapshot> updateQty({
    required String orderItemId,
    required int qty,
  }) async {
    final jwt = await _jwt();
    final res = await http.post(
      Uri.parse(ApiConfig.posOrdersUpdateQtyUrl),
      headers: {..._headers, 'Authorization': 'Bearer $jwt'},
      body: jsonEncode({
        'order_item_id': orderItemId,
        'qty': qty,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Could not update quantity');
    }
    return _parseOrder(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<PosOrderSnapshot> removeItem(String orderItemId) async {
    final jwt = await _jwt();
    final res = await http.post(
      Uri.parse(ApiConfig.posOrdersRemoveItemUrl),
      headers: {..._headers, 'Authorization': 'Bearer $jwt'},
      body: jsonEncode({'order_item_id': orderItemId}),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Could not remove item');
    }
    return _parseOrder(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<Map<String, PosOrderSnapshot>> moveItem({
    required String orderItemId,
    required String targetOrderId,
  }) async {
    final jwt = await _jwt();
    final res = await http.post(
      Uri.parse(ApiConfig.posOrdersMoveItemUrl),
      headers: {..._headers, 'Authorization': 'Bearer $jwt'},
      body: jsonEncode({
        'order_item_id': orderItemId,
        'target_order_id': targetOrderId,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Could not move item');
    }
    final map = jsonDecode(res.body) as Map<String, dynamic>;
    return {
      'source': _parseOrder(Map<String, dynamic>.from(map['source'] as Map)),
      'target': _parseOrder(Map<String, dynamic>.from(map['target'] as Map)),
    };
  }

  Future<PosOrderSnapshot> sendToKitchen(String orderId) async {
    final jwt = await _jwt();
    final res = await http.post(
      Uri.parse(ApiConfig.posOrdersSendKitchenUrl),
      headers: {..._headers, 'Authorization': 'Bearer $jwt'},
      body: jsonEncode({'order_id': orderId}),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Could not send to kitchen');
    }
    return _parseOrder(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> splitOrderItems({
    required String orderId,
    required List<String> orderItemIds,
  }) async {
    final jwt = await _jwt();
    final res = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/v1/pos/orders/split'),
      headers: {..._headers, 'Authorization': 'Bearer $jwt'},
      body: jsonEncode({
        'order_id': orderId,
        'order_item_ids': orderItemIds,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception('Could not split order');
    }
    return Map<String, dynamic>.from(jsonDecode(res.body) as Map);
  }
}
