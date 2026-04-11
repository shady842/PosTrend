import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/storage/local_storage.dart';
import '../../services/voice/pos_voice_service.dart';
import '../../services/voice/voice_navigation.dart';
import '../../services/voice/voice_settings.dart';

/// Mic control that sits above every route so voice works from any screen.
class VoiceCommandOverlay extends StatefulWidget {
  const VoiceCommandOverlay({super.key});

  @override
  State<VoiceCommandOverlay> createState() => _VoiceCommandOverlayState();
}

class _VoiceCommandOverlayState extends State<VoiceCommandOverlay> {
  bool _sessionActive = false;
  bool _stopRequested = false;

  @override
  void initState() {
    super.initState();
    VoiceSettings.instance.addListener(_onVoiceSettings);
    unawaited(VoiceSettings.instance.load());
  }

  void _onVoiceSettings() => setState(() {});

  @override
  void dispose() {
    VoiceSettings.instance.removeListener(_onVoiceSettings);
    super.dispose();
  }

  bool get _android => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  bool _isStopPhrase(String heard) {
    final t = heard.toLowerCase().trim();
    if (t.isEmpty) return false;
    if (t.contains('stop listening')) return true;
    if (t.contains('stop voice')) return true;
    if (t.contains('end voice')) return true;
    if (t.contains('quit voice')) return true;
    if (t == 'stop') return true;
    return false;
  }

  void _snack(String msg) {
    final ctx = AppNavigator.maybeContext;
    if (ctx == null || !ctx.mounted) return;
    ScaffoldMessenger.of(ctx).showSnackBar(
      SnackBar(content: Text(msg), duration: const Duration(seconds: 4)),
    );
  }

  Future<void> _runSession() async {
    if (_sessionActive) return;
    if (!_android || !VoiceSettings.instance.enabled) return;
    setState(() {
      _sessionActive = true;
      _stopRequested = false;
    });
    final storage = LocalStorage();
    try {
      do {
        if (!mounted || _stopRequested) break;
        _snack(
          VoiceSettings.instance.continuous
              ? 'Listening… say a command, or "stop listening" / tap Stop.'
              : 'Listening… speak now.',
        );
        final text = await PosVoiceService.instance.listenOnce();
        if (!mounted || _stopRequested) break;
        if (text == null || text.trim().isEmpty) {
          if (!VoiceSettings.instance.continuous) {
            _snack('No speech heard — tap mic to try again');
            break;
          }
          continue;
        }
        if (_isStopPhrase(text)) {
          _snack('Voice session ended');
          break;
        }
        final raw = await storage.getVoiceShortcutsLines();
        final custom = parseVoiceShortcutLines(raw);
        VoiceNavigation.dispatch(heard: text, customPhraseToTarget: custom);
        if (!mounted || !VoiceSettings.instance.continuous) break;
        await Future<void>.delayed(const Duration(milliseconds: 450));
      } while (VoiceSettings.instance.continuous && mounted && !_stopRequested);
    } finally {
      PosVoiceService.instance.cancel();
      if (mounted) {
        setState(() {
          _sessionActive = false;
          _stopRequested = false;
        });
      }
    }
  }

  void _requestStop() {
    setState(() => _stopRequested = true);
    PosVoiceService.instance.cancel();
  }

  @override
  Widget build(BuildContext context) {
    if (!_android || !VoiceSettings.instance.enabled) {
      return const SizedBox.shrink();
    }
    return Positioned(
      right: 10,
      bottom: 10,
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (_sessionActive && VoiceSettings.instance.continuous)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  elevation: 4,
                  borderRadius: BorderRadius.circular(20),
                  color: Theme.of(context).colorScheme.surfaceContainerHigh,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(20),
                    onTap: _requestStop,
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.stop_circle_outlined, size: 20),
                          SizedBox(width: 6),
                          Text('Stop voice'),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            FloatingActionButton.large(
              heroTag: 'global_voice_mic',
              tooltip: VoiceSettings.instance.continuous ? 'Voice (hands-free)' : 'Voice command',
              onPressed: _sessionActive ? null : _runSession,
              child: _sessionActive
                  ? const Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white),
                    )
                  : const Icon(Icons.mic),
            ),
          ],
        ),
      ),
    );
  }
}
