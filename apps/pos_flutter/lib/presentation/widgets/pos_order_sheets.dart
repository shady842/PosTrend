import 'package:flutter/material.dart';

import '../../domain/entities/cart_line.dart';
import '../../domain/entities/pos_menu.dart';

String formatMoney(int cents) => '\$${(cents / 100).toStringAsFixed(2)}';

/// Multi-select modifiers; returns `null` if user dismisses without confirm.
Future<List<LineModifier>?> showModifiersSheet({
  required BuildContext context,
  required MenuItem item,
  required List<MenuModifier> modifiers,
  List<LineModifier> initial = const [],
}) {
  if (modifiers.isEmpty) {
    return Future.value(<LineModifier>[]);
  }
  final initialIds = initial.map((m) => m.id).toSet();

  return showModalBottomSheet<List<LineModifier>>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      return _ModifiersBody(
        item: item,
        modifiers: modifiers,
        initialIds: initialIds,
      );
    },
  );
}

class _ModifiersBody extends StatefulWidget {
  const _ModifiersBody({
    required this.item,
    required this.modifiers,
    required this.initialIds,
  });

  final MenuItem item;
  final List<MenuModifier> modifiers;
  final Set<String> initialIds;

  @override
  State<_ModifiersBody> createState() => _ModifiersBodyState();
}

class _ModifiersBodyState extends State<_ModifiersBody> {
  late Set<String> _sel;

  @override
  void initState() {
    super.initState();
    _sel = Set.from(widget.initialIds);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom + 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.item.name,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                ),
                Text(
                  formatMoney(widget.item.priceCents),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          SizedBox(
            height: (MediaQuery.sizeOf(context).height * 0.42).clamp(220.0, 420.0),
            child: ListView.builder(
              itemCount: widget.modifiers.length,
              itemBuilder: (ctx, i) {
                final m = widget.modifiers[i];
                final on = _sel.contains(m.id);
                return CheckboxListTile(
                  value: on,
                  onChanged: (v) {
                    setState(() {
                      if (v == true) {
                        _sel.add(m.id);
                      } else {
                        _sel.remove(m.id);
                      }
                    });
                  },
                  dense: true,
                  title: Text(
                    m.name,
                    style: const TextStyle(fontSize: 17),
                  ),
                  subtitle: m.priceDeltaCents != 0
                      ? Text('+${formatMoney(m.priceDeltaCents)}')
                      : null,
                  controlAffinity: ListTileControlAffinity.platform,
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    onPressed: () {
                      final out = widget.modifiers
                          .where((m) => _sel.contains(m.id))
                          .map(
                            (m) => LineModifier(
                              id: m.id,
                              name: m.name,
                              priceDeltaCents: m.priceDeltaCents,
                            ),
                          )
                          .toList();
                      Navigator.pop(context, out);
                    },
                    child: const Text('Done'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> showLineEditorSheet({
  required BuildContext context,
  required CartLine line,
  required List<MenuModifier> itemModifiers,
  required void Function(CartLine updated) onSave,
  required VoidCallback onDelete,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      return _LineEditorContent(
        line: line,
        itemModifiers: itemModifiers,
        onSave: onSave,
        onDelete: onDelete,
      );
    },
  );
}

class _LineEditorContent extends StatefulWidget {
  const _LineEditorContent({
    required this.line,
    required this.itemModifiers,
    required this.onSave,
    required this.onDelete,
  });

  final CartLine line;
  final List<MenuModifier> itemModifiers;
  final void Function(CartLine updated) onSave;
  final VoidCallback onDelete;

  @override
  State<_LineEditorContent> createState() => _LineEditorContentState();
}

class _LineEditorContentState extends State<_LineEditorContent> {
  late final TextEditingController _notes;
  late final TextEditingController _discount;
  late CartLine _line;
  bool _discountIsPercent = true;

  @override
  void initState() {
    super.initState();
    _line = widget.line.copyWith(
      modifiers: List.from(widget.line.modifiers),
    );
    _notes = TextEditingController(text: _line.notes);
    _discount = TextEditingController();
    if (_line.discountCents > 0 && _line.lineSubtotalCents > 0) {
      final pct =
          (_line.discountCents / _line.lineSubtotalCents * 100).clamp(0, 100);
      _discount.text = pct.toStringAsFixed(pct == pct.roundToDouble() ? 0 : 1);
    }
  }

  @override
  void dispose() {
    _notes.dispose();
    _discount.dispose();
    super.dispose();
  }

  int _parseDiscountCents() {
    final raw = _discount.text.trim();
    if (raw.isEmpty) return 0;
    final v = double.tryParse(raw);
    if (v == null || v <= 0) return 0;
    final sub = _line.lineSubtotalCents;
    if (sub <= 0) return 0;
    if (_discountIsPercent) {
      return (sub * (v / 100)).round().clamp(0, sub);
    }
    return (v * 100).round().clamp(0, sub);
  }

  Future<void> _openModifiers() async {
    final picked = await showModifiersSheet(
      context: context,
      item: MenuItem(
        id: _line.itemId,
        categoryId: '',
        name: _line.name,
        priceCents: _line.unitPriceCents,
      ),
      modifiers: widget.itemModifiers,
      initial: _line.modifiers,
    );
    if (picked == null) return;
    setState(() => _line.modifiers = picked);
  }

  void _apply() {
    _line.notes = _notes.text.trim();
    _line.discountCents = _parseDiscountCents();
    widget.onSave(_line);
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final pad = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom + pad + 12),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Text(
                _line.name,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _notes,
                decoration: const InputDecoration(
                  labelText: 'Notes',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
                minLines: 2,
                maxLines: 4,
                textCapitalization: TextCapitalization.sentences,
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(
                    child: SegmentedButton<bool>(
                      segments: const [
                        ButtonSegment(value: true, label: Text('% off')),
                        ButtonSegment(value: false, label: Text('\$ off')),
                      ],
                      selected: {_discountIsPercent},
                      onSelectionChanged: (s) {
                        setState(() {
                          _discountIsPercent = s.first;
                          _discount.clear();
                        });
                      },
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _discount,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: _discountIsPercent ? 'Percent' : 'Amount',
                  border: const OutlineInputBorder(),
                  prefixText: _discountIsPercent ? null : '\$ ',
                  suffixText: _discountIsPercent ? '%' : null,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Text(
                    'Line: ${formatMoney(_line.lineSubtotalCents)} → '
                    '${formatMoney(_line.lineSubtotalCents - _parseDiscountCents())}',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ],
              ),
            ),
            if (widget.itemModifiers.isNotEmpty) ...[
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  onPressed: _openModifiers,
                  icon: const Icon(Icons.tune),
                  label: const Text('Modifiers'),
                ),
              ),
            ],
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  widget.onDelete();
                },
                icon: Icon(
                  Icons.delete_outline,
                  color: Theme.of(context).colorScheme.error,
                ),
                label: Text(
                  'Remove item',
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: FilledButton(
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: _apply,
                child: const Text('Apply'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<MenuVariant?> showVariantPickerSheet({
  required BuildContext context,
  required MenuItem item,
  required List<MenuVariant> variants,
}) {
  final bottom = MediaQuery.paddingOf(context).bottom;
  return showModalBottomSheet<MenuVariant>(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      return SafeArea(
        child: Padding(
          padding: EdgeInsets.only(bottom: bottom + 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Text(
                  item.name,
                  style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ),
              const Divider(height: 1),
              SizedBox(
                height: (MediaQuery.sizeOf(ctx).height * 0.38).clamp(200.0, 360.0),
                child: ListView.builder(
                  itemCount: variants.length,
                  itemBuilder: (_, i) {
                    final v = variants[i];
                    return ListTile(
                      leading: v.isDefault
                          ? const Icon(Icons.star_outline)
                          : const SizedBox(width: 24),
                      title: Text(v.name, style: const TextStyle(fontSize: 18)),
                      trailing: Text(
                        formatMoney(v.priceCents),
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                      onTap: () => Navigator.pop(ctx, v),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
