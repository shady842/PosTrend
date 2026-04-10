/// API base URL without trailing slash and without `/v1`.
///
/// Priority: saved URL on device (see device login / settings) →
/// `--dart-define=API_BASE_URL=...` → default `http://10.0.2.2:3000` (emulator).
class ApiConfig {
  static const String _compileDefault = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  static String? _runtimeOverride;

  static String _normalizeBase(String raw) {
    var s = raw.trim();
    while (s.endsWith('/')) {
      s = s.substring(0, s.length - 1);
    }
    if (s.toLowerCase().endsWith('/v1')) {
      s = s.substring(0, s.length - 3);
      while (s.endsWith('/')) {
        s = s.substring(0, s.length - 1);
      }
    }
    return s;
  }

  /// Call from [main] after loading prefs, or after user saves in the app.
  static void setRuntimeBaseUrl(String? url) {
    if (url == null || url.trim().isEmpty) {
      _runtimeOverride = null;
      return;
    }
    _runtimeOverride = _normalizeBase(url);
  }

  static String get baseUrl => _runtimeOverride ?? _compileDefault;

  static String get deviceLoginUrl => '$baseUrl/v1/pos/device-login';
  static String get deviceRefreshUrl => '$baseUrl/v1/pos/device-refresh';
  static String get posMenuUrl => '$baseUrl/v1/pos/menu';
  static String get posOrdersLayoutUrl => '$baseUrl/v1/pos/orders/layout';
  static String get posOrdersOpenTableUrl => '$baseUrl/v1/pos/orders/open-table';
  static String get posOrdersDeliveryUrl => '$baseUrl/v1/pos/orders/delivery';
  static String get posOrdersTransferTableUrl =>
      '$baseUrl/v1/pos/orders/transfer-table';
  static String get posOrdersMergeOrdersUrl =>
      '$baseUrl/v1/pos/orders/merge-orders';
  static String get posOrdersApplyDiscountUrl =>
      '$baseUrl/v1/pos/orders/apply-discount';
  static String get posOrdersApplyPromotionUrl =>
      '$baseUrl/v1/pos/orders/apply-promotion';
  static String get posOrdersVoidOrderUrl => '$baseUrl/v1/pos/orders/void-order';
  static String get posOrdersAddItemUrl => '$baseUrl/v1/pos/orders/add-item';
  static String get posOrdersAddModifierUrl => '$baseUrl/v1/pos/orders/add-modifier';
  static String get posOrdersUpdateQtyUrl => '$baseUrl/v1/pos/orders/update-qty';
  static String get posOrdersRemoveItemUrl => '$baseUrl/v1/pos/orders/remove-item';
  static String get posOrdersSendKitchenUrl => '$baseUrl/v1/pos/orders/send-kitchen';
  static String get posOrdersMoveItemUrl => '$baseUrl/v1/pos/orders/move-item';

  static String posOrderUrl(String orderId) =>
      '$baseUrl/v1/pos/orders/$orderId';

  static String posPaymentsOrderUrl(String orderId) =>
      '$baseUrl/v1/pos/payments/$orderId';

  static String get posPaymentsAddUrl => '$baseUrl/v1/pos/payments/add';
  static String get customersUrl => '$baseUrl/v1/customers';

  static String get posPaymentsSplitUrl => '$baseUrl/v1/pos/payments/split';

  static String orderCloseUrl(String orderId) =>
      '$baseUrl/v1/orders/$orderId/close';

  static String get kdsTicketsActiveUrl => '$baseUrl/v1/kds/tickets/active';

  static String get kdsTicketUpdateUrl => '$baseUrl/v1/kds/tickets/update';

  static String get shiftsOpenUrl => '$baseUrl/v1/shifts/open';

  static String get shiftsCloseUrl => '$baseUrl/v1/shifts/close';

  static String get shiftsCurrentUrl => '$baseUrl/v1/shifts/current';

  static String get dayCloseUrl => '$baseUrl/v1/day-close';

  static String get dayCloseSummaryUrl => '$baseUrl/v1/day-close/summary';

  static String get syncPushUrl => '$baseUrl/v1/sync/push';

  static String syncPullUrl([String? cursor]) {
    if (cursor == null || cursor.isEmpty) {
      return '$baseUrl/v1/sync/pull';
    }
    return '$baseUrl/v1/sync/pull?cursor=${Uri.encodeComponent(cursor)}';
  }
}
