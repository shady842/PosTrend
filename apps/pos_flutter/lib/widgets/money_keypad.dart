import 'package:flutter/material.dart';

/// Large 0–9 + decimal touch keypad for currency entry.
class MoneyKeypad extends StatelessWidget {
  const MoneyKeypad({
    super.key,
    required this.onDigit,
    required this.onDecimal,
    required this.onBackspace,
    this.keyHeight = 64,
  });

  final void Function(String digit) onDigit;
  final VoidCallback onDecimal;
  final VoidCallback onBackspace;
  final double keyHeight;

  @override
  Widget build(BuildContext context) {
    final pad = Theme.of(context).colorScheme.surfaceContainerHighest;

    Widget keyCell({
      required Widget child,
      VoidCallback? onTap,
      bool danger = false,
      int flex = 1,
    }) {
      final bg = danger
          ? Theme.of(context).colorScheme.errorContainer
          : pad;
      return Expanded(
        flex: flex,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          child: Material(
            color: bg,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                height: keyHeight,
                child: Center(child: child),
              ),
            ),
          ),
        ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            for (final d in ['7', '8', '9'])
              keyCell(
                child: Text(
                  d,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                onTap: () => onDigit(d),
              ),
          ],
        ),
        Row(
          children: [
            for (final d in ['4', '5', '6'])
              keyCell(
                child: Text(
                  d,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                onTap: () => onDigit(d),
              ),
          ],
        ),
        Row(
          children: [
            for (final d in ['1', '2', '3'])
              keyCell(
                child: Text(
                  d,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                onTap: () => onDigit(d),
              ),
          ],
        ),
        Row(
          children: [
            keyCell(
              child: const Text(
                '.',
                style: TextStyle(fontSize: 32, fontWeight: FontWeight.w700),
              ),
              onTap: onDecimal,
            ),
            keyCell(
              child: const Text(
                '0',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
              ),
              onTap: () => onDigit('0'),
            ),
            keyCell(
              child: Icon(
                Icons.backspace_outlined,
                size: 28,
                color: Theme.of(context).colorScheme.onErrorContainer,
              ),
              onTap: onBackspace,
              danger: true,
              flex: 1,
            ),
          ],
        ),
      ],
    );
  }
}
