import 'package:flutter/material.dart';

import '../../services/pos_order_service.dart';
import '../../services/tables_layout_service.dart';
import '../../core/storage/local_storage.dart';
import '../../data/local/app_database.dart';
import 'orders_screen.dart';

class JournalScreen extends StatefulWidget {
  const JournalScreen({super.key});

  @override
  State<JournalScreen> createState() => _JournalScreenState();
}

class _JournalScreenState extends State<JournalScreen> {
  final _orders = PosOrderService(LocalStorage());
  late final TablesLayoutService _tables =
      TablesLayoutService(LocalStorage(), AppDatabase());

  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _rows = [];

  String _billState = 'all';
  String? _orderType;
  final _openedByCtrl = TextEditingController();
  final _deviceCtrl = TextEditingController();
  String? _floorId;
  List<({String id, String name})> _floors = [];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await _loadFloors();
    await _reload();
  }

  Future<void> _loadFloors() async {
    try {
      final layout = await _tables.loadLayoutPreferRemote();
      final seen = <String, String>{};
      if (layout != null) {
        for (final sec in layout.sections) {
          for (final t in sec.tables) {
            seen.putIfAbsent(t.floorId, () => sec.name);
          }
        }
      }
      setState(() {
        _floors = seen.entries.map((e) => (id: e.key, name: e.value)).toList();
      });
    } catch (_) {}
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await _orders.fetchJournal(
        billState: _billState == 'all' ? null : _billState,
        orderType: _orderType,
        openedBy:
            _openedByCtrl.text.trim().isEmpty ? null : _openedByCtrl.text.trim(),
        deviceId: _deviceCtrl.text.trim().isEmpty ? null : _deviceCtrl.text.trim(),
        floorId: _floorId,
      );
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Future<void> _openRow(Map<String, dynamic> row) async {
    final id = row['id']?.toString();
    if (id == null || id.isEmpty) return;
    final type = (row['order_type'] ?? '').toString().toUpperCase();
    final mode =
        type == 'DELIVERY' ? OrdersMode.deliveryEdit : OrdersMode.dineInEdit;
    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => OrdersScreen(orderId: id, mode: mode),
      ),
    );
    await _reload();
  }

  Future<void> _reopenRow(Map<String, dynamic> row) async {
    final id = row['id']?.toString();
    if (id == null || id.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reopen check'),
        content: const Text(
          'Reopens a closed or paid check so you can edit it again. Continue?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Reopen'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await _orders.reopenFromJournal(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reopened — opening order')),
      );
      await _openRow(row);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  void dispose() {
    _openedByCtrl.dispose();
    _deviceCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Journal'),
        actions: [
          IconButton(onPressed: _loading ? null : _reload, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'all', label: Text('All')),
                        ButtonSegment(value: 'open', label: Text('Open')),
                        ButtonSegment(value: 'closed', label: Text('Closed')),
                      ],
                      selected: {_billState},
                      onSelectionChanged: (s) {
                        setState(() => _billState = s.first);
                        _reload();
                      },
                    ),
                    SizedBox(
                      width: 200,
                      child: DropdownButtonFormField<String?>(
                        key: ValueKey('otype_$_orderType'),
                        initialValue: _orderType,
                        decoration: const InputDecoration(
                          labelText: 'Order type',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        items: const [
                          DropdownMenuItem<String?>(value: null, child: Text('Any type')),
                          DropdownMenuItem(value: 'DINE_IN', child: Text('Dine in')),
                          DropdownMenuItem(value: 'TAKEAWAY', child: Text('Takeaway / quick')),
                          DropdownMenuItem(value: 'DELIVERY', child: Text('Delivery')),
                        ],
                        onChanged: (v) {
                          setState(() => _orderType = v);
                          _reload();
                        },
                      ),
                    ),
                    if (_floors.isNotEmpty)
                      SizedBox(
                        width: 200,
                        child: DropdownButtonFormField<String?>(
                          key: ValueKey('floor_$_floorId'),
                          initialValue: _floorId,
                          decoration: const InputDecoration(
                            labelText: 'Section (floor)',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                          items: [
                            const DropdownMenuItem<String?>(value: null, child: Text('Any section')),
                            ..._floors.map(
                              (f) => DropdownMenuItem<String?>(value: f.id, child: Text(f.name)),
                            ),
                          ],
                          onChanged: (v) {
                            setState(() => _floorId = v);
                            _reload();
                          },
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _openedByCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Opened by (user id)',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        onSubmitted: (_) => _reload(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _deviceCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Device id (from payments)',
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                        onSubmitted: (_) => _reload(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: _loading ? null : _reload,
                      child: const Text('Apply filters'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _rows.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (ctx, i) {
                      final r = _rows[i];
                      final id = r['id']?.toString() ?? '';
                      final num = r['order_number']?.toString() ?? id.substring(0, 8);
                      final st = r['status']?.toString() ?? '';
                      final typ = r['order_type']?.toString() ?? '';
                      final total = r['total'];
                      final tbl = r['table_label']?.toString();
                      final sec = r['section_name']?.toString();
                      final devRaw = r['device_ids'];
                      final devices = devRaw is List ? devRaw.join(', ') : '';
                      final su = st.toUpperCase();
                      final canReopen =
                          su == 'CLOSED' || st == 'closed' || su == 'PAID' || su == 'BILLED';
                      return ListTile(
                        title: Text('#$num · $typ · $st'),
                        subtitle: Text(
                          [
                            'Total: \$$total',
                            if (tbl != null && tbl.isNotEmpty) 'Table: $tbl',
                            if (sec != null && sec.isNotEmpty) 'Section: $sec',
                            if (devices.isNotEmpty) 'Devices: $devices',
                          ].join(' · '),
                        ),
                        trailing: Wrap(
                          spacing: 4,
                          children: [
                            TextButton(
                              onPressed: () => _openRow(r),
                              child: const Text('Open'),
                            ),
                            if (canReopen)
                              TextButton(
                                onPressed: () => _reopenRow(r),
                                child: const Text('Reopen'),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
