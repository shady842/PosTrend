class MenuCategory {
  const MenuCategory({
    required this.id,
    required this.name,
    required this.sortOrder,
  });

  final String id;
  final String name;
  final int sortOrder;
}

class MenuVariant {
  const MenuVariant({
    required this.id,
    required this.itemId,
    required this.name,
    required this.priceCents,
    this.isDefault = false,
    this.sku,
    this.barcode,
  });

  final String id;
  final String itemId;
  final String name;
  final int priceCents;
  final bool isDefault;
  final String? sku;
  final String? barcode;
}

class MenuItem {
  const MenuItem({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.priceCents,
    this.description,
    this.barcode,
    this.imageUrl,
    this.isCombo = false,
    this.displayOrder = 0,
  });

  final String id;
  final String categoryId;
  final String name;
  final int priceCents;
  final String? description;
  final String? barcode;
  final String? imageUrl;
  final bool isCombo;
  final int displayOrder;
}

class MenuModifier {
  const MenuModifier({
    required this.id,
    required this.itemId,
    required this.name,
    required this.priceDeltaCents,
    this.groupId,
  });

  final String id;
  final String itemId;
  final String name;
  final int priceDeltaCents;
  final String? groupId;
}
