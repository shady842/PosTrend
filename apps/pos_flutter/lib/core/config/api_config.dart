/// API base URL without trailing slash.
/// Override at build time, e.g.:
/// `flutter run --dart-define=API_BASE_URL=http://192.168.1.5:3000`
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  static String get deviceLoginUrl => '$baseUrl/v1/pos/device-login';
  static String get deviceRefreshUrl => '$baseUrl/v1/pos/device-refresh';
  static String get posMenuUrl => '$baseUrl/v1/pos/menu';
  static String get posOrdersLayoutUrl => '$baseUrl/v1/pos/orders/layout';
  static String get posOrdersOpenTableUrl => '$baseUrl/v1/pos/orders/open-table';
  static String get posOrdersTransferTableUrl =>
      '$baseUrl/v1/pos/orders/transfer-table';
  static String get posOrdersMergeOrdersUrl =>
      '$baseUrl/v1/pos/orders/merge-orders';

  static String posOrderUrl(String orderId) =>
      '$baseUrl/v1/pos/orders/$orderId';

  static String posPaymentsOrderUrl(String orderId) =>
      '$baseUrl/v1/pos/payments/$orderId';

  static String get posPaymentsAddUrl => '$baseUrl/v1/pos/payments/add';

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
