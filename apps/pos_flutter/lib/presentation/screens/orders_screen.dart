import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/network/connectivity_service.dart';
import '../../core/storage/local_storage.dart';
import '../../data/local/app_database.dart';
import '../../data/local/pos_local_repository.dart';
import '../../data/local/sync_outbox_repository.dart';
import '../../domain/entities/cart_line.dart';
import '../../domain/entities/pos_menu.dart';
import '../../services/kds_service.dart';
import '../../services/menu_sync_service.dart';
import '../../services/offline_sync_engine.dart';
import '../../services/pos_order_service.dart';
import '../../services/printing/printer_service.dart';
import '../../services/tables_layout_service.dart';
import '../widgets/pos_order_sheets.dart';
import 'payment_screen.dart';

enum OrdersMode {
  takeawayDraft,
  dineInEdit,
  deliveryEdit,
}

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({
    super.key,
    this.orderId,
    this.mode = OrdersMode.takeawayDraft,
  });

  final String? orderId;
  final OrdersMode mode;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  final _appDb = AppDatabase();
  final _storage = LocalStorage();
  final _printer = PrinterService(LocalStorage());
  late final PosLocalRepository _repo = PosLocalRepository(_appDb);
  late final MenuSyncService _menuSync = MenuSyncService(LocalStorage(), _appDb);
  late final PosOrderService _orderService = PosOrderService(LocalStorage());
  late final TablesLayoutService _tablesLayout = TablesLayoutService(_storage, _appDb);
  final _connectivity = ConnectivityService();
  final _searchCtrl = TextEditingController();

  List<MenuCategory> _categories = [];
  String? _categoryId;
  List<MenuItem> _items = [];
  List<CartLine> _lines = [];
  bool _loading = true;
  bool _online = true;
  int _pendingOutbox = 0;
  String? _latestSyncError;
  bool _syncBusy = false;
  String? _menuSyncedAt;
  Timer? _draftDebounce;
  String? _activeOrderId;
  String? _activeOrderNumber;
  String _activeOrderStatus = '';
  int _apiSubtotal = 0;
  int _apiTax = 0;
  int _apiService = 0;
  int _apiTotal = 0;
  int _activeSeat = 1;
  Map<String, int?> _itemSeatById = {};

  bool get _isEditMode => widget.mode != OrdersMode.takeawayDraft;

  @override
  void initState() {
    super.initState();
    _connectivity.watchOnline().listen((o) {
      if (!mounted) return;
      setState(() => _online = o);
      if (o) {
        _menuSync.syncIfPossible().then((ok) {
          if (ok && mounted) _reloadCatalog();
        });
      }
    });
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await _menuSync.syncIfPossible();
    final cats = await _repo.loadCategories();
    final draft = _isEditMode ? <CartLine>[] : await _repo.loadDraft();
    final pending = await _repo.countPendingOrders();
    final diag = await SyncOutboxRepository(_appDb).diagnostics();
    final syncAt = await _repo.getMenuMeta('last_menu_sync_at');
    if (!mounted) return;
    setState(() {
      _categories = cats;
      _categoryId = cats.isNotEmpty ? cats.first.id : null;
      _lines = draft;
      _pendingOutbox = pending;
      _latestSyncError = diag.latestError;
      _menuSyncedAt = syncAt;
      _loading = false;
    });
    if (_isEditMode && widget.orderId != null && widget.orderId!.isNotEmpty) {
      await _loadExistingOrder(widget.orderId!);
    }
    await _reloadItems();
  }

  void _applyApiSnapshot(PosOrderSnapshot snap) {
    _activeOrderId = snap.id;
    _activeOrderNumber = snap.orderNumber;
    _activeOrderStatus = snap.status;
    _apiSubtotal = snap.subtotal;
    _apiTax = snap.tax;
    _apiService = snap.service;
    _apiTotal = snap.total;
    _itemSeatById = {for (final it in snap.items) it.id: it.seatNo};
    _lines = snap.items
        .where((x) => x.status.toUpperCase() != 'VOIDED')
        .map(
          (x) => CartLine(
            lineId: x.id,
            itemId: x.id,
            name: x.name,
            unitPriceCents: x.qty <= 0 ? 0 : (x.lineTotal ~/ x.qty),
            qty: x.qty,
            modifiers: const [],
            notes: x.notes,
            seatNo: x.seatNo,
          ),
        )
        .toList();
  }

  int? _seatFromNotes(String notes) {
    final m = RegExp(r'seat\s*[:#-]?\s*(\d+)', caseSensitive: false).firstMatch(notes);
    if (m == null) return null;
    return int.tryParse(m.group(1) ?? '');
  }

  int? _seatForLine(CartLine line) {
    return _itemSeatById[line.lineId] ?? _seatFromNotes(line.notes);
  }

  Future<void> _loadExistingOrder(String orderId) async {
    final snap = await _orderService.getOrder(orderId);
    if (!mounted) return;
    setState(() {
      _applyApiSnapshot(snap);
    });
  }

  Future<void> _reloadCatalog() async {
    final cats = await _repo.loadCategories();
    final syncAt = await _repo.getMenuMeta('last_menu_sync_at');
    if (!mounted) return;
    setState(() {
      _categories = cats;
      _menuSyncedAt = syncAt;
      if (_categoryId != null && !cats.any((c) => c.id == _categoryId)) {
        _categoryId = cats.isNotEmpty ? cats.first.id : null;
      } else if (_categoryId == null && cats.isNotEmpty) {
        _categoryId = cats.first.id;
      }
    });
    await _reloadItems();
  }

  Future<void> _reloadItems() async {
    final items = await _repo.loadItemsForDisplay(
      categoryId: _categoryId,
      search: _searchCtrl.text,
    );
    if (!mounted) return;
    setState(() => _items = items);
  }

  Future<void> _refreshMenu() async {
    final ok = await _menuSync.syncIfPossible();
    if (!mounted) return;
    await _reloadCatalog();
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Menu refreshed from server')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Using offline menu. Connect and try again.'),
        ),
      );
    }
  }

  void _scheduleDraftSave() {
    if (_isEditMode) return;
    _draftDebounce?.cancel();
    _draftDebounce = Timer(const Duration(milliseconds: 350), () {
      _repo.saveDraft(_lines);
    });
  }

  String _lineId() =>
      'ln_${DateTime.now().microsecondsSinceEpoch}';

  Future<void> _onItemTap(MenuItem item) async {
    final variants = await _repo.loadVariants(item.id);
    var unit = item.priceCents;
    var displayName = item.name;
    String? variantId;
    String? variantName;
    if (variants.isNotEmpty) {
      if (variants.length == 1) {
        final v = variants.first;
        unit = v.priceCents;
        variantId = v.id;
        variantName = v.name;
        displayName = '${item.name} · ${v.name}';
      } else {
        final v = await showVariantPickerSheet(
          context: context,
          item: item,
          variants: variants,
        );
        if (!mounted) return;
        if (v == null) return;
        unit = v.priceCents;
        variantId = v.id;
        variantName = v.name;
        displayName = '${item.name} · ${v.name}';
      }
    }
    final mods = await _repo.loadModifiersForItem(item.id);
    var chosen = <LineModifier>[];
    if (mods.isNotEmpty) {
      final picked = await showModifiersSheet(
        context: context,
        item: MenuItem(
          id: item.id,
          categoryId: item.categoryId,
          name: displayName,
          priceCents: unit,
          description: item.description,
          barcode: item.barcode,
          imageUrl: item.imageUrl,
          isCombo: item.isCombo,
          displayOrder: item.displayOrder,
        ),
        modifiers: mods,
      );
      if (!mounted) return;
      if (picked == null) return;
      chosen = picked;
    }
    if (_isEditMode) {
      final orderId = _activeOrderId ?? widget.orderId;
      if (orderId == null || orderId.isEmpty) return;
      try {
        var snap = await _orderService.addItem(
          orderId: orderId,
          menuItemId: item.id,
          qty: 1,
          variantId: variantId,
          notes: 'Seat $_activeSeat',
          seatNo: _activeSeat,
        );
        if (chosen.isNotEmpty) {
          final fresh = snap.items.where((x) => x.status.toUpperCase() != 'VOIDED').toList();
          if (fresh.isNotEmpty) {
            final last = fresh.last;
            for (final m in chosen) {
              snap = await _orderService.addModifier(
                orderItemId: last.id,
                modifierOptionId: m.id,
              );
            }
          }
        }
        if (!mounted) return;
        setState(() => _applyApiSnapshot(snap));
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
      return;
    }
    setState(() {
      _lines.add(
        CartLine(
          lineId: _lineId(),
          itemId: item.id,
          name: displayName,
          unitPriceCents: unit,
          qty: 1,
          modifiers: chosen,
          variantId: variantId,
          variantName: variantName,
        ),
      );
    });
    _scheduleDraftSave();
  }

  Future<void> _openLineEditor(int index) async {
    if (_isEditMode) return;
    final line = _lines[index];
    final mods = await _repo.loadModifiersForItem(line.itemId);
    if (!mounted) return;
    await showLineEditorSheet(
      context: context,
      line: line,
      itemModifiers: mods,
      onSave: (updated) {
        setState(() => _lines[index] = updated);
        _scheduleDraftSave();
      },
      onDelete: () {
        setState(() {
          _lines.removeAt(index);
        });
        _scheduleDraftSave();
      },
    );
  }

  void _bumpQty(int index, int delta) {
    if (_isEditMode) {
      _bumpQtyRemote(index, delta);
      return;
    }
    final l = _lines[index];
    final next = l.qty + delta;
    if (next < 1) {
      setState(() => _lines.removeAt(index));
    } else {
      setState(() => l.qty = next);
    }
    _scheduleDraftSave();
  }

  Future<void> _bumpQtyRemote(int index, int delta) async {
    if (index < 0 || index >= _lines.length) return;
    final l = _lines[index];
    final next = l.qty + delta;
    try {
      final snap = next <= 0
          ? await _orderService.removeItem(l.lineId)
          : await _orderService.updateQty(orderItemId: l.lineId, qty: next);
      if (!mounted) return;
      setState(() => _applyApiSnapshot(snap));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  int get _subtotal => _isEditMode ? _apiSubtotal : _lines.fold<int>(0, (s, l) => s + l.lineSubtotalCents);
  int get _discountTotal =>
      _isEditMode
          ? (_apiSubtotal - (_apiTotal - _apiTax - _apiService)).clamp(0, _apiSubtotal).toInt()
          : _lines.fold<int>(0, (s, l) => s + l.discountCents);
  int get _total => _isEditMode ? _apiTotal : _lines.fold<int>(0, (s, l) => s + l.lineTotalCents);

  Future<void> _queueForSync() async {
    if (_isEditMode) return;
    if (_lines.isEmpty) return;
    final captured = List<CartLine>.from(_lines);
    final subtotal = _subtotal;
    final discount = _discountTotal;
    final total = _total;
    await _repo.queueOrderForSync(List<CartLine>.from(_lines));
    if (_online) {
      await OfflineSyncEngine(LocalStorage(), _appDb).runPush();
    }
    final pending = await _repo.countPendingOrders();
    final diag = await SyncOutboxRepository(_appDb).diagnostics();
    await _tryAutoPrintOrderAndKitchen(
      lines: captured,
      subtotalCents: subtotal,
      discountCents: discount,
      totalCents: total,
    );
    if (!mounted) return;
    setState(() {
      _lines.clear();
      _pendingOutbox = pending;
      _latestSyncError = diag.latestError;
    });
    await _repo.saveDraft([]);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _online && pending == 0
                ? 'Order synced to backend'
                : 'Order saved locally. ${_online ? 'Sync retry in progress.' : 'Offline — will sync later.'}',
          ),
        ),
      );
    }
  }

  Future<void> _sendKitchen() async {
    final orderId = _activeOrderId ?? widget.orderId;
    if (orderId == null || orderId.isEmpty) return;
    try {
      final snap = await _orderService.sendToKitchen(orderId);
      if (!mounted) return;
      setState(() => _applyApiSnapshot(snap));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sent new items to kitchen')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _goSettle() async {
    final orderId = _activeOrderId ?? widget.orderId;
    if (orderId == null || orderId.isEmpty) return;
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PaymentScreen(orderId: orderId)),
    );
    if (!mounted) return;
    await _loadExistingOrder(orderId);
  }

  Future<void> _moveItemDialog() async {
    if (!_isEditMode || _lines.isEmpty) return;
    String? itemId = _lines.first.lineId;
    final targetCtrl = TextEditingController();
    String? targetFromTable;
    List<DropdownMenuItem<String>> targetChoices = [];
    try {
      final layout = await _tablesLayout.loadLayoutPreferRemote();
      final opts = <DropdownMenuItem<String>>[];
      if (layout != null) {
        for (final sec in layout.sections) {
          for (final t in sec.tables) {
            if (t.activeOrderId == null) continue;
            if (t.activeOrderId == _activeOrderId) continue;
            final oid = t.activeOrderId!;
            opts.add(
              DropdownMenuItem<String>(
                value: oid,
                child: Text('${t.name} · ${t.activeOrderNumber ?? oid.substring(0, 8)}'),
              ),
            );
          }
        }
      }
      targetChoices = opts;
    } catch (_) {}
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Move item to another check'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: itemId,
                decoration: const InputDecoration(
                  labelText: 'Item',
                  border: OutlineInputBorder(),
                ),
                items: _lines
                    .map(
                      (l) => DropdownMenuItem<String>(
                        value: l.lineId,
                        child: Text('${l.name} x${l.qty}', overflow: TextOverflow.ellipsis),
                      ),
                    )
                    .toList(),
                onChanged: (v) => itemId = v,
              ),
              const SizedBox(height: 10),
              TextField(
                controller: targetCtrl,
                decoration: const InputDecoration(
                  labelText: 'Target order ID',
                  border: OutlineInputBorder(),
                ),
              ),
              if (targetChoices.isNotEmpty) ...[
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: targetFromTable,
                  decoration: const InputDecoration(
                    labelText: 'Or pick from tables',
                    border: OutlineInputBorder(),
                  ),
                  items: targetChoices,
                  onChanged: (v) {
                    targetFromTable = v;
                    if (v != null) targetCtrl.text = v;
                  },
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Move')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final targetId = targetCtrl.text.trim();
    if (itemId == null || itemId!.isEmpty || targetId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select item and target order ID')),
      );
      return;
    }
    try {
      final moved = await _orderService.moveItem(orderItemId: itemId!, targetOrderId: targetId);
      if (!mounted) return;
      final current = moved['source'];
      if (current != null) {
        setState(() => _applyApiSnapshot(current));
      } else {
        await _loadExistingOrder(_activeOrderId ?? widget.orderId ?? '');
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Item moved successfully')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _splitBySeatFlow() async {
    if (!_isEditMode) return;
    final orderId = _activeOrderId ?? widget.orderId;
    if (orderId == null || orderId.isEmpty) return;
    final grouped = <int, List<CartLine>>{};
    for (final l in _lines) {
      final seat = _seatForLine(l);
      if (seat == null) continue;
      grouped.putIfAbsent(seat, () => <CartLine>[]).add(l);
    }
    if (grouped.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No seat-tagged items. Add items with seat first.')),
      );
      return;
    }
    int? selectedSeat = grouped.keys.first;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Split by seat'),
        content: DropdownButtonFormField<int>(
          initialValue: selectedSeat,
          decoration: const InputDecoration(
            labelText: 'Seat',
            border: OutlineInputBorder(),
          ),
          items: (() {
            final keys = grouped.keys.toList()..sort();
            return keys
                .map((s) => DropdownMenuItem<int>(value: s, child: Text('Seat $s')))
                .toList();
          })(),
          onChanged: (v) => selectedSeat = v,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Split')),
        ],
      ),
    );
    if (ok != true || selectedSeat == null) return;
    final lines = grouped[selectedSeat] ?? const <CartLine>[];
    if (lines.isEmpty) return;
    try {
      await _orderService.splitOrderItems(
        orderId: orderId,
        orderItemIds: lines.map((x) => x.lineId).toList(),
      );
      if (!mounted) return;
      await _loadExistingOrder(orderId);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Seat $selectedSeat split into new check')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _syncNow() async {
    if (_syncBusy) return;
    setState(() => _syncBusy = true);
    await OfflineSyncEngine(LocalStorage(), _appDb).runPush();
    final pending = await _repo.countPendingOrders();
    final diag = await SyncOutboxRepository(_appDb).diagnostics();
    if (!mounted) return;
    setState(() {
      _pendingOutbox = pending;
      _latestSyncError = diag.latestError;
      _syncBusy = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          pending == 0 ? 'All queued orders synced' : '$pending order(s) still queued',
        ),
      ),
    );
  }

  Future<void> _tryAutoPrintOrderAndKitchen({
    required List<CartLine> lines,
    required int subtotalCents,
    required int discountCents,
    required int totalCents,
  }) async {
    final cfg = await _printer.loadConfig();
    if (!cfg.enabled) return;
    final orderId = 'LOCAL-${DateTime.now().millisecondsSinceEpoch}';
    if (cfg.autoPrintOrderReceipt) {
      await _printer.printOrderReceipt(
        orderId: orderId,
        lines: lines,
        subtotalCents: subtotalCents,
        discountCents: discountCents,
        totalCents: totalCents,
      );
    }
    if (cfg.autoPrintKitchenTicket) {
      final items = lines
          .map((l) => KdsItemLine(name: l.name, qty: l.qty.toDouble(), seatNo: _seatForLine(l)))
          .toList();
      await _printer.printKitchenTicket(
        ticketId: 'LOCAL-KITCHEN',
        orderId: orderId,
        stationName: 'Kitchen',
        items: items,
      );
    }
  }

  Future<void> _manualPrintOrder() async {
    if (_lines.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cart is empty')),
      );
      return;
    }
    final ok = await _printer.printOrderReceipt(
      orderId: 'MANUAL-${DateTime.now().millisecondsSinceEpoch}',
      lines: List<CartLine>.from(_lines),
      subtotalCents: _subtotal,
      discountCents: _discountTotal,
      totalCents: _total,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ok ? 'Order receipt printed' : 'Print failed')),
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
    _draftDebounce?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final w = MediaQuery.sizeOf(context).width;
    final wide = w >= 920;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _isEditMode
              ? 'Order ${_activeOrderNumber ?? (_activeOrderId?.substring(0, 8) ?? '')}'
              : 'New order',
        ),
        bottom: _isEditMode && _activeOrderStatus.isNotEmpty
            ? PreferredSize(
                preferredSize: const Size.fromHeight(22),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    'Status: $_activeOrderStatus',
                    style: Theme.of(context).textTheme.labelMedium,
                  ),
                ),
              )
            : null,
        actions: [
          if (_isEditMode)
            IconButton(
              tooltip: 'Move item',
              onPressed: _lines.isEmpty ? null : _moveItemDialog,
              icon: const Icon(Icons.swap_horiz),
            ),
          if (_isEditMode)
            PopupMenuButton<String>(
              icon: const Icon(Icons.event_seat),
              onSelected: (v) {
                if (v == 'split_by_seat') {
                  _splitBySeatFlow();
                  return;
                }
                final seat = int.tryParse(v);
                if (seat != null) {
                  setState(() => _activeSeat = seat);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Active seat: $seat')),
                  );
                }
              },
              itemBuilder: (ctx) => [
                const PopupMenuItem<String>(
                  value: 'split_by_seat',
                  child: Text('Split by seat'),
                ),
                const PopupMenuDivider(),
                ...List.generate(
                  8,
                  (i) => PopupMenuItem<String>(
                    value: '${i + 1}',
                    child: Text('Set active seat ${i + 1}'),
                  ),
                ),
              ],
            ),
          IconButton(
            tooltip: 'Print order receipt',
            onPressed: _manualPrintOrder,
            icon: const Icon(Icons.print_outlined),
          ),
          IconButton(
            tooltip: 'Reprint last',
            onPressed: _reprintLast,
            icon: const Icon(Icons.replay_outlined),
          ),
          IconButton(
            tooltip: 'Refresh menu',
            onPressed: _refreshMenu,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Sync queued orders now',
            onPressed: _syncBusy ? null : _syncNow,
            icon: _syncBusy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.cloud_upload),
          ),
          if (_pendingOutbox > 0)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Center(
                child: Badge(
                  label: Text('$_pendingOutbox'),
                  child: const Icon(Icons.cloud_upload_outlined),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                _online ? 'Online' : 'Offline',
                style: TextStyle(
                  color: _online ? Colors.greenAccent : Colors.orangeAccent,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.1),
              Theme.of(context).colorScheme.tertiaryContainer.withValues(alpha: 0.08),
              Theme.of(context).colorScheme.surface,
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: wide
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(width: 200, child: _categoryPane(context)),
                  const VerticalDivider(width: 1),
                  Expanded(flex: 5, child: _itemsPane(context)),
                  const VerticalDivider(width: 1),
                  SizedBox(width: 320, child: _cartPane(context)),
                ],
              )
            : Column(
                children: [
                  SizedBox(height: 56, child: _categoryStrip(context)),
                  const Divider(height: 1),
                  Expanded(child: _itemsPane(context)),
                  const Divider(height: 1),
                  SizedBox(height: 280, child: _cartPane(context)),
                ],
              ),
      ),
    );
  }

  Widget _categoryPane(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      child: ListView.builder(
        itemCount: _categories.length,
        itemBuilder: (ctx, i) {
          final c = _categories[i];
          final sel = c.id == _categoryId;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Material(
              color: sel
                  ? Theme.of(context).colorScheme.primaryContainer
                  : Theme.of(context).colorScheme.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () {
                  _searchCtrl.clear();
                  setState(() => _categoryId = c.id);
                  _reloadItems();
                },
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
                  child: Text(
                    c.name,
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

  Widget _categoryStrip(BuildContext context) {
    return ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      itemCount: _categories.length,
      separatorBuilder: (_, __) => const SizedBox(width: 8),
      itemBuilder: (ctx, i) {
        final c = _categories[i];
        final sel = c.id == _categoryId;
        return ChoiceChip(
          label: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            child: Text(
              c.name,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
          ),
          selected: sel,
          onSelected: (_) {
            _searchCtrl.clear();
            setState(() => _categoryId = c.id);
            _reloadItems();
          },
        );
      },
    );
  }

  Widget _itemsPane(BuildContext context) {
    final cross = MediaQuery.sizeOf(context).width >= 920
        ? 4
        : MediaQuery.sizeOf(context).width > 520
            ? 3
            : 2;
    final emptyHint = _searchCtrl.text.trim().isNotEmpty
        ? 'No items match your search.'
        : 'No items in this category. Refresh menu when online.';
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_menuSyncedAt != null && _menuSyncedAt!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Menu updated: ${_menuSyncedAt!.length <= 24 ? _menuSyncedAt! : _menuSyncedAt!.substring(0, 24)}',
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ),
            ),
          TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: 'Search menu…',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searchCtrl.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear',
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _searchCtrl.clear();
                        setState(() {});
                        _reloadItems();
                      },
                    ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              filled: true,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 18,
              ),
            ),
            onChanged: (_) {
              setState(() {});
              _reloadItems();
            },
          ),
          const SizedBox(height: 12),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refreshMenu,
              child: _items.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(
                          height: MediaQuery.sizeOf(context).height * 0.2,
                        ),
                        Center(child: Text(emptyHint)),
                      ],
                    )
                  : GridView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: cross,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childAspectRatio: 1.15,
                      ),
                      itemCount: _items.length,
                      itemBuilder: (ctx, i) {
                        final it = _items[i];
                        return _ItemTile(item: it, onTap: () => _onItemTap(it));
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _cartPane(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainerLow,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            margin: const EdgeInsets.fromLTRB(10, 10, 10, 6),
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              gradient: LinearGradient(
                colors: [
                  scheme.primaryContainer.withValues(alpha: 0.95),
                  scheme.tertiaryContainer.withValues(alpha: 0.9),
                ],
              ),
            ),
            child: Row(
              children: [
                Text(
                  'Cart',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: scheme.surface.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: Text(
                    '${_lines.length} ${_lines.length == 1 ? 'item' : 'items'}',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _lines.isEmpty
                ? Center(
                    child: Text(
                      'Tap items to add',
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                  )
                : ListView.builder(
                    itemCount: _lines.length,
                    itemBuilder: (ctx, i) => _CartLineTile(
                      line: _lines[i],
                      onTap: _isEditMode ? null : () => _openLineEditor(i),
                      onInc: () => _bumpQty(i, 1),
                      onDec: () => _bumpQty(i, -1),
                      showEdit: !_isEditMode,
                    ),
                  ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              children: [
                if (_pendingOutbox > 0)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      _latestSyncError == null
                          ? 'Pending sync: $_pendingOutbox order(s). Tap cloud-upload to retry now.'
                          : 'Pending sync: $_pendingOutbox order(s).\nLatest error: $_latestSyncError',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onErrorContainer,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                _totRow('Subtotal', _subtotal),
                _totRow('Discounts', _discountTotal, neg: true),
                if (_isEditMode) _totRow('Tax', _apiTax),
                if (_isEditMode) _totRow('Service', _apiService),
                const SizedBox(height: 6),
                _totRow('Total', _total, strong: true),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(54),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    onPressed: _isEditMode ? (_lines.isEmpty ? null : _sendKitchen) : (_syncBusy ? null : _syncNow),
                    icon: Icon(_isEditMode ? Icons.restaurant : Icons.cloud_upload),
                    label: Text(_isEditMode ? 'Send to kitchen' : 'Sync now'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(54),
                      backgroundColor: scheme.tertiary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    onPressed: _lines.isEmpty ? null : (_isEditMode ? _goSettle : _queueForSync),
                    icon: Icon(_isEditMode ? Icons.point_of_sale : Icons.save_alt),
                    label: Text(_isEditMode ? 'Settle' : 'Save order'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _totRow(String label, int cents, {bool strong = false, bool neg = false}) {
    final v = neg && cents > 0 ? '-${formatMoney(cents)}' : formatMoney(cents);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: strong ? 18 : 15,
              fontWeight: strong ? FontWeight.w800 : FontWeight.w500,
            ),
          ),
          const Spacer(),
          Text(
            v,
            style: TextStyle(
              fontSize: strong ? 20 : 15,
              fontWeight: strong ? FontWeight.w900 : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemTile extends StatelessWidget {
  const _ItemTile({required this.item, required this.onTap});

  final MenuItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerHigh,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  item.name,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    height: 1.2,
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                formatMoney(item.priceCents),
                style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w800,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CartLineTile extends StatelessWidget {
  const _CartLineTile({
    required this.line,
    required this.onTap,
    required this.onInc,
    required this.onDec,
    this.showEdit = true,
  });

  final CartLine line;
  final VoidCallback? onTap;
  final VoidCallback onInc;
  final VoidCallback onDec;
  final bool showEdit;

  @override
  Widget build(BuildContext context) {
    final modHint = line.modifiers.isEmpty
        ? ''
        : ' · ${line.modifiers.map((m) => m.name).join(', ')}';
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          line.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                          ),
                        ),
                        if (modHint.isNotEmpty)
                          Text(
                            modHint,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                          ),
                        if (line.notes.isNotEmpty)
                          Text(
                            'Note: ${line.notes}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              color: Theme.of(context).colorScheme.secondary,
                            ),
                          ),
                      ],
                    ),
                  ),
                  Text(
                    formatMoney(line.lineTotalCents),
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _QtyButton(icon: Icons.remove, onPressed: onDec),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(
                      '${line.qty}',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  _QtyButton(icon: Icons.add, onPressed: onInc),
                  const Spacer(),
                  if (showEdit)
                    TextButton(
                      onPressed: onTap,
                      child: const Text('Edit'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QtyButton extends StatelessWidget {
  const _QtyButton({required this.icon, required this.onPressed});

  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.primaryContainer,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: 48,
          height: 48,
          child: Icon(icon, size: 24),
        ),
      ),
    );
  }
}
