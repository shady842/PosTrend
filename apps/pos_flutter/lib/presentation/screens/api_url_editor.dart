import 'package:flutter/material.dart';

import '../../core/config/api_config.dart';
import '../../core/storage/local_storage.dart';

Future<void> showApiUrlEditor(BuildContext context) async {
  final messenger = ScaffoldMessenger.of(context);
  final c = TextEditingController(text: ApiConfig.baseUrl);
  final result = await showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('API base URL'),
      content: SingleChildScrollView(
        child: TextField(
          controller: c,
          keyboardType: TextInputType.url,
          autocorrect: false,
          decoration: const InputDecoration(
            hintText: 'http://192.168.1.10:3000',
            helperText: 'No /v1 — port is usually 3000',
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, 'cancel'),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, 'reset'),
          child: const Text('Use default'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, 'save'),
          child: const Text('Save'),
        ),
      ],
    ),
  );
  if (!context.mounted) return;
  if (result == 'reset') {
    await LocalStorage().clearApiBaseUrl();
    ApiConfig.setRuntimeBaseUrl(null);
    messenger.showSnackBar(
      SnackBar(content: Text('Using build default: ${ApiConfig.baseUrl}')),
    );
    return;
  }
  if (result == 'save') {
    final raw = c.text.trim();
    if (raw.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(content: Text('URL cannot be empty')),
      );
      return;
    }
    ApiConfig.setRuntimeBaseUrl(raw);
    await LocalStorage().saveApiBaseUrl(ApiConfig.baseUrl);
    messenger.showSnackBar(
      SnackBar(content: Text('Saved: ${ApiConfig.baseUrl}')),
    );
  }
}
