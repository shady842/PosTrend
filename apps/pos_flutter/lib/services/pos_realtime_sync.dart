import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../core/config/api_config.dart';
import '../core/network/connectivity_service.dart';
import '../core/storage/local_storage.dart';

/// Payload for order-scoped realtime messages (SYNC-2).
class PosRealtimeEvent {
  PosRealtimeEvent({
    required this.name,
    this.orderId,
    this.paymentId,
    this.ticketId,
    this.ts,
  });

  final String name;
  final String? orderId;
  final String? paymentId;
  final String? ticketId;
  final String? ts;
}

/// Subscribes to `orders.branch.{branchId}` with JWT auth (includes kitchen flow events on that room).
///
/// - Emits [orderEvents] for each `order.*` / `payment.added` message.
/// - Notifies [ChangeNotifier] listeners (debounced) so tables/layout refresh from HTTP.
/// - Persists last event [ts] for resume; on reconnect, re-subscribes and notifies so clients
///   run a full HTTP catch-up (server does not replay missed WS events).
class PosRealtimeSync extends ChangeNotifier {
  PosRealtimeSync._();
  static final PosRealtimeSync instance = PosRealtimeSync._();

  static const _lastEventKey = 'pt_pos_last_realtime_event_ts';

  final LocalStorage _storage = LocalStorage();
  final ConnectivityService _connectivity = ConnectivityService();

  io.Socket? _socket;
  String? _activeBranchId;
  Timer? _debounce;
  StreamSubscription<bool>? _netSub;
  bool _started = false;

  final StreamController<PosRealtimeEvent> _eventCtl =
      StreamController<PosRealtimeEvent>.broadcast();

  /// Fine-grained stream (e.g. PaymentScreen refreshes only matching [orderId]).
  Stream<PosRealtimeEvent> get orderEvents => _eventCtl.stream;

  /// ISO timestamp from the last handled server payload (`ts` field).
  String? lastEventIso;

  bool connected = false;

  Future<void> start() async {
    if (_started) return;
    _started = true;

    final prefs = await SharedPreferences.getInstance();
    lastEventIso = prefs.getString(_lastEventKey);

    _netSub = _connectivity.watchOnline().listen((online) {
      if (online) {
        unawaited(_connectSocket());
      } else {
        _socket?.disconnect();
        connected = false;
        notifyListeners();
      }
    });

    if (await _connectivity.isOnline()) {
      await _connectSocket();
    }
  }

  /// Call on logout; cancels network watch and disposes the socket.
  Future<void> stop() async {
    _started = false;
    await _netSub?.cancel();
    _netSub = null;
    _debounce?.cancel();
    _debounce = null;
    _socket?.dispose();
    _socket = null;
    _activeBranchId = null;
    connected = false;
    notifyListeners();
  }

  Future<void> _connectSocket() async {
    if (!_started) return;
    if (!await _connectivity.isOnline()) return;

    final branch = (await _storage.getBranchScope())?.trim();
    if (branch == null || branch.isEmpty) return;

    final token = await _storage.getJwt();
    if (token == null || token.isEmpty) return;

    if (_socket != null && _activeBranchId == branch) {
      if (!_socket!.connected) {
        _socket!.connect();
      }
      return;
    }

    _socket?.dispose();
    _activeBranchId = branch;

    final channel = 'orders.branch.$branch';
    final opts = <String, dynamic>{
      'transports': ['websocket', 'polling'],
      'autoConnect': false,
      'auth': {'token': token},
      'reconnection': true,
      'reconnectionAttempts': 1000,
      'reconnectionDelay': 1000,
      'reconnectionDelayMax': 30000,
    };

    final s = io.io(ApiConfig.baseUrl, opts);
    _socket = s;

    void subscribe() {
      s.emit('realtime.subscribe', {
        'channels': [channel],
      });
    }

    void handlePayload(String name, dynamic raw) {
      String? oid;
      String? pid;
      String? tid;
      String? ts;
      if (raw is Map) {
        oid = raw['order_id']?.toString();
        pid = raw['payment_id']?.toString();
        tid = raw['ticket_id']?.toString();
        ts = raw['ts']?.toString();
        if (ts != null && ts.isNotEmpty) {
          lastEventIso = ts;
          unawaited(_persistLastTs(ts));
        }
      }
      if (!_eventCtl.isClosed) {
        _eventCtl.add(PosRealtimeEvent(
          name: name,
          orderId: oid,
          paymentId: pid,
          ticketId: tid,
          ts: ts,
        ));
      }
      _scheduleDebouncedNotify();
    }

    s.onConnect((_) {
      connected = true;
      subscribe();
      notifyListeners();
    });

    s.onDisconnect((_) {
      connected = false;
      notifyListeners();
    });

    s.io.on('reconnect', (_) {
      subscribe();
      notifyListeners();
    });

    for (final ev in const [
      'order.created',
      'order.updated',
      'order.closed',
      'payment.added',
      'order.sent',
      'item.preparing',
      'item.ready',
      'kds.updated',
    ]) {
      s.on(ev, (data) => handlePayload(ev, data));
    }

    s.connect();
  }

  Future<void> _persistLastTs(String ts) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_lastEventKey, ts);
  }

  void _scheduleDebouncedNotify() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      notifyListeners();
    });
  }
}
