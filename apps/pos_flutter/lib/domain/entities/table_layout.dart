import 'dart:convert';

/// Floor / section from [GET /v1/pos/orders/layout] (`sections` in JSON).
class FloorSection {
  FloorSection({
    required this.id,
    required this.name,
    required this.tables,
  });

  final String id;
  final String name;
  final List<DiningTableTile> tables;

  static FloorSection fromJson(Map<String, dynamic> m) {
    final tablesRaw = m['tables'] as List<dynamic>? ?? [];
    return FloorSection(
      id: m['id'] as String,
      name: m['name'] as String,
      tables: tablesRaw
          .map((e) => DiningTableTile.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
    );
  }
}

class DiningTableTile {
  DiningTableTile({
    required this.id,
    required this.floorId,
    required this.name,
    required this.seats,
    required this.isActive,
    required this.status,
    this.activeOrderId,
    this.activeOrderNumber,
    this.activeOrderStatus,
    this.openedAt,
    this.guestCount,
  });

  final String id;
  final String floorId;
  final String name;
  final int seats;
  final bool isActive;
  /// API: available | occupied | reserved | inactive
  final String status;
  final String? activeOrderId;
  final String? activeOrderNumber;
  final String? activeOrderStatus;
  final String? openedAt;
  final int? guestCount;

  static DiningTableTile fromJson(Map<String, dynamic> m) {
    return DiningTableTile(
      id: m['id'] as String,
      floorId: m['floorId'] as String,
      name: m['name'] as String,
      seats: (m['seats'] as num?)?.toInt() ?? 2,
      isActive: m['isActive'] == true,
      status: m['status'] as String? ?? 'available',
      activeOrderId: m['active_order_id'] as String?,
      activeOrderNumber: m['active_order_number'] as String?,
      activeOrderStatus: m['active_order_status'] as String?,
      openedAt: m['opened_at'] as String?,
      guestCount: (m['guest_count'] as num?)?.toInt(),
    );
  }
}

class BranchTableLayout {
  BranchTableLayout({
    required this.branchId,
    required this.sections,
  });

  final String branchId;
  final List<FloorSection> sections;

  static BranchTableLayout fromJson(Map<String, dynamic> m) {
    final sec = m['sections'] as List<dynamic>? ?? [];
    return BranchTableLayout(
      branchId: m['branch_id'] as String? ?? '',
      sections: sec
          .map((e) => FloorSection.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
    );
  }

  static BranchTableLayout? tryParse(String body) {
    try {
      return fromJson(jsonDecode(body) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }
}

enum TableVisualStatus {
  available,
  occupied,
  preparing,
  ready,
  billing,
  inactive,
}

TableVisualStatus visualStatusFor(DiningTableTile t) {
  if (!t.isActive || t.status == 'inactive') {
    return TableVisualStatus.inactive;
  }
  if (t.status == 'reserved') {
    return TableVisualStatus.occupied;
  }
  if (t.activeOrderId == null) {
    return TableVisualStatus.available;
  }
  final os = t.activeOrderStatus ?? 'OPEN';
  switch (os) {
    case 'BILLED':
    case 'PAID':
      return TableVisualStatus.billing;
    case 'READY':
    case 'SERVED':
      return TableVisualStatus.ready;
    case 'SENT_TO_KITCHEN':
    case 'PREPARING':
      return TableVisualStatus.preparing;
    default:
      return TableVisualStatus.occupied;
  }
}

String labelForVisual(TableVisualStatus s) {
  switch (s) {
    case TableVisualStatus.available:
      return 'Available';
    case TableVisualStatus.occupied:
      return 'Occupied';
    case TableVisualStatus.preparing:
      return 'Preparing';
    case TableVisualStatus.ready:
      return 'Ready';
    case TableVisualStatus.billing:
      return 'Billing';
    case TableVisualStatus.inactive:
      return 'Inactive';
  }
}
