import 'dart:async';

import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/config/api_config.dart';
import '../../core/network/connectivity_service.dart';
import '../../core/storage/local_storage.dart';
import '../../services/kds_service.dart';
import '../../services/printing/printer_service.dart';

enum _KdsTab { newTab, preparing, ready }

class KdsScreen extends StatefulWidget {
  const KdsScreen({super.key});

  @override
  State<KdsScreen> createState() => _KdsScreenState();
}

class _KdsScreenState extends State<KdsScreen> {
  final _storage = LocalStorage();
  late final _kds = KdsService(_storage);
  late final _printer = PrinterService(_storage);
  final _connectivity = ConnectivityService();

  List<KdsTicket> _tickets = [];
  bool _loading = true;
  bool _online = true;
  bool _wsConnected = false;
  String? _branchId;

  _KdsTab _tab = _KdsTab.newTab;
  io.Socket? _socket;
  Timer? _pollTimer;
  bool _busyAction = false;

  @override
  void initState() {
    super.initState();
    _connectivity.watchOnline().listen((o) {
      if (!mounted) return;
      setState(() => _online = o);
      if (o) {
        _connectWs();
        _refresh();
      }
    });
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final b = await _storage.getBranchScope();
    if (!mounted) return;
    setState(() => _branchId = (b ?? '').trim());
    _connectWs();
    await _refresh();
    _startPollingFallback();
  }

  void _connectWs() {
    final branchId = _branchId;
    if (branchId == null || branchId.isEmpty) return;
    if (!_online) return;

    _socket?.dispose();
    final s = io.io(
      ApiConfig.baseUrl,
      <String, dynamic>{
        'transports': ['websocket'],
        'autoConnect': false,
      },
    );
    _socket = s;

    s.onConnect((_) {
      if (!mounted) return;
      setState(() => _wsConnected = true);
      s.emit('join_branch', {'branch_id': branchId});
    });
    s.onDisconnect((_) {
      if (!mounted) return;
      setState(() => _wsConnected = false);
    });
    s.on('kds.ticket.updated', (_) {
      _refresh();
    });
    s.on('pos.order.updated', (_) {
      _refresh();
    });
    s.connect();
  }

  void _startPollingFallback() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 8), (_) async {
      if (!mounted) return;
      if (!_online) return;
      if (_wsConnected) return;
      await _refresh();
    });
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    final t = await _kds.fetchActiveTickets();
    if (!mounted) return;
    setState(() {
      _tickets = t;
      _loading = false;
    });
  }

  List<KdsTicket> _filtered() {
    String status;
    switch (_tab) {
      case _KdsTab.newTab:
        status = 'pending';
        break;
      case _KdsTab.preparing:
        status = 'preparing';
        break;
      case _KdsTab.ready:
        status = 'ready';
        break;
    }
    return _tickets.where((t) => t.status == status).toList();
  }

  String _tabLabel(_KdsTab t) {
    switch (t) {
      case _KdsTab.newTab:
        return 'New';
      case _KdsTab.preparing:
        return 'Preparing';
      case _KdsTab.ready:
        return 'Ready';
    }
  }

  Future<void> _markPreparing(KdsTicket t) async {
    setState(() => _busyAction = true);
    final ok = await _kds.updateTicketStatus(
      ticketId: t.id,
      status: 'preparing',
    );
    if (!mounted) return;
    setState(() => _busyAction = false);
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to update ticket')),
      );
      return;
    }
    await _refresh();
  }

  Future<void> _markReady(KdsTicket t) async {
    setState(() => _busyAction = true);
    final ok = await _kds.updateTicketStatus(
      ticketId: t.id,
      status: 'ready',
    );
    if (!mounted) return;
    setState(() => _busyAction = false);
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to update ticket')),
      );
      return;
    }
    await _refresh();
  }

  Future<void> _printTicket(KdsTicket t) async {
    final ok = await _printer.printKitchenTicket(
      ticketId: t.id,
      orderId: t.orderId,
      stationName: t.stationName,
      items: t.items,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ok ? 'Ticket printed' : 'Print failed')),
    );
  }

  Future<void> _reprintLast() async {
    final ok = await _printer.reprintLast();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ok ? 'Reprint sent' : 'No printable last job')),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _socket?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final list = _filtered();
    final wide = MediaQuery.of(context).size.width >= 900;

    return Scaffold(
      appBar: AppBar(
        title: const Text('KDS'),
        actions: [
          IconButton(
            tooltip: 'Reprint last',
            onPressed: _reprintLast,
            icon: const Icon(Icons.replay_outlined),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Text(
                _online ? (_wsConnected ? 'Live' : 'Polling') : 'Offline',
                style: TextStyle(
                  color: !_online
                      ? Colors.orangeAccent
                      : (_wsConnected ? Colors.greenAccent : Colors.amberAccent),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: SegmentedButton<_KdsTab>(
              segments: [
                ButtonSegment<_KdsTab>(
                  value: _KdsTab.newTab,
                  label: Text('New (${_tickets.where((t) => t.status == 'pending').length})'),
                ),
                ButtonSegment<_KdsTab>(
                  value: _KdsTab.preparing,
                  label: Text('Preparing (${_tickets.where((t) => t.status == 'preparing').length})'),
                ),
                ButtonSegment<_KdsTab>(
                  value: _KdsTab.ready,
                  label: Text('Ready (${_tickets.where((t) => t.status == 'ready').length})'),
                ),
              ],
              selected: {_tab},
              onSelectionChanged: (s) {
                if (s.isEmpty) return;
                setState(() => _tab = s.first);
              },
            ),
          ),
          if (_busyAction) const LinearProgressIndicator(minHeight: 3),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : list.isEmpty
                    ? Center(
                        child: Text(
                          'No ${_tabLabel(_tab)} tickets',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      )
                    : Padding(
                        padding: const EdgeInsets.all(12),
                        child: GridView.count(
                          crossAxisCount: wide ? 2 : 1,
                          childAspectRatio: wide ? 2.2 : 1.8,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          children: [
                            for (final t in list) _ticketCard(t),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _ticketCard(KdsTicket t) {
    final age = DateTime.now().difference(t.createdAt);
    final mins = age.inMinutes;
    final ageLabel = mins <= 0 ? 'now' : '${mins}m';

    Color badgeColor;
    switch (t.status) {
      case 'pending':
        badgeColor = Colors.blueAccent;
        break;
      case 'preparing':
        badgeColor = Colors.amber;
        break;
      case 'ready':
        badgeColor = Colors.green;
        break;
      default:
        badgeColor = Colors.grey;
    }

    final grouped = <String, double>{};
    for (final it in t.items) {
      grouped[it.name] = (grouped[it.name] ?? 0) + it.qty;
    }
    final lines = grouped.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));

    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    t.stationName,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: badgeColor.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: badgeColor.withValues(alpha: 0.7)),
                  ),
                  child: Text(
                    '${t.status.toUpperCase()} · $ageLabel',
                    style: TextStyle(
                      color: badgeColor,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Order: ${t.orderId}',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 10),
            Expanded(
              child: ListView(
                children: [
                  for (final e in lines)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 58,
                            child: Text(
                              _fmtQty(e.value),
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              e.key,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busyAction ? null : () => _printTicket(t),
                    icon: const Icon(Icons.print_outlined),
                    label: const Text('Print'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.tonal(
                    onPressed: _busyAction || t.status != 'pending'
                        ? null
                        : () => _markPreparing(t),
                    child: const Text('Mark preparing'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: _busyAction ||
                            (t.status != 'preparing' && t.status != 'pending')
                        ? null
                        : () => _markReady(t),
                    child: const Text('Mark ready'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static String _fmtQty(double v) {
    final i = v.round();
    if ((v - i).abs() < 0.0001) return 'x$i';
    return 'x${v.toStringAsFixed(2)}';
  }
}

