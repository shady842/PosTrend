import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/api_config.dart';
import '../core/storage/local_storage.dart';
import '../data/local/app_database.dart';
import '../data/local/sync_outbox_repository.dart';
import 'offline_sync_engine.dart';

class OrderPaymentSnapshot {
  OrderPaymentSnapshot({
    required this.orderId,
    required this.orderTotal,
    required this.paidAmount,
    required this.dueAmount,
    required this.paymentState,
  });

  final String orderId;
  final double orderTotal;
  final double paidAmount;
  final double dueAmount;
  final String paymentState;

  bool get readyToClose =>
      paymentState == 'READY_TO_CLOSE' || dueAmount <= 0.0001;

  static OrderPaymentSnapshot? tryParse(Map<String, dynamic> json) {
    final id = json['order_id'] as String?;
    if (id == null) return null;
    return OrderPaymentSnapshot(
      orderId: id,
      orderTotal: _toDouble(json['order_total']),
      paidAmount: _toDouble(json['paid_amount']),
      dueAmount: _toDouble(json['due_amount']),
      paymentState: json['payment_state'] as String? ?? 'PENDING_PAYMENT',
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }
}

class PaymentService {
  PaymentService(this._storage, this._appDb);

  final LocalStorage _storage;
  final AppDatabase _appDb;

  SyncOutboxRepository get _outbox => SyncOutboxRepository(_appDb);

  Map<String, String> get _jsonAuthHeaders => {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

  Future<String?> _bearer() async {
    final t = await _storage.getJwt();
    if (t == null || t.isEmpty) return null;
    return t;
  }

  Future<int> pendingQueueCount() => _outbox.countPendingPaymentUi();

  Future<void> flushQueue() async {
    await OfflineSyncEngine(_storage, _appDb).runPush();
  }

  Future<OrderPaymentSnapshot?> fetchPaymentState(String orderId) async {
    await flushQueue();
    final token = await _bearer();
    if (token == null) return null;
    try {
      final res = await http
          .get(
            Uri.parse(ApiConfig.posPaymentsOrderUrl(orderId)),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 25));
      if (res.statusCode < 200 || res.statusCode >= 300) return null;
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      return OrderPaymentSnapshot.tryParse(map);
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> fetchOrderForReceipt(String orderId) async {
    final token = await _bearer();
    if (token == null) return null;
    try {
      final res = await http
          .get(
            Uri.parse(ApiConfig.posOrderUrl(orderId)),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 25));
      if (res.statusCode < 200 || res.statusCode >= 300) return null;
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> _enqueueAddPayment({
    required String orderId,
    required String paymentMethod,
    required double amount,
    required String idempotencyKey,
    String? offlineStatus,
  }) async {
    await _outbox.enqueue(
      domain: 'payment',
      opType: 'add',
      idempotencyKey: idempotencyKey,
      payload: {
        'order_id': orderId,
        'payment_method': paymentMethod,
        'amount': amount,
        'idempotency_key': idempotencyKey,
        if (offlineStatus != null) 'offline_status': offlineStatus,
      },
    );
  }

  Future<void> _enqueueSplit(
    String orderId,
    List<Map<String, dynamic>> splits,
  ) async {
    final idem = splits
        .map((s) => s['idempotency_key']?.toString() ?? '')
        .join('|');
    await _outbox.enqueue(
      domain: 'payment',
      opType: 'split',
      idempotencyKey: 'split_${orderId}_$idem',
      payload: {
        'order_id': orderId,
        'splits': splits,
      },
    );
  }

  Future<void> _enqueueClose(String orderId) async {
    await _outbox.enqueue(
      domain: 'order',
      opType: 'close',
      idempotencyKey: 'close_$orderId',
      payload: {'order_id': orderId},
    );
  }

  Future<bool> addPayment({
    required String orderId,
    required String paymentMethod,
    required double amount,
    required String idempotencyKey,
    String? offlineStatus,
  }) async {
    final token = await _bearer();
    if (token == null) {
      await _enqueueAddPayment(
        orderId: orderId,
        paymentMethod: paymentMethod,
        amount: amount,
        idempotencyKey: idempotencyKey,
        offlineStatus: offlineStatus,
      );
      return false;
    }
    try {
      final body = <String, dynamic>{
        'order_id': orderId,
        'payment_method': paymentMethod,
        'amount': amount,
        'idempotency_key': idempotencyKey,
      };
      if (offlineStatus != null) body['offline_status'] = offlineStatus;
      final res = await http
          .post(
            Uri.parse(ApiConfig.posPaymentsAddUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 30));
      if (res.statusCode >= 200 && res.statusCode < 300) return true;
      await _enqueueAddPayment(
        orderId: orderId,
        paymentMethod: paymentMethod,
        amount: amount,
        idempotencyKey: idempotencyKey,
        offlineStatus: offlineStatus,
      );
      return false;
    } catch (_) {
      await _enqueueAddPayment(
        orderId: orderId,
        paymentMethod: paymentMethod,
        amount: amount,
        idempotencyKey: idempotencyKey,
        offlineStatus: offlineStatus,
      );
      return false;
    }
  }

  Future<bool> splitPayment({
    required String orderId,
    required List<Map<String, dynamic>> splits,
  }) async {
    final token = await _bearer();
    if (token == null) {
      await _enqueueSplit(orderId, splits);
      return false;
    }
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.posPaymentsSplitUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'order_id': orderId,
              'splits': splits,
            }),
          )
          .timeout(const Duration(seconds: 35));
      if (res.statusCode >= 200 && res.statusCode < 300) return true;
      await _enqueueSplit(orderId, splits);
      return false;
    } catch (_) {
      await _enqueueSplit(orderId, splits);
      return false;
    }
  }

  Future<bool> closeOrder(String orderId) async {
    final token = await _bearer();
    if (token == null) {
      await _enqueueClose(orderId);
      return false;
    }
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.orderCloseUrl(orderId)),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 25));
      if (res.statusCode >= 200 && res.statusCode < 300) return true;
      await _enqueueClose(orderId);
      return false;
    } catch (_) {
      await _enqueueClose(orderId);
      return false;
    }
  }

  Future<(bool, String?)> applyDiscount({
    required String orderId,
    required String type,
    required double value,
    String scope = 'order',
    String? orderItemId,
    String? managerEmail,
    String? managerPassword,
    String? managerPin,
    String? reason,
  }) async {
    final token = await _bearer();
    if (token == null) return (false, 'You are offline');
    try {
      final body = <String, dynamic>{
        'order_id': orderId,
        'type': type,
        'value': value,
        'scope': scope,
        if (orderItemId != null && orderItemId.trim().isNotEmpty)
          'order_item_id': orderItemId.trim(),
        if (managerEmail != null && managerEmail.trim().isNotEmpty)
          'manager_email': managerEmail.trim(),
        if (managerPassword != null && managerPassword.trim().isNotEmpty)
          'manager_password': managerPassword,
        if (managerPin != null && managerPin.trim().isNotEmpty)
          'manager_pin': managerPin.trim(),
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      };
      final res = await http
          .post(
            Uri.parse(ApiConfig.posOrdersApplyDiscountUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 25));
      if (res.statusCode >= 200 && res.statusCode < 300) return (true, null);
      try {
        final map = jsonDecode(res.body) as Map<String, dynamic>;
        final msg = (map['message'] ?? 'Discount failed').toString();
        return (false, msg);
      } catch (_) {
        return (false, 'Discount failed');
      }
    } catch (_) {
      return (false, 'Discount failed');
    }
  }

  Future<bool> applyPromotion({
    required String orderId,
    required String promotionId,
  }) async {
    final token = await _bearer();
    if (token == null) return false;
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.posOrdersApplyPromotionUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'order_id': orderId,
              'promotion_id': promotionId,
            }),
          )
          .timeout(const Duration(seconds: 25));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  Future<bool> voidOrder(String orderId) async {
    final token = await _bearer();
    if (token == null) return false;
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.posOrdersVoidOrderUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({'order_id': orderId}),
          )
          .timeout(const Duration(seconds: 25));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  String newIdempotencyKey(String prefix) {
    return '${prefix}_${DateTime.now().toUtc().microsecondsSinceEpoch}';
  }
}
