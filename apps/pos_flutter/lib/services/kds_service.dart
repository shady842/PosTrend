import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/api_config.dart';
import '../core/storage/local_storage.dart';

class KdsTicket {
  KdsTicket({
    required this.id,
    required this.orderId,
    required this.stationName,
    required this.status,
    required this.createdAt,
    required this.items,
  });

  final String id;
  final String orderId;
  final String stationName;
  final String status; // pending | preparing | ready
  final DateTime createdAt;
  final List<KdsItemLine> items;

  static KdsTicket? tryParse(Map<String, dynamic> json) {
    final id = json['id']?.toString();
    final orderId = json['orderId']?.toString() ?? json['order_id']?.toString();
    if (id == null || orderId == null) return null;
    final station = json['station'];
    final stationName = station is Map
        ? (station['name']?.toString() ?? 'Station')
        : 'Station';
    final status = (json['status']?.toString() ?? 'pending').toLowerCase();
    final createdAt =
        DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
            DateTime.now();

    final order = json['order'];
    final orderItems = order is Map ? order['items'] : null;
    final items = <KdsItemLine>[];
    if (orderItems is List) {
      for (final raw in orderItems) {
        if (raw is! Map) continue;
        final m = Map<String, dynamic>.from(raw);
        final name = (m['nameSnapshot']?.toString() ??
                m['name']?.toString() ??
                'Item')
            .trim();
        final qty = (m['qty'] is num)
            ? (m['qty'] as num).toDouble()
            : double.tryParse(m['qty']?.toString() ?? '') ?? 1;
        final seatNo = _seatNoFromAny(
          m['seatNo'],
          m['seat_no'],
          m['notes']?.toString(),
        );
        items.add(KdsItemLine(name: name, qty: qty, seatNo: seatNo));
      }
    }

    return KdsTicket(
      id: id,
      orderId: orderId,
      stationName: stationName,
      status: status,
      createdAt: createdAt,
      items: items,
    );
  }

  static int? _seatNoFromAny(dynamic seatNo, dynamic seatNoSnake, String? notes) {
    final direct = (seatNo is num)
        ? seatNo.toInt()
        : int.tryParse(seatNo?.toString() ?? '');
    if (direct != null && direct > 0) return direct;
    final snake = (seatNoSnake is num)
        ? seatNoSnake.toInt()
        : int.tryParse(seatNoSnake?.toString() ?? '');
    if (snake != null && snake > 0) return snake;
    if (notes == null || notes.isEmpty) return null;
    final m = RegExp(r'seat\s*[:#-]?\s*(\d+)', caseSensitive: false).firstMatch(notes);
    final parsed = int.tryParse(m?.group(1) ?? '');
    return (parsed != null && parsed > 0) ? parsed : null;
  }
}

class KdsItemLine {
  KdsItemLine({required this.name, required this.qty, this.seatNo});
  final String name;
  final double qty;
  final int? seatNo;
}

class KdsService {
  KdsService(this._storage);

  final LocalStorage _storage;

  Map<String, String> get _jsonAuthHeaders => const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

  Future<String?> _bearer() async {
    final t = await _storage.getJwt();
    if (t == null || t.isEmpty) return null;
    return t;
  }

  Future<List<KdsTicket>> fetchActiveTickets() async {
    final token = await _bearer();
    if (token == null) return [];
    try {
      final res = await http
          .get(
            Uri.parse(ApiConfig.kdsTicketsActiveUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 25));
      if (res.statusCode < 200 || res.statusCode >= 300) return [];
      final data = jsonDecode(res.body);
      if (data is! List) return [];
      final out = <KdsTicket>[];
      for (final x in data) {
        if (x is! Map) continue;
        final t = KdsTicket.tryParse(Map<String, dynamic>.from(x));
        if (t != null) out.add(t);
      }
      return out;
    } catch (_) {
      return [];
    }
  }

  Future<bool> updateTicketStatus({
    required String ticketId,
    required String status, // preparing | ready
  }) async {
    final token = await _bearer();
    if (token == null) return false;
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.kdsTicketUpdateUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'ticket_id': ticketId,
              'status': status,
            }),
          )
          .timeout(const Duration(seconds: 25));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }
}

