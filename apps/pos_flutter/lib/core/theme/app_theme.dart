import 'package:flutter/material.dart';

class AppTheme {
  static final light = ThemeData(
    useMaterial3: true,
    colorSchemeSeed: Colors.deepPurple,
    brightness: Brightness.light,
    visualDensity: VisualDensity.comfortable,
    cardTheme: CardThemeData(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      elevation: 0,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(160, 60),
        textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
  );

  static final dark = ThemeData(
    useMaterial3: true,
    colorSchemeSeed: Colors.deepPurple,
    brightness: Brightness.dark,
    visualDensity: VisualDensity.comfortable,
    cardTheme: CardThemeData(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      elevation: 0,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(160, 60),
        textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
  );
}
