import 'package:flutter/material.dart';

/// Touch-friendly keypad for device codes and hex PIN/secrets (0–9, A–F, backspace).
class NumericKeypad extends StatelessWidget {
  const NumericKeypad({
    super.key,
    required this.onKey,
    required this.onBackspace,
    this.dense = false,
  });

  final void Function(String ch) onKey;
  final VoidCallback onBackspace;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final pad = Theme.of(context).colorScheme.surfaceContainerHighest;
    final height = dense ? 52.0 : 60.0;

    Widget keyCell(String label, {VoidCallback? onTap, bool danger = false}) {
      final bg = danger
          ? Theme.of(context).colorScheme.errorContainer
          : pad;
      return Material(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            height: height,
            child: Center(
              child: danger
                  ? Icon(
                      Icons.backspace_outlined,
                      color: Theme.of(context).colorScheme.onErrorContainer,
                    )
                  : Text(
                      label,
                      style: TextStyle(
                        fontSize: dense ? 20 : 24,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ),
      );
    }

    final digits = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['0', 'A', 'B'],
      ['C', 'D', 'E'],
    ];

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final row in digits)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                for (final n in row)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: keyCell(
                        n,
                        onTap: () =>
                            onKey(n == '0' ? '0' : n.toLowerCase()),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: keyCell('F', onTap: () => onKey('f')),
                ),
              ),
              Expanded(
                flex: 2,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: keyCell('', onTap: onBackspace, danger: true),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
