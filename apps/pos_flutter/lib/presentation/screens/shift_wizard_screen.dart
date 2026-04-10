import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/storage/local_storage.dart';
import '../../services/printing/printer_service.dart';
import '../../services/shift_service.dart';
import 'cashier_login_screen.dart';

class ShiftWizardScreen extends StatefulWidget {
  const ShiftWizardScreen({super.key});

  @override
  State<ShiftWizardScreen> createState() => _ShiftWizardScreenState();
}

class _ShiftWizardScreenState extends State<ShiftWizardScreen> {
  final _storage = LocalStorage();
  late final ShiftService _shift = ShiftService(_storage);
  late final PrinterService _printer = PrinterService(_storage);

  bool _loading = true;
  bool _busy = false;
  ShiftCurrentState? _current;
  Map<String, dynamic>? _summary;
  /// Live POS report for the open shift window (`GET /v1/pos/shifts/sales-report`).
  Map<String, dynamic>? _shiftReport;

  final _nameCtrl = TextEditingController(text: 'Main Shift');
  final _cashierCtrl = TextEditingController();
  final _floatCtrl = TextEditingController(text: '0');
  final _countCtrl = TextEditingController();

  int _step = 0;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final who = (await _storage.getDeviceDisplayName())?.trim();
    final code = (await _storage.getDeviceCode())?.trim();
    if ((who ?? '').isNotEmpty) {
      _cashierCtrl.text = who!;
    } else if ((code ?? '').isNotEmpty) {
      _cashierCtrl.text = code!;
    } else {
      _cashierCtrl.text = 'Cashier';
    }
    await _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    final current = await _shift.currentShift();
    final summary = await _shift.dayCloseSummary();
    Map<String, dynamic>? rep;
    if (current != null) {
      rep = await _shift.fetchPosSalesReport();
    }
    if (!mounted) return;
    setState(() {
      _current = current;
      _summary = summary;
      _shiftReport = rep;
      _loading = false;
      _step = current == null ? 0 : 1;
      if (current != null) {
        _countCtrl.text = current.expectedAmount.toStringAsFixed(2);
      }
    });
  }

  Future<void> _shareReport(String title, Map<String, dynamic> report) async {
    final text = ShiftService.formatSalesReport(report);
    await Share.share(text, subject: title);
  }

  Future<void> _printReport(String title, Map<String, dynamic> report) async {
    final text = ShiftService.formatSalesReport(report);
    final ok = await _printer.printTextReport(title: title, body: text);
    if (!mounted) return;
    _snack(ok ? 'Sent to printer' : 'Printer disabled or unreachable');
  }

  Future<void> _showReportSheet(String title, Map<String, dynamic> report) async {
    final text = ShiftService.formatSalesReport(report);
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            bottom: MediaQuery.paddingOf(ctx).bottom + 16,
            top: 8,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(title, style: Theme.of(ctx).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              SizedBox(
                height: MediaQuery.sizeOf(ctx).height * 0.45,
                child: SingleChildScrollView(child: SelectableText(text)),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _shareReport(title, report),
                      icon: const Icon(Icons.share_outlined),
                      label: const Text('Share'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => _printReport(title, report),
                      icon: const Icon(Icons.print_outlined),
                      label: const Text('Print'),
                    ),
                  ),
                ],
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Close'),
              ),
            ],
          ),
        );
      },
    );
  }

  double _moneyInput(TextEditingController c) {
    return double.tryParse(c.text.trim()) ?? 0;
  }

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  Future<void> _openShift() async {
    final name = _nameCtrl.text.trim();
    final by = _cashierCtrl.text.trim();
    final amt = _moneyInput(_floatCtrl);
    if (name.isEmpty || by.isEmpty) {
      _snack('Enter shift name and cashier');
      return;
    }
    setState(() => _busy = true);
    final res = await _shift.openShift(
      name: name,
      openedBy: by,
      startingAmount: amt,
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (res == null) {
      _snack('Open shift failed');
      return;
    }
    _snack('Shift opened');
    await _refresh();
  }

  Future<void> _closeShift() async {
    final cur = _current;
    if (cur == null) return;
    final by = _cashierCtrl.text.trim();
    final ending = _moneyInput(_countCtrl);
    if (by.isEmpty) {
      _snack('Enter cashier');
      return;
    }
    setState(() => _busy = true);
    final res = await _shift.closeShift(
      shiftId: cur.shiftId,
      closedBy: by,
      endingAmount: ending,
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (res == null) {
      _snack('Close shift failed');
      return;
    }
    final variance = ShiftService.money(res['variance']);
    _snack('Shift closed. Variance: $variance');
    final rawRep = res['sales_report'];
    if (rawRep is Map) {
      final report = Map<String, dynamic>.from(rawRep);
      await _showReportSheet('Shift close report', report);
    }
    final deviceToken = await _storage.getDeviceAuthToken();
    await _storage.saveJwt(deviceToken ?? '');
    if (!mounted) return;
    await Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const CashierLoginScreen()),
      (route) => false,
    );
  }

  Future<void> _runDayClose() async {
    final by = _cashierCtrl.text.trim();
    if (by.isEmpty) {
      _snack('Enter cashier');
      return;
    }
    setState(() => _busy = true);
    final res = await _shift.runDayClose(closedBy: by);
    if (!mounted) return;
    setState(() => _busy = false);
    if (res == null) {
      _snack('Day close failed (check role/open shifts)');
      return;
    }
    _snack('Day close posted');
    final comp = res['comprehensive_report'];
    if (comp is Map) {
      await _showReportSheet('Day close report', Map<String, dynamic>.from(comp));
    }
    await _refresh();
  }

  Widget _summaryCard() {
    final rep = _shiftReport;
    if (rep != null) {
      final items = (rep['items'] as List?) ?? const [];
      final cats = (rep['categories'] as List?) ?? const [];
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Shift sales report',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
              ),
              const SizedBox(height: 6),
              Text('Orders: ${rep['orders_count'] ?? 0}'),
              Text('Sales total: ${ShiftService.money(rep['sales_total'])}'),
              Text('Tax: ${ShiftService.money(rep['tax'])} · Service: ${ShiftService.money(rep['service'])}'),
              Text('Discounts: ${ShiftService.money(rep['discounts'])}'),
              Text('Payments: ${ShiftService.money(rep['payments_total'])}'),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : () => _shareReport('Shift sales report', rep),
                      icon: const Icon(Icons.share_outlined),
                      label: const Text('Share'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _busy ? null : () => _printReport('Shift sales report', rep),
                      icon: const Icon(Icons.print_outlined),
                      label: const Text('Print'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text('Top items (${items.length})', style: const TextStyle(fontWeight: FontWeight.w700)),
              ...items.take(5).map((row) {
                if (row is! Map) return const SizedBox.shrink();
                final m = Map<String, dynamic>.from(row);
                return Text('  ${m['name']}: ${m['qty']} → ${ShiftService.money(m['amount'])}');
              }),
              const SizedBox(height: 6),
              Text('Categories (${cats.length})', style: const TextStyle(fontWeight: FontWeight.w700)),
              ...cats.take(5).map((row) {
                if (row is! Map) return const SizedBox.shrink();
                final m = Map<String, dynamic>.from(row);
                return Text('  ${m['name']}: ${ShiftService.money(m['amount'])}');
              }),
            ],
          ),
        ),
      );
    }

    final s = _summary;
    if (s == null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Text(
            _current == null
                ? 'Open a shift to see a live sales, tax, payment, item and category report here.'
                : 'Could not load shift report. Check login permissions or try refresh.',
          ),
        ),
      );
    }
    final sales = (s['sales_summary'] as Map?) ?? const {};
    final pay = (s['payment_summary'] as Map?) ?? const {};
    final cash = (s['cash_summary'] as Map?) ?? const {};
    final byMethod = (pay['by_method'] as Map?) ?? const {};

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Day close preview', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            const SizedBox(height: 8),
            Text('Sales: ${ShiftService.money(sales['total_sales'])}'),
            Text('Closed orders: ${sales['closed_orders'] ?? 0}'),
            const SizedBox(height: 8),
            Text('Payments total: ${ShiftService.money(pay['total_payments'])}'),
            if (byMethod.isNotEmpty)
              Wrap(
                spacing: 10,
                runSpacing: 4,
                children: [
                  for (final e in byMethod.entries)
                    Chip(label: Text('${e.key}: ${ShiftService.money(e.value)}')),
                ],
              ),
            const SizedBox(height: 8),
            Text('Cash expected: ${ShiftService.money(cash['expected_cash'])}'),
            Text('Cash counted: ${ShiftService.money(cash['counted_cash'])}'),
            Text('Cash variance: ${ShiftService.money(cash['variance'])}'),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _cashierCtrl.dispose();
    _floatCtrl.dispose();
    _countCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final cur = _current;
    final expected = cur?.expectedAmount ?? 0;
    final entered = _moneyInput(_countCtrl);
    final variance = entered - expected;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Shift & Day Close'),
        actions: [
          IconButton(onPressed: _busy ? null : _refresh, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          Stepper(
            currentStep: _step,
            controlsBuilder: (_, __) => const SizedBox.shrink(),
            steps: [
              Step(
                title: const Text('Open shift'),
                isActive: cur == null,
                state: cur == null ? StepState.editing : StepState.complete,
                content: Column(
                  children: [
                    TextField(
                      controller: _nameCtrl,
                      decoration: const InputDecoration(labelText: 'Shift name', border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _cashierCtrl,
                      decoration: const InputDecoration(labelText: 'Cashier', border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _floatCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Cash float', border: OutlineInputBorder()),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _busy || cur != null ? null : _openShift,
                        child: const Text('Open shift'),
                      ),
                    ),
                  ],
                ),
              ),
              Step(
                title: const Text('Close shift'),
                isActive: cur != null,
                state: cur == null ? StepState.disabled : StepState.editing,
                content: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (cur != null) ...[
                      Text('Shift: ${cur.shiftName}'),
                      Text('Opened by: ${cur.openedBy}'),
                      Text('Expected cash: ${ShiftService.money(cur.expectedAmount)}', style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _countCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Cash count', border: OutlineInputBorder()),
                      ),
                      const SizedBox(height: 8),
                      Text('Variance: ${ShiftService.money(variance)}'),
                    ],
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.tonal(
                        onPressed: _busy || cur == null ? null : _closeShift,
                        child: const Text('Close shift'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _summaryCard(),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _busy || cur != null ? null : _runDayClose,
              icon: const Icon(Icons.summarize_outlined),
              label: const Text('Post day close (/v1/day-close)'),
            ),
          ),
          if (cur != null)
            const Padding(
              padding: EdgeInsets.only(top: 10),
              child: Text('Close the open shift before day closing.', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
          if (_busy) const Padding(
            padding: EdgeInsets.only(top: 12),
            child: LinearProgressIndicator(),
          ),
        ],
      ),
    );
  }
}
