import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/config/api_config.dart';
import '../../core/storage/local_storage.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../widgets/large_touch_button.dart';
import '../../widgets/numeric_keypad.dart';
import 'cashier_login_screen.dart';

class DeviceLoginScreen extends StatefulWidget {
  const DeviceLoginScreen({super.key});

  @override
  State<DeviceLoginScreen> createState() => _DeviceLoginScreenState();
}

class _DeviceLoginScreenState extends State<DeviceLoginScreen> {
  final _apiBaseUrl = TextEditingController();
  final _deviceCode = TextEditingController();
  final _deviceName = TextEditingController();
  final _secret = TextEditingController();

  final _apiBaseFocus = FocusNode();
  final _codeFocus = FocusNode();
  final _nameFocus = FocusNode();
  final _secretFocus = FocusNode();

  bool _loading = false;
  bool _remember = true;
  bool _obscureSecret = true;

  @override
  void initState() {
    super.initState();
    _apiBaseUrl.text = ApiConfig.baseUrl;
    _loadPrefill();
    _apiBaseFocus.addListener(_onFocus);
    _codeFocus.addListener(_onFocus);
    _nameFocus.addListener(_onFocus);
    _secretFocus.addListener(_onFocus);
  }

  void _onFocus() {
    setState(() {});
  }

  Future<void> _loadPrefill() async {
    final s = LocalStorage();
    final remember = await s.getRememberDevice();
    final code = await s.getDeviceCode();
    final name = await s.getDeviceDisplayName();
    final savedApi = await s.getApiBaseUrl();
    if (!mounted) return;
    setState(() {
      _remember = remember;
      if (savedApi != null && savedApi.isNotEmpty) {
        ApiConfig.setRuntimeBaseUrl(savedApi);
        _apiBaseUrl.text = ApiConfig.baseUrl;
      }
      if (code != null && code.isNotEmpty) {
        _deviceCode.text = code;
      }
      if (name != null && name.isNotEmpty) {
        _deviceName.text = name;
      }
    });
  }

  Future<void> _saveApiBaseUrl() async {
    final raw = _apiBaseUrl.text.trim();
    if (raw.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter your API URL (e.g. http://192.168.1.10:3000)')),
        );
      }
      return;
    }
    ApiConfig.setRuntimeBaseUrl(raw);
    await LocalStorage().saveApiBaseUrl(ApiConfig.baseUrl);
    _apiBaseUrl.text = ApiConfig.baseUrl;
    if (!mounted) return;
    setState(() {});
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Saved API: ${ApiConfig.baseUrl}')),
    );
  }

  Future<void> _resetApiBaseUrl() async {
    await LocalStorage().clearApiBaseUrl();
    ApiConfig.setRuntimeBaseUrl(null);
    _apiBaseUrl.text = ApiConfig.baseUrl;
    if (!mounted) return;
    setState(() {});
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Reset to build default: ${ApiConfig.baseUrl}')),
    );
  }

  bool get _keypadTargetsSecret =>
      !_apiBaseFocus.hasFocus &&
      (_secretFocus.hasFocus ||
          (!_codeFocus.hasFocus && !_nameFocus.hasFocus));

  void _appendKey(String ch) {
    if (_apiBaseFocus.hasFocus || _nameFocus.hasFocus) return;
    if (_codeFocus.hasFocus) {
      _deviceCode.text = _deviceCode.text + ch;
      _deviceCode.selection = TextSelection.collapsed(
        offset: _deviceCode.text.length,
      );
      return;
    }
    _secret.text = _secret.text + ch;
    _secret.selection = TextSelection.collapsed(offset: _secret.text.length);
  }

  void _backspace() {
    if (_apiBaseFocus.hasFocus || _nameFocus.hasFocus) return;
    if (_codeFocus.hasFocus) {
      final t = _deviceCode.text;
      if (t.isEmpty) return;
      _deviceCode.text = t.substring(0, t.length - 1);
      _deviceCode.selection = TextSelection.collapsed(
        offset: _deviceCode.text.length,
      );
      return;
    }
    final t = _secret.text;
    if (t.isEmpty) return;
    _secret.text = t.substring(0, t.length - 1);
    _secret.selection = TextSelection.collapsed(offset: _secret.text.length);
  }

  InputDecoration _bigDeco(BuildContext context, String label, {String? hint}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
      labelStyle: const TextStyle(fontSize: 16),
    );
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _loading = true);
    try {
      final repo = AuthRepositoryImpl(LocalStorage());
      await repo.deviceLogin(
        deviceCode: _deviceCode.text.trim(),
        deviceName: _deviceName.text.trim(),
        deviceSecret: _secret.text.trim(),
        rememberDevice: _remember,
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const CashierLoginScreen()),
      );
    } catch (e, st) {
      debugPrint('$e\n$st');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            duration: const Duration(seconds: 10),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _apiBaseFocus.removeListener(_onFocus);
    _codeFocus.removeListener(_onFocus);
    _nameFocus.removeListener(_onFocus);
    _secretFocus.removeListener(_onFocus);
    _apiBaseUrl.dispose();
    _deviceCode.dispose();
    _deviceName.dispose();
    _secret.dispose();
    _apiBaseFocus.dispose();
    _codeFocus.dispose();
    _nameFocus.dispose();
    _secretFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.sizeOf(context).width >= 720;

    Widget fields = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'API server',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _apiBaseUrl,
          focusNode: _apiBaseFocus,
          keyboardType: TextInputType.url,
          autocorrect: false,
          style: const TextStyle(fontSize: 18),
          decoration: _bigDeco(
            context,
            'API base URL',
            hint: 'http://192.168.1.10:3000',
          ).copyWith(
            helperText: 'No /v1 — same URL that works for …/v1/health in the browser',
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _loading ? null : _saveApiBaseUrl,
                child: const Text('Save URL'),
              ),
            ),
            const SizedBox(width: 10),
            TextButton(
              onPressed: _loading ? null : _resetApiBaseUrl,
              child: const Text('Use default'),
            ),
          ],
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _deviceCode,
          focusNode: _codeFocus,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w500),
          textCapitalization: TextCapitalization.characters,
          decoration: _bigDeco(
            context,
            'Device code',
            hint: 'e.g. POS-AB12CD',
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _deviceName,
          focusNode: _nameFocus,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w500),
          textCapitalization: TextCapitalization.words,
          decoration: _bigDeco(
            context,
            'Device name',
            hint: 'Shown on receipts & admin',
          ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _secret,
          focusNode: _secretFocus,
          obscureText: _obscureSecret,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w500),
          decoration: _bigDeco(
            context,
            'Pairing secret',
            hint: 'One-time key from registration',
          ).copyWith(
            suffixIcon: IconButton(
              tooltip: _obscureSecret ? 'Show' : 'Hide',
              onPressed: () => setState(() => _obscureSecret = !_obscureSecret),
              icon: Icon(_obscureSecret ? Icons.visibility : Icons.visibility_off),
            ),
          ),
        ),
        const SizedBox(height: 8),
        SwitchListTile.adaptive(
          contentPadding: EdgeInsets.zero,
          title: const Text(
            'Remember device',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
          ),
          subtitle: const Text(
            'Skip login when possible; prefill this code next time.',
            style: TextStyle(fontSize: 14),
          ),
          value: _remember,
          onChanged: (v) => setState(() => _remember = v),
        ),
        const SizedBox(height: 8),
        LargeTouchButton(
          label: _loading ? 'Signing in...' : 'Connect device',
          icon: Icons.login,
          onPressed: _loading ? () {} : _submit,
        ),
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Text(
            'API: ${ApiConfig.baseUrl}',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.outline,
                ),
          ),
        ),
      ],
    );

    final keypadHint = Text(
      _apiBaseFocus.hasFocus
          ? 'Use the keyboard for the API URL. Tap device code or secret for the keypad.'
          : _keypadTargetsSecret
              ? 'Keypad adds to pairing secret (0–9, A–F). Tap device code to edit code.'
              : 'Keypad adds to device code. Tap secret field for pairing key.',
      style: Theme.of(context).textTheme.bodySmall,
    );

    final keypad = NumericKeypad(
      onKey: _appendKey,
      onBackspace: _backspace,
      dense: !isWide,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Device login'),
        actions: [
          IconButton(
            tooltip: 'Paste pairing secret',
            onPressed: _loading
                ? null
                : () async {
                    final data = await Clipboard.getData('text/plain');
                    final t = data?.text?.trim() ?? '';
                    if (!mounted) return;
                    if (t.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Clipboard empty')),
                      );
                      return;
                    }
                    setState(() {
                      _secret.text = t;
                    });
                  },
            icon: const Icon(Icons.content_paste),
          ),
        ],
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight - 40),
                child: isWide
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(flex: 5, child: fields),
                          const SizedBox(width: 24),
                          Expanded(
                            flex: 4,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                keypadHint,
                                const SizedBox(height: 12),
                                keypad,
                              ],
                            ),
                          ),
                        ],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          fields,
                          const SizedBox(height: 16),
                          keypadHint,
                          const SizedBox(height: 12),
                          keypad,
                        ],
                      ),
              ),
            );
          },
        ),
      ),
    );
  }
}
