import 'package:flutter/material.dart';

import '../../../services/printing/printer_service.dart';
import '../../../core/storage/local_storage.dart';

class PrinterSettingsScreen extends StatefulWidget {
  const PrinterSettingsScreen({super.key});

  @override
  State<PrinterSettingsScreen> createState() => _PrinterSettingsScreenState();
}

class _PrinterSettingsScreenState extends State<PrinterSettingsScreen> {
  final _service = PrinterService(LocalStorage());

  bool _loading = true;
  bool _saving = false;

  bool _enabled = false;
  PrinterConnectionType _type = PrinterConnectionType.lan;
  final _addressCtrl = TextEditingController();
  final _portCtrl = TextEditingController(text: '9100');
  int _paperMm = 80;
  bool _autoOrder = false;
  bool _autoKitchen = false;
  bool _autoPayment = false;
  final _logoCtrl = TextEditingController(text: 'PosTrend');
  final _taxLabelCtrl = TextEditingController(text: 'Tax');
  final _qrCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final c = await _service.loadConfig();
    if (!mounted) return;
    setState(() {
      _enabled = c.enabled;
      _type = c.connectionType;
      _addressCtrl.text = c.printerAddress;
      _portCtrl.text = c.printerPort.toString();
      _paperMm = c.paperSizeMm;
      _autoOrder = c.autoPrintOrderReceipt;
      _autoKitchen = c.autoPrintKitchenTicket;
      _autoPayment = c.autoPrintPaymentReceipt;
      _logoCtrl.text = c.logoText;
      _taxLabelCtrl.text = c.taxLabel;
      _qrCtrl.text = c.qrData;
      _loading = false;
    });
  }

  PrinterConfig _cfg() {
    return PrinterConfig(
      enabled: _enabled,
      connectionType: _type,
      printerAddress: _addressCtrl.text.trim(),
      printerPort: int.tryParse(_portCtrl.text.trim()) ?? 9100,
      paperSizeMm: _paperMm,
      autoPrintOrderReceipt: _autoOrder,
      autoPrintKitchenTicket: _autoKitchen,
      autoPrintPaymentReceipt: _autoPayment,
      logoText: _logoCtrl.text.trim(),
      taxLabel: _taxLabelCtrl.text.trim().isEmpty ? 'Tax' : _taxLabelCtrl.text.trim(),
      qrData: _qrCtrl.text.trim(),
    );
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    await _service.saveConfig(_cfg());
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Printer settings saved')),
    );
  }

  Future<void> _testPrint() async {
    setState(() => _saving = true);
    await _service.saveConfig(_cfg());
    final ok = await _service.testPrint();
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ok ? 'Test print sent' : 'Test print failed')),
    );
  }

  @override
  void dispose() {
    _addressCtrl.dispose();
    _portCtrl.dispose();
    _logoCtrl.dispose();
    _taxLabelCtrl.dispose();
    _qrCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Printer settings'),
        actions: [
          IconButton(
            onPressed: _saving ? null : _save,
            icon: const Icon(Icons.save),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SwitchListTile(
            title: const Text('Enable printing'),
            value: _enabled,
            onChanged: (v) => setState(() => _enabled = v),
          ),
          const SizedBox(height: 8),
          SegmentedButton<PrinterConnectionType>(
            segments: const [
              ButtonSegment(value: PrinterConnectionType.lan, label: Text('LAN')),
              ButtonSegment(value: PrinterConnectionType.bluetooth, label: Text('Bluetooth')),
            ],
            selected: {_type},
            onSelectionChanged: (s) {
              if (s.isEmpty) return;
              setState(() => _type = s.first);
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _addressCtrl,
            decoration: InputDecoration(
              labelText: _type == PrinterConnectionType.lan ? 'Printer IP / Host' : 'Bluetooth MAC address',
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _portCtrl,
            keyboardType: TextInputType.number,
            enabled: _type == PrinterConnectionType.lan,
            decoration: const InputDecoration(
              labelText: 'LAN port',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          SegmentedButton<int>(
            segments: const [
              ButtonSegment(value: 58, label: Text('58mm')),
              ButtonSegment(value: 80, label: Text('80mm')),
            ],
            selected: {_paperMm},
            onSelectionChanged: (s) {
              if (s.isEmpty) return;
              setState(() => _paperMm = s.first);
            },
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _logoCtrl,
            decoration: const InputDecoration(
              labelText: 'Logo / Header text',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _taxLabelCtrl,
            decoration: const InputDecoration(
              labelText: 'Tax label',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _qrCtrl,
            decoration: const InputDecoration(
              labelText: 'QR data (optional)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 18),
          const Text('Auto print', style: TextStyle(fontWeight: FontWeight.w700)),
          CheckboxListTile(
            value: _autoOrder,
            onChanged: (v) => setState(() => _autoOrder = v ?? false),
            title: const Text('Order receipt'),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          CheckboxListTile(
            value: _autoKitchen,
            onChanged: (v) => setState(() => _autoKitchen = v ?? false),
            title: const Text('Kitchen ticket'),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          CheckboxListTile(
            value: _autoPayment,
            onChanged: (v) => setState(() => _autoPayment = v ?? false),
            title: const Text('Payment receipt'),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: _saving ? null : _testPrint,
                  icon: const Icon(Icons.print),
                  label: const Text('Test print'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: const Icon(Icons.save),
                  label: const Text('Save'),
                ),
              ),
            ],
          ),
          if (_saving) const Padding(
            padding: EdgeInsets.only(top: 12),
            child: LinearProgressIndicator(),
          ),
        ],
      ),
    );
  }
}
