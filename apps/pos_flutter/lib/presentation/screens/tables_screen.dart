import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/network/connectivity_service.dart';
import '../../core/storage/local_storage.dart';
import '../../data/local/app_database.dart';
import '../../domain/entities/table_layout.dart';
import '../../services/pos_realtime_sync.dart';
import '../../services/tables_layout_service.dart';
import 'orders_screen.dart';
import 'payment_screen.dart';

enum _ToolbarMode {
  normal,
  transferPickFrom,
  transferPickTo,
  mergePickSource,
  mergePickTarget,
}

class TablesScreen extends StatefulWidget {
  const TablesScreen({super.key});

  @override
  State<TablesScreen> createState() => _TablesScreenState();
}

class _TablesScreenState extends State<TablesScreen> {
  final _appDb = AppDatabase();
  late final TablesLayoutService _tables = TablesLayoutService(LocalStorage(), _appDb);
  final _connectivity = ConnectivityService();
  StreamSubscription<PosRealtimeEvent>? _orderEventsSub;

  BranchTableLayout? _layout;
  String? _floorId;
  bool _loading = true;
  bool _showingCache = false;
  bool _online = true;
  int _queued = 0;
  _ToolbarMode _mode = _ToolbarMode.normal;
  String? _transferOrderId;
  String? _mergeSourceOrderId;

  @override
  void initState() {
    super.initState();
    PosRealtimeSync.instance.addListener(_onRealtime);
    _orderEventsSub = PosRealtimeSync.instance.orderEvents.listen((event) {
      if (!mounted || event.orderId == null) return;
      if (event.name != 'item.ready' && event.name != 'kds.updated') return;
      final table = _findTableByOrderId(event.orderId!);
      final label = table?.name ?? 'Table';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$label has items ready to serve')),
      );
    });
    _connectivity.watchOnline().listen((o) {
      if (!mounted) return;
      setState(() => _online = o);
      if (o) _refresh(fromConnectivity: true);
    });
    _refresh();
  }

  @override
  void dispose() {
    PosRealtimeSync.instance.removeListener(_onRealtime);
    _orderEventsSub?.cancel();
    super.dispose();
  }

  DiningTableTile? _findTableByOrderId(String orderId) {
    final l = _layout;
    if (l == null) return null;
    for (final s in l.sections) {
      for (final t in s.tables) {
        if (t.activeOrderId == orderId) return t;
      }
    }
    return null;
  }

  void _onRealtime() {
    if (!mounted || !_online) return;
    unawaited(_refresh(fromRealtime: true));
  }

  Future<void> _refresh({
    bool fromConnectivity = false,
    bool fromRealtime = false,
  }) async {
    if (!fromRealtime) {
      setState(() {
        _loading = true;
      });
    }
    final remote = await _tables.fetchLayoutRemote();
    var layout = remote;
    var cached = false;
    if (layout == null) {
      layout = await _tables.loadCachedLayout();
      cached = layout != null;
    }
    final qc = await _tables.pendingQueueCount();
    if (!mounted) return;
    setState(() {
      _layout = layout;
      _showingCache = cached && remote == null;
      _queued = qc;
      _loading = false;
      if (_floorId == null && layout != null && layout.sections.isNotEmpty) {
        _floorId = layout.sections.first.id;
      } else if (layout != null &&
          _floorId != null &&
          !layout.sections.any((s) => s.id == _floorId)) {
        _floorId = layout.sections.isNotEmpty ? layout.sections.first.id : null;
      }
    });
    if (fromConnectivity &&
        !fromRealtime &&
        mounted &&
        remote != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tables layout updated')),
      );
    }
  }

  void _resetMode() {
    setState(() {
      _mode = _ToolbarMode.normal;
      _transferOrderId = null;
      _mergeSourceOrderId = null;
    });
  }

  FloorSection? get _currentSection {
    final l = _layout;
    if (l == null || _floorId == null) return null;
    for (final s in l.sections) {
      if (s.id == _floorId) return s;
    }
    return null;
  }

  Color _statusColor(TableVisualStatus s, BuildContext context) {
    switch (s) {
      case TableVisualStatus.available:
        return Colors.green.shade600;
      case TableVisualStatus.occupied:
        return Colors.deepOrange.shade700;
      case TableVisualStatus.preparing:
        return Colors.blue.shade700;
      case TableVisualStatus.ready:
        return Colors.teal.shade700;
      case TableVisualStatus.billing:
        return Colors.purple.shade700;
      case TableVisualStatus.inactive:
        return Colors.grey.shade600;
    }
  }

  Future<void> _openTableFlow(DiningTableTile table) async {
    final guestCtrl = TextEditingController(text: '2');
    final guests = await showDialog<int>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text('Open ${table.name}'),
          content: TextField(
            controller: guestCtrl,
            decoration: const InputDecoration(
              labelText: 'Guest count',
              border: OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(
              onPressed: () {
                final n = int.tryParse(guestCtrl.text.trim()) ?? 2;
                Navigator.pop(ctx, n.clamp(1, 99));
              },
              child: const Text('Open'),
            ),
          ],
        );
      },
    );
    if (guests == null || !mounted) return;
    final result = await _tables.openTable(table.id, guestCount: guests);
    if (!mounted) return;
    if (result == TableActionResult.applied) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Opened ${table.name}')),
      );
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const OrdersScreen()),
      );
    } else if (result == TableActionResult.queued) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Could not open online. Action saved to queue for when you reconnect.',
          ),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Open table failed on server. Check branch/table state and try again.'),
        ),
      );
    }
    await _refresh();
  }

  Future<void> _occupiedSheet(DiningTableTile table) async {
    final orderId = table.activeOrderId;
    if (orderId == null) return;
    await showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  table.name,
                  style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Order ${table.activeOrderNumber ?? orderId.substring(0, 8)}',
                  style: Theme.of(ctx).textTheme.bodyLarge,
                ),
                Text(
                  labelForVisual(visualStatusFor(table)),
                  style: Theme.of(ctx).textTheme.titleSmall,
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    _openCheck(orderId);
                  },
                  icon: const Icon(Icons.receipt_long),
                  label: const Text('Open check'),
                ),
                const SizedBox(height: 10),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    setState(() {
                      _mode = _ToolbarMode.transferPickTo;
                      _transferOrderId = orderId;
                    });
                  },
                  icon: const Icon(Icons.drive_file_move_outline),
                  label: const Text('Transfer to another table'),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    setState(() {
                      _mode = _ToolbarMode.mergePickTarget;
                      _mergeSourceOrderId = orderId;
                    });
                  },
                  icon: const Icon(Icons.merge_type),
                  label: const Text('Merge with another table'),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    _splitOrderFlow(orderId, table.name);
                  },
                  icon: const Icon(Icons.call_split),
                  label: const Text('Split selected items to new order'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _openCheck(String orderId) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PaymentScreen(orderId: orderId)),
    );
    if (!mounted) return;
    await _refresh();
  }

  Future<void> _splitOrderFlow(String orderId, String tableName) async {
    final items = await _tables.loadSplitCandidates(orderId);
    if (!mounted) return;
    if (items.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Need at least 2 active items in the order to split.'),
        ),
      );
      return;
    }
    final selected = <String>{};
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Split order — $tableName'),
        content: SizedBox(
          width: 520,
          child: StatefulBuilder(
            builder: (context, setInner) => ListView.builder(
              shrinkWrap: true,
              itemCount: items.length,
              itemBuilder: (_, i) {
                final it = items[i];
                final on = selected.contains(it.id);
                return CheckboxListTile(
                  value: on,
                  onChanged: (v) {
                    setInner(() {
                      if (v == true) {
                        selected.add(it.id);
                      } else {
                        selected.remove(it.id);
                      }
                    });
                  },
                  title: Text(it.name),
                  subtitle: Text('Qty ${it.qty} · ${it.status}'),
                  controlAffinity: ListTileControlAffinity.platform,
                );
              },
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: selected.isEmpty ? null : () => Navigator.pop(ctx, true),
            child: const Text('Split'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final result = await _tables.splitOrderItems(orderId, selected.toList());
    if (!mounted) return;
    if (result == TableActionResult.applied) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Order split into a new ticket')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Split failed on server. Please retry.')),
      );
    }
    await _refresh();
  }

  Future<void> _onTableTap(DiningTableTile table) async {
    final vis = visualStatusFor(table);

    switch (_mode) {
      case _ToolbarMode.transferPickFrom:
        if (table.activeOrderId != null) {
          setState(() {
            _transferOrderId = table.activeOrderId;
            _mode = _ToolbarMode.transferPickTo;
          });
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Choose destination table (tap an empty table)'),
              ),
            );
          }
        }
        return;
      case _ToolbarMode.transferPickTo:
        final oid = _transferOrderId;
        if (oid == null) return;
        if (table.activeOrderId == oid) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Choose a different table')),
            );
          }
          return;
        }
        if (table.activeOrderId != null && table.activeOrderId != oid) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Pick a table without an active order')),
            );
          }
          return;
        }
        if (!mounted) return;
        final go = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Transfer table?'),
            content: Text('Move order to ${table.name}?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Transfer'),
              ),
            ],
          ),
        );
        if (go != true || !mounted) return;
        final result = await _tables.transferOrder(oid, table.id);
        if (!mounted) return;
        if (result == TableActionResult.applied) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Transfer completed')),
          );
        } else if (result == TableActionResult.queued) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Transfer queued or failed. Retry when online.',
              ),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Transfer rejected by server. Refresh and try again.'),
            ),
          );
        }
        _resetMode();
        await _refresh();
        return;
      case _ToolbarMode.mergePickSource:
        if (table.activeOrderId == null) return;
        if (table.activeOrderId == _mergeSourceOrderId) return;
        setState(() {
          _mergeSourceOrderId = table.activeOrderId;
          _mode = _ToolbarMode.mergePickTarget;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Tap another table’s order to merge INTO (target)'),
            ),
          );
        }
        return;
      case _ToolbarMode.mergePickTarget:
        final src = _mergeSourceOrderId;
        final tgt = table.activeOrderId;
        if (src == null || tgt == null || src == tgt) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Choose a different occupied table'),
              ),
            );
          }
          return;
        }
        if (!mounted) return;
        final go = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Merge orders?'),
            content: const Text(
              'All items from the first order move into the second. '
              'The first order will be voided.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Merge'),
              ),
            ],
          ),
        );
        if (go != true || !mounted) return;
        final result = await _tables.mergeOrders(src, tgt);
        if (!mounted) return;
        if (result == TableActionResult.applied) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Orders merged')),
          );
        } else if (result == TableActionResult.queued) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Merge queued or failed. Retry when online.'),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Merge rejected by server. Refresh and try again.')),
          );
        }
        _resetMode();
        await _refresh();
        return;
      case _ToolbarMode.normal:
        break;
    }

    if (vis == TableVisualStatus.inactive) return;
    if (vis == TableVisualStatus.available || table.activeOrderId == null) {
      await _openTableFlow(table);
    } else {
      await _openCheck(table.activeOrderId!);
    }
  }

  @override
  Widget build(BuildContext context) {
    String modeHint = '';
    switch (_mode) {
      case _ToolbarMode.transferPickFrom:
        modeHint = 'Tap table WITH the order to move';
        break;
      case _ToolbarMode.transferPickTo:
        modeHint = 'Tap EMPTY destination table';
        break;
      case _ToolbarMode.mergePickSource:
        modeHint = 'Tap first order (source)';
        break;
      case _ToolbarMode.mergePickTarget:
        modeHint = 'Tap target order (keeps this bill)';
        break;
      case _ToolbarMode.normal:
        modeHint = '';
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tables'),
        actions: [
          if (_queued > 0)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Badge(
                  label: Text('$_queued'),
                  child: const Icon(Icons.outbox_outlined),
                ),
              ),
            ),
          if (_mode != _ToolbarMode.normal)
            TextButton(
              onPressed: _resetMode,
              child: const Text('Cancel'),
            ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : () => _refresh(),
            icon: const Icon(Icons.refresh),
          ),
        ],
        bottom: modeHint.isNotEmpty
            ? PreferredSize(
                preferredSize: const Size.fromHeight(36),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      modeHint,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.secondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              )
            : null,
      ),
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.12),
              Theme.of(context).colorScheme.tertiaryContainer.withValues(alpha: 0.08),
              Theme.of(context).colorScheme.surface,
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _layout == null || _layout!.sections.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'No floor layout. Create floors & tables in admin, '
                        'then refresh when online.\n'
                        '${_showingCache ? '(Showing last cached layout)' : ''}',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                : Column(
                    children: [
                      if (_showingCache || !_online)
                        Material(
                          color: Colors.orange.shade100,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.cloud_off, color: Colors.orange.shade900),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    _showingCache
                                        ? 'Offline or unreachable — showing cached layout'
                                        : 'Device offline — using cache',
                                    style: TextStyle(
                                      color: Colors.orange.shade900,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      _legendStrip(context),
                      Expanded(
                        child: LayoutBuilder(
                          builder: (ctx, c) {
                            final wide = c.maxWidth >= 840;
                            if (wide) {
                              return Row(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  SizedBox(
                                    width: 192,
                                    child: _floorList(context),
                                  ),
                                  const VerticalDivider(width: 1),
                                  Expanded(child: _tableGrid(context)),
                                ],
                              );
                            }
                            return Column(
                              children: [
                                SizedBox(height: 52, child: _floorStrip(context)),
                                const Divider(height: 1),
                                Expanded(child: _tableGrid(context)),
                              ],
                            );
                          },
                        ),
                      ),
                      _bottomActions(context),
                    ],
                  ),
      ),
    );
  }

  Widget _legendStrip(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Wrap(
        spacing: 8,
        runSpacing: 4,
        children: TableVisualStatus.values.map((s) {
          return Chip(
            avatar: CircleAvatar(
              backgroundColor: _statusColor(s, context),
              radius: 10,
            ),
            label: Text(labelForVisual(s)),
          );
        }).toList(),
      ),
    );
  }

  Widget _floorList(BuildContext context) {
    final sections = _layout!.sections;
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      child: ListView.builder(
        itemCount: sections.length,
        itemBuilder: (ctx, i) {
          final s = sections[i];
          final sel = s.id == _floorId;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Material(
              color: sel
                  ? Theme.of(context).colorScheme.primaryContainer
                  : Theme.of(context).colorScheme.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => setState(() => _floorId = s.id),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: 20,
                    horizontal: 12,
                  ),
                  child: Text(
                    s.name,
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: sel ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _floorStrip(BuildContext context) {
    final sections = _layout!.sections;
    return ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      itemCount: sections.length,
      separatorBuilder: (_, __) => const SizedBox(width: 8),
      itemBuilder: (ctx, i) {
        final s = sections[i];
        final sel = s.id == _floorId;
        return FilterChip(
          label: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
            child: Text(s.name),
          ),
          selected: sel,
          onSelected: (_) => setState(() => _floorId = s.id),
        );
      },
    );
  }

  Widget _tableGrid(BuildContext context) {
    final sec = _currentSection;
    final tables = sec?.tables ?? [];
    if (tables.isEmpty) {
      return const Center(child: Text('No tables on this floor'));
    }
    final cross = MediaQuery.sizeOf(context).width >= 920
        ? 4
        : MediaQuery.sizeOf(context).width > 520
            ? 3
            : 2;
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: cross,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.25,
      ),
      itemCount: tables.length,
      itemBuilder: (ctx, i) {
        final t = tables[i];
        final v = visualStatusFor(t);
        final bg = _statusColor(v, context);
        final fill = bg.withValues(alpha: 0.14);
        return Material(
          color: Theme.of(context).colorScheme.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(18),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => _onTableTap(t),
            onLongPress: t.activeOrderId == null ? null : () => _occupiedSheet(t),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                gradient: LinearGradient(
                  colors: [fill, Theme.of(context).colorScheme.surfaceContainerHigh],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                border: Border.all(color: bg, width: 4),
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${t.seats} seats',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    labelForVisual(v),
                    style: TextStyle(
                      color: bg,
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _bottomActions(BuildContext context) {
    if (_layout == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      child: Row(
        children: [
          Expanded(
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(54),
                backgroundColor: Theme.of(context).colorScheme.tertiary,
              ),
              onPressed: _mode != _ToolbarMode.normal
                  ? null
                  : () {
                      setState(() {
                        _mode = _ToolbarMode.transferPickFrom;
                        _transferOrderId = null;
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Tap the table that currently has the order',
                          ),
                        ),
                      );
                    },
              icon: const Icon(Icons.drive_file_move),
              label: const Text('Transfer order'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(54),
              ),
              onPressed: _mode != _ToolbarMode.normal
                  ? null
                  : () {
                      setState(() {
                        _mode = _ToolbarMode.mergePickSource;
                        _mergeSourceOrderId = null;
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Tap source table first, then target table',
                          ),
                        ),
                      );
                    },
              icon: const Icon(Icons.merge_type),
              label: const Text('Merge checks'),
            ),
          ),
        ],
      ),
    );
  }
}
