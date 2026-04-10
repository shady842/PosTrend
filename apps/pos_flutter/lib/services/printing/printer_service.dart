import 'dart:convert';
import 'dart:io';

import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';

import '../../core/storage/local_storage.dart';
import '../../domain/entities/cart_line.dart';
import '../kds_service.dart';

enum PrinterConnectionType { lan, bluetooth }

class PrinterConfig {
  const PrinterConfig({
    required this.enabled,
    required this.connectionType,
    required this.printerAddress,
    required this.printerPort,
    required this.paperSizeMm,
    required this.autoPrintOrderReceipt,
    required this.autoPrintKitchenTicket,
    required this.autoPrintPaymentReceipt,
    required this.logoText,
    required this.taxLabel,
    required this.qrData,
  });

  final bool enabled;
  final PrinterConnectionType connectionType;
  final String printerAddress;
  final int printerPort;
  final int paperSizeMm;
  final bool autoPrintOrderReceipt;
  final bool autoPrintKitchenTicket;
  final bool autoPrintPaymentReceipt;
  final String logoText;
  final String taxLabel;
  final String qrData;

  factory PrinterConfig.defaults() {
    return const PrinterConfig(
      enabled: false,
      connectionType: PrinterConnectionType.lan,
      printerAddress: '',
      printerPort: 9100,
      paperSizeMm: 80,
      autoPrintOrderReceipt: false,
      autoPrintKitchenTicket: false,
      autoPrintPaymentReceipt: false,
      logoText: 'PosTrend',
      taxLabel: 'Tax',
      qrData: '',
    );
  }

  Map<String, dynamic> toMap() => {
        'enabled': enabled,
        'connection_type': connectionType.name,
        'printer_address': printerAddress,
        'printer_port': printerPort,
        'paper_size_mm': paperSizeMm,
        'auto_order': autoPrintOrderReceipt,
        'auto_kitchen': autoPrintKitchenTicket,
        'auto_payment': autoPrintPaymentReceipt,
        'logo_text': logoText,
        'tax_label': taxLabel,
        'qr_data': qrData,
      };

  factory PrinterConfig.fromMap(Map<String, dynamic> m) {
    final typeRaw = (m['connection_type']?.toString() ?? 'lan').toLowerCase();
    return PrinterConfig(
      enabled: m['enabled'] == true,
      connectionType: typeRaw == 'bluetooth'
          ? PrinterConnectionType.bluetooth
          : PrinterConnectionType.lan,
      printerAddress: m['printer_address']?.toString() ?? '',
      printerPort: (m['printer_port'] is num)
          ? (m['printer_port'] as num).toInt()
          : int.tryParse(m['printer_port']?.toString() ?? '') ?? 9100,
      paperSizeMm: (m['paper_size_mm'] is num)
          ? (m['paper_size_mm'] as num).toInt()
          : 80,
      autoPrintOrderReceipt: m['auto_order'] == true,
      autoPrintKitchenTicket: m['auto_kitchen'] == true,
      autoPrintPaymentReceipt: m['auto_payment'] == true,
      logoText: m['logo_text']?.toString() ?? 'PosTrend',
      taxLabel: m['tax_label']?.toString() ?? 'Tax',
      qrData: m['qr_data']?.toString() ?? '',
    );
  }
}

class PrinterService {
  PrinterService(this._storage);

  final LocalStorage _storage;

  Future<PrinterConfig> loadConfig() async {
    final raw = await _storage.getPrinterConfigJson();
    if (raw == null || raw.isEmpty) return PrinterConfig.defaults();
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      return PrinterConfig.fromMap(m);
    } catch (_) {
      return PrinterConfig.defaults();
    }
  }

  Future<void> saveConfig(PrinterConfig config) async {
    await _storage.savePrinterConfigJson(jsonEncode(config.toMap()));
  }

  Future<void> _saveLastJob(Map<String, dynamic> payload) async {
    await _storage.saveLastPrintJobJson(jsonEncode(payload));
  }

  Future<Map<String, dynamic>?> _loadLastJob() async {
    final raw = await _storage.getLastPrintJobJson();
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<List<int>> _header(Generator gen, PrinterConfig cfg, {required String title}) async {
    var bytes = <int>[];
    if (cfg.logoText.trim().isNotEmpty) {
      bytes += gen.text(
        cfg.logoText.trim(),
        styles: const PosStyles(
          align: PosAlign.center,
          bold: true,
          height: PosTextSize.size2,
          width: PosTextSize.size2,
        ),
      );
    }
    bytes += gen.text(title, styles: const PosStyles(align: PosAlign.center, bold: true));
    bytes += gen.hr();
    return bytes;
  }

  static String _money(num v) => '\$${v.toStringAsFixed(2)}';

  static String _qty(double q) {
    final i = q.round();
    if ((q - i).abs() < 0.0001) return '$i';
    return q.toStringAsFixed(2);
  }

  static int? _seatFromNotes(String notes) {
    final m = RegExp(r'seat\s*[:#-]?\s*(\d+)', caseSensitive: false).firstMatch(notes);
    if (m == null) return null;
    return int.tryParse(m.group(1) ?? '');
  }

  static int? _toInt(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString());
  }

  static double _toDouble(dynamic v, {double fallback = 0}) {
    if (v == null) return fallback;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? fallback;
  }

  Future<List<int>> _buildOrderReceiptBytes({
    required PrinterConfig cfg,
    required String orderId,
    required List<CartLine> lines,
    required int subtotalCents,
    required int discountCents,
    required int totalCents,
  }) async {
    final profile = await CapabilityProfile.load();
    final paper = cfg.paperSizeMm == 58 ? PaperSize.mm58 : PaperSize.mm80;
    final gen = Generator(paper, profile);

    var bytes = <int>[];
    bytes += await _header(gen, cfg, title: 'ORDER RECEIPT');
    bytes += gen.text('Order: $orderId', styles: const PosStyles(bold: true));
    bytes += gen.text('Time: ${DateTime.now().toLocal()}');
    bytes += gen.feed(1);

    final groupedBySeat = <int, List<CartLine>>{};
    for (final l in lines) {
      final seat = l.seatNo ?? _seatFromNotes(l.notes) ?? 0;
      groupedBySeat.putIfAbsent(seat, () => <CartLine>[]).add(l);
    }
    final seatKeys = groupedBySeat.keys.toList()..sort();
    for (final seat in seatKeys) {
      final title = seat <= 0 ? 'Seat: Unassigned' : 'Seat: $seat';
      bytes += gen.text(title, styles: const PosStyles(bold: true));
      final seatLines = groupedBySeat[seat] ?? const <CartLine>[];
      for (final l in seatLines) {
        bytes += gen.row([
          PosColumn(text: _qty(l.qty.toDouble()), width: 2),
          PosColumn(text: l.name, width: 7),
          PosColumn(
            text: _money(l.lineTotalCents / 100),
            width: 3,
            styles: const PosStyles(align: PosAlign.right),
          ),
        ]);
      }
      bytes += gen.hr(ch: '-');
    }
    bytes += gen.hr();
    bytes += gen.row([
      PosColumn(text: 'Subtotal', width: 8),
      PosColumn(text: _money(subtotalCents / 100), width: 4, styles: const PosStyles(align: PosAlign.right)),
    ]);
    bytes += gen.row([
      PosColumn(text: 'Discount', width: 8),
      PosColumn(text: _money(discountCents / 100), width: 4, styles: const PosStyles(align: PosAlign.right)),
    ]);
    bytes += gen.row([
      PosColumn(text: 'TOTAL', width: 8, styles: const PosStyles(bold: true)),
      PosColumn(text: _money(totalCents / 100), width: 4, styles: const PosStyles(align: PosAlign.right, bold: true)),
    ]);
    if (cfg.qrData.trim().isNotEmpty) {
      bytes += gen.feed(1);
      bytes += gen.qrcode(cfg.qrData.trim(), align: PosAlign.center);
    }
    bytes += gen.feed(2);
    bytes += gen.cut();
    return bytes;
  }

  Future<List<int>> _buildKitchenTicketBytes({
    required PrinterConfig cfg,
    required String ticketId,
    required String orderId,
    required String stationName,
    required List<KdsItemLine> items,
  }) async {
    final profile = await CapabilityProfile.load();
    final paper = cfg.paperSizeMm == 58 ? PaperSize.mm58 : PaperSize.mm80;
    final gen = Generator(paper, profile);

    var bytes = <int>[];
    bytes += await _header(gen, cfg, title: 'KITCHEN TICKET');
    bytes += gen.text('Ticket: $ticketId', styles: const PosStyles(bold: true));
    bytes += gen.text('Order: $orderId');
    bytes += gen.text('Station: $stationName');
    bytes += gen.hr();
    final groupedBySeat = <int, List<KdsItemLine>>{};
    for (final it in items) {
      final seat = it.seatNo ?? 0;
      groupedBySeat.putIfAbsent(seat, () => <KdsItemLine>[]).add(it);
    }
    final seatKeys = groupedBySeat.keys.toList()..sort();
    for (final seat in seatKeys) {
      final title = seat <= 0 ? 'Seat: Unassigned' : 'Seat: $seat';
      bytes += gen.text(title, styles: const PosStyles(bold: true));
      final seatItems = groupedBySeat[seat] ?? const <KdsItemLine>[];
      for (final it in seatItems) {
        bytes += gen.row([
          PosColumn(text: 'x${_qty(it.qty)}', width: 3, styles: const PosStyles(bold: true)),
          PosColumn(text: it.name, width: 9, styles: const PosStyles(bold: true)),
        ]);
      }
      bytes += gen.hr(ch: '-');
    }
    bytes += gen.feed(2);
    bytes += gen.cut();
    return bytes;
  }

  Future<List<int>> _buildPaymentReceiptBytes({
    required PrinterConfig cfg,
    required String orderId,
    required String paymentMethod,
    required double paidAmount,
    required double dueAmountAfter,
    required double changeAmount,
    required double tipAmount,
    double? totalAmount,
    double? taxAmount,
  }) async {
    final profile = await CapabilityProfile.load();
    final paper = cfg.paperSizeMm == 58 ? PaperSize.mm58 : PaperSize.mm80;
    final gen = Generator(paper, profile);

    var bytes = <int>[];
    bytes += await _header(gen, cfg, title: 'PAYMENT RECEIPT');
    bytes += gen.text('Order: $orderId', styles: const PosStyles(bold: true));
    bytes += gen.text('Method: ${paymentMethod.toUpperCase()}');
    bytes += gen.hr();
    if (totalAmount != null) {
      bytes += gen.row([PosColumn(text: 'Total', width: 8), PosColumn(text: _money(totalAmount), width: 4, styles: const PosStyles(align: PosAlign.right))]);
    }
    if (taxAmount != null) {
      bytes += gen.row([PosColumn(text: cfg.taxLabel, width: 8), PosColumn(text: _money(taxAmount), width: 4, styles: const PosStyles(align: PosAlign.right))]);
    }
    bytes += gen.row([PosColumn(text: 'Paid now', width: 8), PosColumn(text: _money(paidAmount), width: 4, styles: const PosStyles(align: PosAlign.right))]);
    bytes += gen.row([PosColumn(text: 'Due after', width: 8), PosColumn(text: _money(dueAmountAfter), width: 4, styles: const PosStyles(align: PosAlign.right))]);
    if (changeAmount > 0.0001) {
      bytes += gen.row([PosColumn(text: 'Change', width: 8), PosColumn(text: _money(changeAmount), width: 4, styles: const PosStyles(align: PosAlign.right))]);
    }
    if (tipAmount > 0.0001) {
      bytes += gen.row([PosColumn(text: 'Tip', width: 8), PosColumn(text: _money(tipAmount), width: 4, styles: const PosStyles(align: PosAlign.right))]);
    }
    bytes += gen.hr();
    if (cfg.qrData.trim().isNotEmpty) {
      bytes += gen.qrcode(cfg.qrData.trim(), align: PosAlign.center);
    }
    bytes += gen.feed(2);
    bytes += gen.cut();
    return bytes;
  }

  Future<bool> printTextReport({required String title, required String body}) async {
    final cfg = await loadConfig();
    final profile = await CapabilityProfile.load();
    final paper = cfg.paperSizeMm == 58 ? PaperSize.mm58 : PaperSize.mm80;
    final gen = Generator(paper, profile);
    var bytes = <int>[];
    bytes += await _header(gen, cfg, title: title);
    for (final raw in body.split('\n')) {
      final line = raw.trimRight();
      bytes += gen.text(line.isEmpty ? ' ' : line);
    }
    bytes += gen.feed(2);
    bytes += gen.cut();
    return _sendBytes(cfg, bytes);
  }

  Future<bool> _sendBytes(PrinterConfig cfg, List<int> bytes) async {
    if (!cfg.enabled || cfg.printerAddress.trim().isEmpty) return false;

    if (cfg.connectionType == PrinterConnectionType.lan) {
      Socket? socket;
      try {
        socket = await Socket.connect(cfg.printerAddress.trim(), cfg.printerPort, timeout: const Duration(seconds: 4));
        socket.add(bytes);
        await socket.flush();
        await socket.close();
        return true;
      } catch (_) {
        try { await socket?.close(); } catch (_) {}
        return false;
      }
    }

    // Temporary build fallback on Windows CLI environment:
    // Bluetooth thermal printing is disabled to avoid native NDK dependency
    // issues during APK generation. LAN printing remains available.
    return false;
  }

  Future<bool> printOrderReceipt({
    required String orderId,
    required List<CartLine> lines,
    required int subtotalCents,
    required int discountCents,
    required int totalCents,
  }) async {
    final cfg = await loadConfig();
    final bytes = await _buildOrderReceiptBytes(
      cfg: cfg,
      orderId: orderId,
      lines: lines,
      subtotalCents: subtotalCents,
      discountCents: discountCents,
      totalCents: totalCents,
    );
    final ok = await _sendBytes(cfg, bytes);
    if (ok) {
      await _saveLastJob({
        'type': 'order',
        'order_id': orderId,
        'lines': lines.map((e) => e.toMap()).toList(),
        'subtotal_cents': subtotalCents,
        'discount_cents': discountCents,
        'total_cents': totalCents,
      });
    }
    return ok;
  }

  Future<bool> printKitchenTicket({
    required String ticketId,
    required String orderId,
    required String stationName,
    required List<KdsItemLine> items,
  }) async {
    final cfg = await loadConfig();
    final bytes = await _buildKitchenTicketBytes(
      cfg: cfg,
      ticketId: ticketId,
      orderId: orderId,
      stationName: stationName,
      items: items,
    );
    final ok = await _sendBytes(cfg, bytes);
    if (ok) {
      await _saveLastJob({
        'type': 'kitchen',
        'ticket_id': ticketId,
        'order_id': orderId,
        'station_name': stationName,
        'items': items.map((e) => {'name': e.name, 'qty': e.qty, 'seat_no': e.seatNo}).toList(),
      });
    }
    return ok;
  }

  Future<bool> printPaymentReceipt({
    required String orderId,
    required String paymentMethod,
    required double paidAmount,
    required double dueAmountAfter,
    required double changeAmount,
    required double tipAmount,
    double? totalAmount,
    double? taxAmount,
  }) async {
    final cfg = await loadConfig();
    final bytes = await _buildPaymentReceiptBytes(
      cfg: cfg,
      orderId: orderId,
      paymentMethod: paymentMethod,
      paidAmount: paidAmount,
      dueAmountAfter: dueAmountAfter,
      changeAmount: changeAmount,
      tipAmount: tipAmount,
      totalAmount: totalAmount,
      taxAmount: taxAmount,
    );
    final ok = await _sendBytes(cfg, bytes);
    if (ok) {
      await _saveLastJob({
        'type': 'payment',
        'order_id': orderId,
        'payment_method': paymentMethod,
        'paid_amount': paidAmount,
        'due_after': dueAmountAfter,
        'change_amount': changeAmount,
        'tip_amount': tipAmount,
        'total_amount': totalAmount,
        'tax_amount': taxAmount,
      });
    }
    return ok;
  }

  Future<bool> reprintLast() async {
    final job = await _loadLastJob();
    if (job == null) return false;
    final type = job['type']?.toString();
    if (type == 'order') {
      final linesRaw = job['lines'] as List<dynamic>? ?? [];
      final lines = linesRaw.map((e) => CartLine.fromMap(Map<String, dynamic>.from(e as Map))).toList();
      return printOrderReceipt(
        orderId: job['order_id']?.toString() ?? 'N/A',
        lines: lines,
        subtotalCents: _toInt(job['subtotal_cents']) ?? 0,
        discountCents: _toInt(job['discount_cents']) ?? 0,
        totalCents: _toInt(job['total_cents']) ?? 0,
      );
    }
    if (type == 'kitchen') {
      final itemsRaw = job['items'] as List<dynamic>? ?? [];
      final items = itemsRaw.map((e) {
        final m = Map<String, dynamic>.from(e as Map);
        return KdsItemLine(
          name: m['name']?.toString() ?? 'Item',
          qty: (m['qty'] is num) ? (m['qty'] as num).toDouble() : (double.tryParse('${m['qty']}') ?? 1),
          seatNo: _toInt(m['seat_no']),
        );
      }).toList();
      return printKitchenTicket(
        ticketId: job['ticket_id']?.toString() ?? 'N/A',
        orderId: job['order_id']?.toString() ?? 'N/A',
        stationName: job['station_name']?.toString() ?? 'Station',
        items: items,
      );
    }
    if (type == 'payment') {
      return printPaymentReceipt(
        orderId: job['order_id']?.toString() ?? 'N/A',
        paymentMethod: job['payment_method']?.toString() ?? 'manual',
        paidAmount: _toDouble(job['paid_amount']),
        dueAmountAfter: _toDouble(job['due_after']),
        changeAmount: _toDouble(job['change_amount']),
        tipAmount: _toDouble(job['tip_amount']),
        totalAmount: _toDouble(job['total_amount'], fallback: 0),
        taxAmount: _toDouble(job['tax_amount'], fallback: 0),
      );
    }
    return false;
  }

  Future<bool> testPrint() async {
    final cfg = await loadConfig();
    final profile = await CapabilityProfile.load();
    final paper = cfg.paperSizeMm == 58 ? PaperSize.mm58 : PaperSize.mm80;
    final gen = Generator(paper, profile);
    var bytes = <int>[];
    bytes += await _header(gen, cfg, title: 'PRINTER TEST');
    bytes += gen.text('Connection: ${cfg.connectionType.name.toUpperCase()}');
    bytes += gen.text('Address: ${cfg.printerAddress}:${cfg.printerPort}');
    bytes += gen.text('Time: ${DateTime.now().toLocal()}');
    if (cfg.qrData.trim().isNotEmpty) {
      bytes += gen.qrcode(cfg.qrData.trim(), align: PosAlign.center);
    }
    bytes += gen.feed(2);
    bytes += gen.cut();
    return _sendBytes(cfg, bytes);
  }
}
