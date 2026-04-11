import 'package:flutter/material.dart';

/// Global navigator so voice overlay (above routes) can push/pop the same stack as the rest of the app.
class AppNavigator {
  AppNavigator._();

  static final GlobalKey<NavigatorState> key = GlobalKey<NavigatorState>();

  static NavigatorState? get state => key.currentState;

  static BuildContext? get maybeContext => key.currentContext;
}
