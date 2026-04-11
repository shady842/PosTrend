import 'dart:io';

import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// Windows/Linux/macOS need FFI; Android/iOS use the default sqflite implementation.
Future<void> bootstrapSqlite() async {
  if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  }
}
