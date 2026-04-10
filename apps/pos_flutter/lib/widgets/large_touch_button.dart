import 'package:flutter/material.dart';

class LargeTouchButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final IconData? icon;
  final Color? color;

  const LargeTouchButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    return SizedBox(
      height: 76,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            colors: [c.withValues(alpha: 0.92), c.withValues(alpha: 0.72)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          boxShadow: [
            BoxShadow(
              color: c.withValues(alpha: 0.28),
              blurRadius: 12,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.transparent,
            shadowColor: Colors.transparent,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          onPressed: onPressed,
          icon: Icon(icon ?? Icons.touch_app),
          label: Text(label),
        ),
      ),
    );
  }
}
