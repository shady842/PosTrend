import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/network/connectivity_service.dart';
import '../../core/storage/local_storage.dart';
import '../../data/local/app_database.dart';
import '../../services/payment_service.dart';
import '../../services/pos_realtime_sync.dart';
import '../../services/printing/printer_service.dart';
import '../../widgets/money_keypad.dart';

enum _PayMode { cash, card, partial, split }

enum _KeyTarget { tender, payAmount, tip, split1, split2 }

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final _payments = PaymentService(LocalStorage(), AppDatabase());
  final _printer = PrinterService(LocalStorage());
  final _connectivity = ConnectivityService();

  OrderPaymentSnapshot? _snap;
  Map<String, dynamic>? _orderJson;
  bool _loading = true;
  bool _busy = false;
  bool _online = true;
  int _payQueuePending = 0;

  _PayMode _mode = _PayMode.cash;
  _KeyTarget _keyTarget = _KeyTarget.tender;

  String _tender = '';
  String _payAmount = '';
  String _tip = '';
  String _split1 = '';
  String _split2 = '';
  String _splitMethod1 = 'cash';
  String _splitMethod2 = 'card';
  String _partialMethod = 'card';

  double? _lastChange;
  double? _lastTender;
  String? _lastPayLabel;

  StreamSubscription<PosRealtimeEvent>? _realtimeSub;

  @override
  void initState() {
    super.initState();
    _realtimeSub = PosRealtimeSync.instance.orderEvents.listen((e) {
      if (!mounted) return;
      if (e.orderId != widget.orderId) return;
      _reload();
    });
    _connectivity.watchOnline().listen((o) {
      if (!mounted) return;
      setState(() => _online = o);
      if (o) _reload();
    });
    _reload();
  }

  @override
  void dispose() {
    _realtimeSub?.cancel();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() => _loading = true);
    final snap = await _payments.fetchPaymentState(widget.orderId);
    final order = await _payments.fetchOrderForReceipt(widget.orderId);
    final q = await _payments.pendingQueueCount();
    if (!mounted) return;
    setState(() {
      _snap = snap;
      _orderJson = order;
      _payQueuePending = q;
      _loading = false;
    });
  }

  static String _fmtMoney(double v) => '\$${v.toStringAsFixed(2)}';

  static double _parseMoney(String s) {
    final t = s.trim();
    if (t.isEmpty) return 0;
    return double.tryParse(t) ?? 0;
  }

  static String _appendMoney(String current, String ch) {
    if (ch == '.') {
      if (current.contains('.')) return current;
      return current.isEmpty ? '0.' : '$current.';
    }
    if (ch.length != 1 || int.tryParse(ch) == null) return current;
    if (current == '0') return ch;
    final dot = current.indexOf('.');
    if (dot >= 0 && current.length - dot - 1 >= 2) return current;
    return current + ch;
  }

  String _activeString() {
    switch (_keyTarget) {
      case _KeyTarget.tender:
        return _tender;
      case _KeyTarget.payAmount:
        return _payAmount;
      case _KeyTarget.tip:
        return _tip;
      case _KeyTarget.split1:
        return _split1;
      case _KeyTarget.split2:
        return _split2;
    }
  }

  void _setActiveString(String v) {
    setState(() {
      switch (_keyTarget) {
        case _KeyTarget.tender:
          _tender = v;
          break;
        case _KeyTarget.payAmount:
          _payAmount = v;
          break;
        case _KeyTarget.tip:
          _tip = v;
          break;
        case _KeyTarget.split1:
          _split1 = v;
          break;
        case _KeyTarget.split2:
          _split2 = v;
          break;
      }
    });
  }

  void _onDigit(String d) => _setActiveString(_appendMoney(_activeString(), d));

  void _onDecimal() => _setActiveString(_appendMoney(_activeString(), '.'));

  void _onBackspace() {
    final s = _activeString();
    if (s.isEmpty) return;
    _setActiveString(s.substring(0, s.length - 1));
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _tryAutoPrintPayment({
    required String method,
    required double paidAmount,
    required double changeAmount,
  }) async {
    final cfg = await _printer.loadConfig();
    if (!cfg.enabled || !cfg.autoPrintPaymentReceipt) return;
    final snap = _snap;
    final dueAfter = snap?.dueAmount ?? 0;
    final total = snap?.orderTotal;
    await _printer.printPaymentReceipt(
      orderId: widget.orderId,
      paymentMethod: method,
      paidAmount: paidAmount,
      dueAmountAfter: dueAfter,
      changeAmount: changeAmount,
      tipAmount: _parseMoney(_tip),
      totalAmount: total,
      taxAmount: _orderJson == null
          ? null
          : (double.tryParse(_orderJson!['tax']?.toString() ?? '')),
    );
  }

  Future<void> _manualPrintPaymentReceipt() async {
    final snap = _snap;
    if (snap == null) return;
    final paid = _lastPayLabel == null ? 0.0 : (snap.orderTotal - snap.dueAmount);
    final ok = await _printer.printPaymentReceipt(
      orderId: widget.orderId,
      paymentMethod: _lastPayLabel ?? 'manual',
      paidAmount: paid < 0 ? 0 : paid,
      dueAmountAfter: snap.dueAmount,
      changeAmount: _lastChange ?? 0,
      tipAmount: _parseMoney(_tip),
      totalAmount: snap.orderTotal,
      taxAmount: double.tryParse(_orderJson?['tax']?.toString() ?? ''),
    );
    _snack(ok ? 'Payment receipt printed' : 'Print failed');
  }

  Future<void> _reprintLast() async {
    final ok = await _printer.reprintLast();
    _snack(ok ? 'Reprint sent' : 'No printable last job');
  }

  Future<void> _payCash() async {
    final snap = _snap;
    if (snap == null || snap.dueAmount < 0.01) return;
    final tender = _parseMoney(_tender);
    if (tender < 0.01) {
      _snack('Enter tender amount');
      return;
    }
    final due = snap.dueAmount;
    final apply = tender >= due ? due : tender;
    if (apply < 0.01) return;

    setState(() => _busy = true);
    final idem = _payments.newIdempotencyKey('cash');
    final ok = await _payments.addPayment(
      orderId: widget.orderId,
      paymentMethod: 'cash',
      amount: _round2(apply),
      idempotencyKey: idem,
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      _lastTender = tender;
      _lastChange = tender - apply;
      _lastPayLabel = 'Cash ${_fmtMoney(apply)}';
    });
    await _reload();
    if (!mounted) return;
    if (!ok) {
      _snack('Saved offline — payment will sync when online');
    } else {
      _snack('Payment recorded');
    }
    await _tryAutoPrintPayment(
      method: 'cash',
      paidAmount: _round2(apply),
      changeAmount: _round2((tender - apply).clamp(0, 999999)),
    );
    setState(() => _tender = '');
  }

  Future<void> _payCardFull() async {
    final snap = _snap;
    if (snap == null || snap.dueAmount < 0.01) return;
    setState(() => _busy = true);
    final ok = await _payments.addPayment(
      orderId: widget.orderId,
      paymentMethod: 'card',
      amount: _round2(snap.dueAmount),
      idempotencyKey: _payments.newIdempotencyKey('card'),
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      _lastPayLabel = 'Card ${_fmtMoney(snap.dueAmount)}';
      _lastTender = null;
      _lastChange = null;
    });
    await _reload();
    if (!mounted) return;
    if (!ok) {
      _snack('Saved offline — payment will sync when online');
    } else {
      _snack('Payment recorded');
    }
    await _tryAutoPrintPayment(
      method: 'card',
      paidAmount: _round2(snap.dueAmount),
      changeAmount: 0,
    );
  }

  Future<void> _payPartial() async {
    final snap = _snap;
    if (snap == null || snap.dueAmount < 0.01) return;
    final raw = _parseMoney(_payAmount);
    if (raw < 0.01) {
      _snack('Enter amount');
      return;
    }
    final amt = raw > snap.dueAmount ? snap.dueAmount : raw;
    setState(() => _busy = true);
    final ok = await _payments.addPayment(
      orderId: widget.orderId,
      paymentMethod: _partialMethod,
      amount: _round2(amt),
      idempotencyKey: _payments.newIdempotencyKey('partial'),
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      _lastPayLabel =
          '${_partialMethod.toUpperCase()} (partial) ${_fmtMoney(amt)}';
      _lastTender = null;
      _lastChange = null;
    });
    await _reload();
    if (!mounted) return;
    if (!ok) {
      _snack('Saved offline — payment will sync when online');
    } else {
      _snack('Payment recorded');
    }
    await _tryAutoPrintPayment(
      method: _partialMethod,
      paidAmount: _round2(amt),
      changeAmount: 0,
    );
    setState(() => _payAmount = '');
  }

  Future<void> _paySplit() async {
    final snap = _snap;
    if (snap == null || snap.dueAmount < 0.01) return;
    final a = _parseMoney(_split1);
    final b = _parseMoney(_split2);
    if (a < 0.01 || b < 0.01) {
      _snack('Enter both split amounts');
      return;
    }
    final sum = a + b;
    if ((sum - snap.dueAmount).abs() > 0.03) {
      _snack('Splits must add up to amount due (${_fmtMoney(snap.dueAmount)})');
      return;
    }
    setState(() => _busy = true);
    final splits = <Map<String, dynamic>>[
      {
        'payment_method': _splitMethod1,
        'amount': _round2(a),
        'idempotency_key': _payments.newIdempotencyKey('spl1'),
      },
      {
        'payment_method': _splitMethod2,
        'amount': _round2(b),
        'idempotency_key': _payments.newIdempotencyKey('spl2'),
      },
    ];
    final ok = await _payments.splitPayment(
      orderId: widget.orderId,
      splits: splits,
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      _lastPayLabel =
          'Split ${_splitMethod1.toUpperCase()} ${_fmtMoney(a)} + ${_splitMethod2.toUpperCase()} ${_fmtMoney(b)}';
      _lastTender = null;
      _lastChange = null;
    });
    await _reload();
    if (!mounted) return;
    if (!ok) {
      _snack('Saved offline — split will sync when online');
    } else {
      _snack('Split payment recorded');
    }
    await _tryAutoPrintPayment(
      method: 'split',
      paidAmount: _round2(a + b),
      changeAmount: 0,
    );
    setState(() {
      _split1 = '';
      _split2 = '';
    });
  }

  double _round2(double v) => (v * 100).round() / 100;

  Future<void> _closeOrder() async {
    setState(() => _busy = true);
    final ok = await _payments.closeOrder(widget.orderId);
    if (!mounted) return;
    setState(() => _busy = false);
    await _reload();
    if (!mounted) return;
    if (!ok) {
      _snack('Close queued — will sync when online');
    } else {
      _snack('Order closed');
    }
  }

  void _showReceiptPreview() {
    final order = _orderJson;
    final snap = _snap;
    final tip = _parseMoney(_tip);
    final lines = <String>[];
    if (order != null) {
      final id = order['id'] ?? widget.orderId;
      lines.add('Order: $id');
      final items = order['items'];
      if (items is List) {
        for (final raw in items) {
          if (raw is! Map) continue;
          final m = Map<String, dynamic>.from(raw);
          final name = (m['nameSnapshot'] as String?) ??
              (m['menuItem'] is Map
                  ? (m['menuItem'] as Map)['name'] as String?
                  : null) ??
              'Item';
          final qty = m['qty'];
          final lineTotal = m['lineTotal'];
          lines.add('  $name × $qty  ${_lineMoney(lineTotal)}');
        }
      }
      lines.add('Subtotal (server): ${_lineMoney(order['subtotal'])}');
      lines.add('Tax: ${_lineMoney(order['tax'])}');
      lines.add('Total: ${_lineMoney(order['total'])}');
    } else {
      lines.add('Order: ${widget.orderId}');
    }
    if (snap != null) {
      lines.add('Paid: ${_fmtMoney(snap.paidAmount)}');
      lines.add('Due: ${_fmtMoney(snap.dueAmount)}');
    }
    if (_lastPayLabel != null) lines.add('Last tender: $_lastPayLabel');
    if (_lastTender != null) {
      lines.add('Cash tendered: ${_fmtMoney(_lastTender!)}');
    }
    if (_lastChange != null) {
      lines.add('Change: ${_fmtMoney(_lastChange!)}');
    }
    if (tip >= 0.01) {
      lines.add(
        'Tip (receipt note — not added to order total): ${_fmtMoney(tip)}',
      );
    }
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Receipt preview'),
        content: SingleChildScrollView(
          child: SelectableText(lines.join('\n')),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  static String _lineMoney(dynamic v) {
    if (v == null) return _fmtMoney(0);
    if (v is num) return _fmtMoney(v.toDouble());
    return _fmtMoney(double.tryParse(v.toString()) ?? 0);
  }

  void _setMode(_PayMode m) {
    setState(() {
      _mode = m;
      switch (m) {
        case _PayMode.cash:
          _keyTarget = _KeyTarget.tender;
          break;
        case _PayMode.card:
          _keyTarget = _KeyTarget.payAmount;
          break;
        case _PayMode.partial:
          _keyTarget = _KeyTarget.payAmount;
          break;
        case _PayMode.split:
          _keyTarget = _KeyTarget.split1;
          break;
      }
    });
  }

  Widget _fieldChip(String label, _KeyTarget t, String value) {
    final sel = _keyTarget == t;
    return ChoiceChip(
      label: Text('$label: ${value.isEmpty ? '—' : value}'),
      selected: sel,
      onSelected: (v) {
        if (v) setState(() => _keyTarget = t);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final snap = _snap;
    final wide = MediaQuery.of(context).size.width >= 720;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Payment'),
        actions: [
          IconButton(
            tooltip: 'Print payment receipt',
            onPressed: _loading || _busy ? null : _manualPrintPaymentReceipt,
            icon: const Icon(Icons.print_outlined),
          ),
          IconButton(
            tooltip: 'Reprint last',
            onPressed: _loading || _busy ? null : _reprintLast,
            icon: const Icon(Icons.replay_outlined),
          ),
          if (_payQueuePending > 0)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Text(
                  'Queued: $_payQueuePending',
                  style: const TextStyle(fontSize: 13),
                ),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading || _busy ? null : _reload,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : snap == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      'Could not load payment state. Check order ID, login, and network.\n\n'
                      '${_online ? '' : 'Offline: open this screen when online once to refresh.'}',
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : Padding(
                  padding: const EdgeInsets.all(12),
                  child: wide
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Expanded(
                              flex: 5,
                              child: SingleChildScrollView(
                                child: _buildLeftPanel(snap),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              flex: 4,
                              child: SingleChildScrollView(
                                child: _buildKeypadColumn(),
                              ),
                            ),
                          ],
                        )
                      : SingleChildScrollView(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _buildLeftPanel(snap),
                              const SizedBox(height: 16),
                              _buildKeypadColumn(),
                            ],
                          ),
                        ),
                ),
    );
  }

  Widget _buildLeftPanel(OrderPaymentSnapshot snap) {
    final due = snap.dueAmount;
    final canClose = snap.readyToClose;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Order ${widget.orderId}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text('Total: ${_fmtMoney(snap.orderTotal)}'),
                Text('Paid: ${_fmtMoney(snap.paidAmount)}'),
                Text(
                  'Due: ${_fmtMoney(due)}',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _online ? 'Online' : 'Offline',
                  style: TextStyle(
                    color: _online ? Colors.green : Colors.orange,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ChoiceChip(
              label: const Text('Cash'),
              selected: _mode == _PayMode.cash,
              onSelected: (v) {
                if (v) _setMode(_PayMode.cash);
              },
            ),
            ChoiceChip(
              label: const Text('Card'),
              selected: _mode == _PayMode.card,
              onSelected: (v) {
                if (v) _setMode(_PayMode.card);
              },
            ),
            ChoiceChip(
              label: const Text('Partial'),
              selected: _mode == _PayMode.partial,
              onSelected: (v) {
                if (v) _setMode(_PayMode.partial);
              },
            ),
            ChoiceChip(
              label: const Text('Split'),
              selected: _mode == _PayMode.split,
              onSelected: (v) {
                if (v) _setMode(_PayMode.split);
              },
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (_mode == _PayMode.cash) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _fieldChip('Tender', _KeyTarget.tender, _tender),
              _fieldChip('Tip (receipt)', _KeyTarget.tip, _tip),
            ],
          ),
          if (_tender.isNotEmpty && due >= 0.01)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                () {
                  final t = _parseMoney(_tender);
                  final apply = t >= due ? due : t;
                  final ch = t - apply;
                  return 'Apply ${_fmtMoney(apply)} to check · Change ${_fmtMoney(ch)}';
                }(),
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy || due < 0.01 ? null : _payCash,
            child: const Text('Take cash payment'),
          ),
        ],
        if (_mode == _PayMode.card) ...[
          const Text('Card settles full balance in one tap.'),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy || due < 0.01 ? null : _payCardFull,
            child: Text('Card — pay ${_fmtMoney(due)}'),
          ),
        ],
        if (_mode == _PayMode.partial) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ChoiceChip(
                label: const Text('Partial · Card'),
                selected: _partialMethod == 'card',
                onSelected: (v) {
                  if (v) setState(() => _partialMethod = 'card');
                },
              ),
              ChoiceChip(
                label: const Text('Partial · Cash'),
                selected: _partialMethod == 'cash',
                onSelected: (v) {
                  if (v) setState(() => _partialMethod = 'cash');
                },
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _fieldChip('Amount', _KeyTarget.payAmount, _payAmount),
              _fieldChip('Tip (receipt)', _KeyTarget.tip, _tip),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy || due < 0.01 ? null : _payPartial,
            child: const Text('Record partial payment'),
          ),
        ],
        if (_mode == _PayMode.split) ...[
          const Text('1st tender'),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment<String>(value: 'cash', label: Text('Cash')),
              ButtonSegment<String>(value: 'card', label: Text('Card')),
            ],
            selected: {_splitMethod1},
            onSelectionChanged: _busy
                ? null
                : (s) {
                    if (s.isEmpty) return;
                    setState(() => _splitMethod1 = s.first);
                  },
          ),
          const SizedBox(height: 8),
          const Text('2nd tender'),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment<String>(value: 'cash', label: Text('Cash')),
              ButtonSegment<String>(value: 'card', label: Text('Card')),
            ],
            selected: {_splitMethod2},
            onSelectionChanged: _busy
                ? null
                : (s) {
                    if (s.isEmpty) return;
                    setState(() => _splitMethod2 = s.first);
                  },
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _fieldChip('Split 1', _KeyTarget.split1, _split1),
              _fieldChip('Split 2', _KeyTarget.split2, _split2),
              _fieldChip('Tip (receipt)', _KeyTarget.tip, _tip),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _busy || due < 0.01 ? null : _paySplit,
            child: const Text('Record split payment'),
          ),
        ],
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _showReceiptPreview,
          icon: const Icon(Icons.receipt_long),
          label: const Text('Receipt preview'),
        ),
        const SizedBox(height: 8),
        FilledButton.tonal(
          onPressed: !canClose || _busy ? null : _closeOrder,
          child: const Text('Close order'),
        ),
        if (_busy) const LinearProgressIndicator(),
      ],
    );
  }

  Widget _buildKeypadColumn() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: MoneyKeypad(
          keyHeight: 72,
          onDigit: _onDigit,
          onDecimal: _onDecimal,
          onBackspace: _onBackspace,
        ),
      ),
    );
  }
}
