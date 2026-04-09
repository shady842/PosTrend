import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityService {
  final _connectivity = Connectivity();

  static bool _anyConnected(List<ConnectivityResult> results) {
    return results.any((r) => r != ConnectivityResult.none);
  }

  Stream<bool> watchOnline() {
    return _connectivity.onConnectivityChanged
        .map((results) => _anyConnected(results));
  }

  Future<bool> isOnline() async {
    final results = await _connectivity.checkConnectivity();
    return _anyConnected(results);
  }
}
