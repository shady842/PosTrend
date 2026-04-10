import 'dart:convert';

class LineModifier {
  const LineModifier({
    required this.id,
    required this.name,
    required this.priceDeltaCents,
  });

  final String id;
  final String name;
  final int priceDeltaCents;

  Map<String, dynamic> toMap() => {
        'id': id,
        'name': name,
        'price_delta_cents': priceDeltaCents,
      };

  static LineModifier fromMap(Map<String, dynamic> m) {
    return LineModifier(
      id: m['id'] as String,
      name: m['name'] as String,
      priceDeltaCents: (m['price_delta_cents'] as num).toInt(),
    );
  }
}

class CartLine {
  CartLine({
    required this.lineId,
    required this.itemId,
    required this.name,
    required this.unitPriceCents,
    this.qty = 1,
    this.notes = '',
    this.discountCents = 0,
    this.modifiers = const [],
    this.variantId,
    this.variantName,
    this.seatNo,
  });

  final String lineId;
  final String itemId;
  final String name;
  final int unitPriceCents;
  final String? variantId;
  final String? variantName;
  final int? seatNo;
  int qty;
  String notes;
  /// Per-line discount in cents (not percent — computed in UI).
  int discountCents;
  List<LineModifier> modifiers;

  int get unitWithModifiersCents =>
      unitPriceCents +
      modifiers.fold<int>(0, (s, m) => s + m.priceDeltaCents);

  int get lineSubtotalCents => unitWithModifiersCents * qty;

  int get lineTotalCents =>
      (lineSubtotalCents - discountCents).clamp(0, 1 << 30);

  CartLine copyWith({
    String? lineId,
    String? itemId,
    String? name,
    int? unitPriceCents,
    int? qty,
    String? notes,
    int? discountCents,
    List<LineModifier>? modifiers,
    String? variantId,
    String? variantName,
    int? seatNo,
  }) {
    return CartLine(
      lineId: lineId ?? this.lineId,
      itemId: itemId ?? this.itemId,
      name: name ?? this.name,
      unitPriceCents: unitPriceCents ?? this.unitPriceCents,
      qty: qty ?? this.qty,
      notes: notes ?? this.notes,
      discountCents: discountCents ?? this.discountCents,
      modifiers: modifiers ?? List.from(this.modifiers),
      variantId: variantId ?? this.variantId,
      variantName: variantName ?? this.variantName,
      seatNo: seatNo ?? this.seatNo,
    );
  }

  Map<String, dynamic> toMap() => {
        'line_id': lineId,
        'item_id': itemId,
        'name': name,
        'unit_price_cents': unitPriceCents,
        'qty': qty,
        'notes': notes,
        'discount_cents': discountCents,
        'modifiers': modifiers.map((m) => m.toMap()).toList(),
        if (variantId != null) 'variant_id': variantId,
        if (variantName != null) 'variant_name': variantName,
        if (seatNo != null) 'seat_no': seatNo,
      };

  static CartLine fromMap(Map<String, dynamic> m) {
    final mods = (m['modifiers'] as List<dynamic>? ?? [])
        .map((e) => LineModifier.fromMap(Map<String, dynamic>.from(e as Map)))
        .toList();
    return CartLine(
      lineId: m['line_id'] as String,
      itemId: m['item_id'] as String,
      name: m['name'] as String,
      unitPriceCents: (m['unit_price_cents'] as num).toInt(),
      qty: (m['qty'] as num?)?.toInt() ?? 1,
      notes: m['notes'] as String? ?? '',
      discountCents: (m['discount_cents'] as num?)?.toInt() ?? 0,
      modifiers: mods,
      variantId: m['variant_id'] as String?,
      variantName: m['variant_name'] as String?,
      seatNo: (m['seat_no'] as num?)?.toInt(),
    );
  }

  static String encodeCart(List<CartLine> lines) {
    return jsonEncode({'lines': lines.map((l) => l.toMap()).toList()});
  }

  static List<CartLine> decodeCart(String jsonStr) {
    if (jsonStr.isEmpty) return [];
    final o = jsonDecode(jsonStr) as Map<String, dynamic>;
    final raw = o['lines'] as List<dynamic>? ?? [];
    return raw
        .map((e) => CartLine.fromMap(Map<String, dynamic>.from(e as Map)))
        .toList();
  }
}
