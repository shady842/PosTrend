import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/network/connectivity_service.dart';
import '../../core/storage/local_storage.dart';
import '../../data/local/app_database.dart';
import '../../data/local/pos_local_repository.dart';
import '../../domain/entities/cart_line.dart';
import '../../domain/entities/pos_menu.dart';
import '../../services/kds_service.dart';
import '../../services/menu_sync_service.dart';
import '../../services/offline_sync_engine.dart';
import '../../services/printing/printer_service.dart';
import '../widgets/pos_order_sheets.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  final _appDb = AppDatabase();
  final _printer = PrinterService(LocalStorage());
  late final PosLocalRepository _repo = PosLocalRepository(_appDb);
  late final MenuSyncService _menuSync = MenuSyncService(LocalStorage(), _appDb);
  final _connectivity = ConnectivityService();
  final _searchCtrl = TextEditingController();

  List<MenuCategory> _categories = [];
  String? _categoryId;
  List<MenuItem> _items = [];
  List<CartLine> _lines = [];
  bool _loading = true;
  bool _online = true;
  int _pendingOutbox = 0;
  String? _menuSyncedAt;
  Timer? _draftDebounce;

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
    final draft = await _repo.loadDraft();
    final pending = await _repo.countPendingOrders();
    final syncAt = await _repo.getMenuMeta('last_menu_sync_at');
    if (!mounted) return;
    setState(() {
      _categories = cats;
      _categoryId = cats.isNotEmpty ? cats.first.id : null;
      _lines = draft;
      _pendingOutbox = pending;
      _menuSyncedAt = syncAt;
      _loading = false;
    });
    await _reloadItems();
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
    final l = _lines[index];
    final next = l.qty + delta;
    if (next < 1) {
      setState(() => _lines.removeAt(index));
    } else {
      setState(() => l.qty = next);
    }
    _scheduleDraftSave();
  }

  int get _subtotal =>
      _lines.fold<int>(0, (s, l) => s + l.lineSubtotalCents);
  int get _discountTotal =>
      _lines.fold<int>(0, (s, l) => s + l.discountCents);
  int get _total =>
      _lines.fold<int>(0, (s, l) => s + l.lineTotalCents);

  Future<void> _queueForSync() async {
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
          .map((l) => KdsItemLine(name: l.name, qty: l.qty.toDouble()))
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
        title: const Text('New order'),
        actions: [
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
      body: wide
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
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                Text(
                  'Cart',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const Spacer(),
                Text(
                  '${_lines.length} ${_lines.length == 1 ? 'item' : 'items'}',
                  style: Theme.of(context).textTheme.titleMedium,
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
                      onTap: () => _openLineEditor(i),
                      onInc: () => _bumpQty(i, 1),
                      onDec: () => _bumpQty(i, -1),
                    ),
                  ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              children: [
                _totRow('Subtotal', _subtotal),
                _totRow('Discounts', _discountTotal, neg: true),
                const SizedBox(height: 6),
                _totRow('Total', _total, strong: true),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              onPressed: _lines.isEmpty ? null : _queueForSync,
              icon: const Icon(Icons.save_alt),
              label: const Text('Save order (sync later)'),
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
  });

  final CartLine line;
  final VoidCallback onTap;
  final VoidCallback onInc;
  final VoidCallback onDec;

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
