import 'package:flutter/material.dart';

import '../../core/storage/local_storage.dart';
import '../../services/delivery_service.dart';
import 'payment_screen.dart';

class DeliveryScreen extends StatefulWidget {
  const DeliveryScreen({super.key});

  @override
  State<DeliveryScreen> createState() => _DeliveryScreenState();
}

class _DeliveryScreenState extends State<DeliveryScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _instructions = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final _service = DeliveryService(LocalStorage());

  bool _busy = false;

  Future<void> _create() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final customerId = await _service.createCustomer(
        fullName: _name.text,
        phone: _phone.text,
        address: _address.text,
      );
      final order = await _service.openDelivery(
        customerId: customerId,
        contactName: _name.text,
        phone: _phone.text,
        address: _address.text,
        instructions: _instructions.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Delivery order opened (${order.orderNumber})')),
      );
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => PaymentScreen(orderId: order.orderId)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _instructions.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Delivery order')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _name,
                    decoration: const InputDecoration(
                      labelText: 'Customer name',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'Customer name is required'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Phone',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'Phone is required'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _address,
                    minLines: 2,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Delivery address',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'Address is required'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _instructions,
                    minLines: 2,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Instructions (optional)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 14),
                  FilledButton.icon(
                    onPressed: _busy ? null : _create,
                    icon: const Icon(Icons.delivery_dining),
                    label: Text(_busy ? 'Creating...' : 'Create delivery order'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
