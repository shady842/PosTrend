import 'dart:async';

import 'package:flutter/material.dart';

import '../screens/payment_screen.dart';

/// Opens the “order id → payment” flow from any context (home button, voice, etc.).
class PaymentByOrderIdSheet {
  PaymentByOrderIdSheet._();

  static Future<void> show(BuildContext context) async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Take payment'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            labelText: 'Order ID',
            hintText: 'Paste server order UUID',
            border: OutlineInputBorder(),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Open'),
          ),
        ],
      ),
    );
    ctrl.dispose();
    if (!context.mounted || ok != true) return;
    final id = ctrl.text.trim();
    if (id.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter an order ID')),
      );
      return;
    }
    unawaited(
      Navigator.push<void>(
        context,
        MaterialPageRoute<void>(
          builder: (_) => PaymentScreen(orderId: id),
        ),
      ),
    );
  }
}
