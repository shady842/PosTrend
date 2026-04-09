import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/api_config.dart';
import '../core/storage/local_storage.dart';

class ShiftCurrentState {
  ShiftCurrentState({
    required this.shiftId,
    required this.shiftName,
    required this.cashDrawerId,
    required this.openedBy,
    required this.startingAmount,
    required this.expectedAmount,
    required this.openedAt,
  });

  final String shiftId;
  final String shiftName;
  final String cashDrawerId;
  final String openedBy;
  final double startingAmount;
  final double expectedAmount;
  final DateTime? openedAt;

  static ShiftCurrentState? tryParse(Map<String, dynamic> json) {
    final shiftId = json['shift_id']?.toString();
    if (shiftId == null || shiftId.isEmpty) return null;
    return ShiftCurrentState(
      shiftId: shiftId,
      shiftName: json['shift_name']?.toString() ?? 'Shift',
      cashDrawerId: json['cash_drawer_id']?.toString() ?? '',
      openedBy: json['opened_by']?.toString() ?? '',
      startingAmount: _toDouble(json['starting_amount']),
      expectedAmount: _toDouble(json['expected_amount']),
      openedAt: DateTime.tryParse(json['opened_at']?.toString() ?? ''),
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
    }
}

class ShiftService {
  ShiftService(this._storage);

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

  static double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  Future<ShiftCurrentState?> currentShift() async {
    final token = await _bearer();
    if (token == null) return null;
    try {
      final res = await http
          .get(
            Uri.parse(ApiConfig.shiftsCurrentUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 20));
      if (res.statusCode < 200 || res.statusCode >= 300) return null;
      if (res.body.trim() == 'null') return null;
      final map = jsonDecode(res.body);
      if (map is! Map) return null;
      return ShiftCurrentState.tryParse(Map<String, dynamic>.from(map));
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> openShift({
    required String name,
    required String openedBy,
    required double startingAmount,
  }) async {
    final token = await _bearer();
    if (token == null) return null;
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.shiftsOpenUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'name': name,
              'opened_by': openedBy,
              'starting_amount': startingAmount,
            }),
          )
          .timeout(const Duration(seconds: 25));
      if (res.statusCode < 200 || res.statusCode >= 300) return null;
      final data = jsonDecode(res.body);
      return data is Map<String, dynamic>
          ? data
          : Map<String, dynamic>.from(data as Map);
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> closeShift({
    required String shiftId,
    required String closedBy,
    required double endingAmount,
  }) async {
    final token = await _bearer();
    if (token == null) return null;
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.shiftsCloseUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'shift_id': shiftId,
              'closed_by': closedBy,
              'ending_amount': endingAmount,
            }),
          )
          .timeout(const Duration(seconds: 25));
      if (res.statusCode < 200 || res.statusCode >= 300) return null;
      final data = jsonDecode(res.body);
      return data is Map<String, dynamic>
          ? data
          : Map<String, dynamic>.from(data as Map);
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> dayCloseSummary() async {
    final token = await _bearer();
    if (token == null) return null;
    try {
      final res = await http
          .get(
            Uri.parse(ApiConfig.dayCloseSummaryUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 25));
      if (res.statusCode < 200 || res.statusCode >= 300) return null;
      final data = jsonDecode(res.body);
      return data is Map<String, dynamic>
          ? data
          : Map<String, dynamic>.from(data as Map);
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> runDayClose({
    required String closedBy,
  }) async {
    final token = await _bearer();
    if (token == null) return null;
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.dayCloseUrl),
            headers: {
              ..._jsonAuthHeaders,
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({'closed_by': closedBy}),
          )
          .timeout(const Duration(seconds: 30));
      if (res.statusCode < 200 || res.statusCode >= 300) return null;
      final data = jsonDecode(res.body);
      return data is Map<String, dynamic>
          ? data
          : Map<String, dynamic>.from(data as Map);
    } catch (_) {
      return null;
    }
  }

  static String money(dynamic v) => '\$${_toDouble(v).toStringAsFixed(2)}';
}
