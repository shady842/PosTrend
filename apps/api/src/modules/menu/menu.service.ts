import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { TenantContext } from "../auth/types/tenant-context.type";
import {
  AttachItemModifierDto,
  BranchPriceOverrideInputDto,
  CreateCategoryDto,
  CreateItemDto,
  CreateModifierGroupDto,
  CreateModifierOptionDto,
  CreateVariantDto,
  PriceOverrideDto,
  RecipeIngredientInputDto,
  ReorderCategoriesDto,
  ReorderItemsDto,
  UpsertItemAdvancedConfigDto,
  UpdateCategoryDto,
  UpdateItemDto
} from "./dto/menu.dto";

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  createCategory(ctx: TenantContext, dto: CreateCategoryDto) {
    return this.prisma.menuCategory.create({
      data: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        branchId: dto.branch_id || null,
        name: dto.name,
        displayOrder: dto.display_order ?? 0,
        isActive: dto.is_active ?? true
      }
    });
  }

  listCategories(ctx: TenantContext) {
    return this.prisma.menuCategory.findMany({
      where: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        OR: [{ branchId: null }, { branchId: ctx.branch_id }]
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
    });
  }

  async updateCategory(ctx: TenantContext, id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.menuCategory.findFirst({
      where: { id, tenantId: ctx.tenant_id, conceptId: ctx.concept_id }
    });
    if (!existing) throw new NotFoundException("Category not found");
    return this.prisma.menuCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.display_order !== undefined ? { displayOrder: dto.display_order } : {}),
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {})
      }
    });
  }

  async reorderCategories(ctx: TenantContext, dto: ReorderCategoriesDto) {
    const categories = await this.prisma.menuCategory.findMany({
      where: {
        id: { in: dto.ordered_ids },
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id
      }
    });
    if (categories.length !== dto.ordered_ids.length) {
      throw new NotFoundException("One or more categories were not found");
    }
    await this.prisma.$transaction(
      dto.ordered_ids.map((categoryId, index) =>
        this.prisma.menuCategory.update({
          where: { id: categoryId },
          data: { displayOrder: index }
        })
      )
    );
    return this.listCategories(ctx);
  }

  async createItem(ctx: TenantContext, dto: CreateItemDto) {
    const category = await this.prisma.menuCategory.findFirst({
      where: {
        id: dto.category_id,
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id
      }
    });
    if (!category) throw new NotFoundException("Category not found");

    let displayOrder = dto.display_order;
    if (displayOrder === undefined) {
      const agg = await this.prisma.menuItem.aggregate({
        where: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          categoryId: dto.category_id
        },
        _max: { displayOrder: true }
      });
      displayOrder = (agg._max.displayOrder ?? -1) + 1;
    }

    return this.prisma.menuItem.create({
      data: {
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        categoryId: dto.category_id,
        name: dto.name,
        description: dto.description,
        sku: dto.sku,
        barcode: dto.barcode,
        imageUrl: dto.image_url,
        basePrice: dto.base_price,
        isActive: dto.is_active ?? true,
        isCombo: dto.is_combo ?? false,
        kitchenStationId: dto.kitchen_station_id,
        taxProfile: dto.tax_profile,
        serviceChargeRule: dto.service_charge_rule,
        displayOrder
      }
    });
  }

  async updateItem(ctx: TenantContext, id: string, dto: UpdateItemDto) {
    const existing = await this.prisma.menuItem.findFirst({
      where: { id, tenantId: ctx.tenant_id, conceptId: ctx.concept_id }
    });
    if (!existing) throw new NotFoundException("Item not found");
    if (dto.category_id) {
      const cat = await this.prisma.menuCategory.findFirst({
        where: { id: dto.category_id, tenantId: ctx.tenant_id, conceptId: ctx.concept_id }
      });
      if (!cat) throw new NotFoundException("Category not found");
    }
    return this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(dto.category_id !== undefined ? { categoryId: dto.category_id } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
        ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
        ...(dto.image_url !== undefined ? { imageUrl: dto.image_url } : {}),
        ...(dto.base_price !== undefined ? { basePrice: dto.base_price } : {}),
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
        ...(dto.is_combo !== undefined ? { isCombo: dto.is_combo } : {}),
        ...(dto.kitchen_station_id !== undefined ? { kitchenStationId: dto.kitchen_station_id } : {}),
        ...(dto.tax_profile !== undefined ? { taxProfile: dto.tax_profile } : {}),
        ...(dto.service_charge_rule !== undefined
          ? { serviceChargeRule: dto.service_charge_rule }
          : {}),
        ...(dto.display_order !== undefined ? { displayOrder: dto.display_order } : {})
      },
      include: {
        category: true,
        variants: true,
        modifierLinks: {
          include: {
            modifierGroup: {
              include: { options: { orderBy: { displayOrder: "asc" } } }
            }
          }
        }
      }
    });
  }

  async reorderItems(ctx: TenantContext, dto: ReorderItemsDto) {
    const items = await this.prisma.menuItem.findMany({
      where: {
        id: { in: dto.ordered_ids },
        tenantId: ctx.tenant_id,
        conceptId: ctx.concept_id,
        categoryId: dto.category_id
      }
    });
    if (items.length !== dto.ordered_ids.length) {
      throw new NotFoundException("One or more items were not found in this category");
    }
    await this.prisma.$transaction(
      dto.ordered_ids.map((itemId, index) =>
        this.prisma.menuItem.update({
          where: { id: itemId },
          data: { displayOrder: index }
        })
      )
    );
    return { ok: true };
  }

  async listItems(
    ctx: TenantContext,
    query: { search?: string; page?: number; limit?: number; category_id?: string }
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(500, Math.max(1, query.limit || 20));
    const where = {
      tenantId: ctx.tenant_id,
      conceptId: ctx.concept_id,
      ...(query.category_id ? { categoryId: query.category_id } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { sku: { contains: query.search, mode: "insensitive" as const } },
              { barcode: { contains: query.search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.menuItem.count({ where }),
      this.prisma.menuItem.findMany({
        where,
        include: {
          category: true,
          variants: true,
          modifierLinks: {
            include: {
              modifierGroup: {
                include: { options: { orderBy: { displayOrder: "asc" } } }
              }
            }
          }
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit
      })
    ]);
    return { total, page, limit, items };
  }

  listModifierGroups(ctx: TenantContext) {
    return this.prisma.modifierGroup.findMany({
      where: { tenantId: ctx.tenant_id },
      include: { options: { orderBy: { displayOrder: "asc" } } },
      orderBy: { name: "asc" }
    });
  }

  createVariant(ctx: TenantContext, dto: CreateVariantDto) {
    return this.prisma.itemVariant.create({
      data: {
        menuItemId: dto.menu_item_id,
        name: dto.name,
        price: dto.price,
        sku: dto.sku,
        barcode: dto.barcode,
        isDefault: dto.is_default ?? false
      }
    });
  }

  createModifierGroup(ctx: TenantContext, dto: CreateModifierGroupDto) {
    return this.prisma.modifierGroup.create({
      data: {
        tenantId: ctx.tenant_id,
        name: dto.name,
        minSelect: dto.min_select,
        maxSelect: dto.max_select,
        isRequired: dto.is_required ?? false
      }
    });
  }

  createModifierOption(dto: CreateModifierOptionDto) {
    return this.prisma.modifierOption.create({
      data: {
        modifierGroupId: dto.modifier_group_id,
        name: dto.name,
        price: dto.price,
        displayOrder: dto.display_order ?? 0
      }
    });
  }

  attachItemModifier(dto: AttachItemModifierDto) {
    return this.prisma.menuItemModifierGroup.create({
      data: {
        menuItemId: dto.menu_item_id,
        modifierGroupId: dto.modifier_group_id
      }
    });
  }

  async detachItemModifier(ctx: TenantContext, linkId: string) {
    const link = await this.prisma.menuItemModifierGroup.findFirst({
      where: {
        id: linkId,
        menuItem: { tenantId: ctx.tenant_id, conceptId: ctx.concept_id }
      }
    });
    if (!link) throw new NotFoundException("Modifier link not found");
    await this.prisma.menuItemModifierGroup.delete({ where: { id: linkId } });
    return { ok: true };
  }

  setPriceOverride(dto: PriceOverrideDto) {
    return this.prisma.priceList.upsert({
      where: {
        branchId_menuItemId: {
          branchId: dto.branch_id,
          menuItemId: dto.menu_item_id
        }
      },
      create: {
        branchId: dto.branch_id,
        menuItemId: dto.menu_item_id,
        priceOverride: dto.price_override
      },
      update: {
        priceOverride: dto.price_override
      }
    });
  }

  async getItemAdvancedConfig(ctx: TenantContext, itemId: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, tenantId: ctx.tenant_id, conceptId: ctx.concept_id },
      include: {
        priceOverrides: true,
        recipes: { include: { lines: { include: { inventoryItem: true } } } }
      }
    });
    if (!item) throw new NotFoundException("Item not found");

    const availability = (item.availabilityJson as Record<string, any> | null) || {};
    const schedule = (item.scheduleJson as Record<string, any> | null) || {};
    return {
      item_id: item.id,
      price_takeaway: Number(availability?.pricing?.takeaway || 0),
      price_delivery: Number(availability?.pricing?.delivery || 0),
      branch_price_overrides: item.priceOverrides.map((p) => ({
        branch_id: p.branchId,
        dine_in: Number(p.priceOverride),
        takeaway: Number(availability?.pricing?.branch_channel_prices?.[p.branchId]?.takeaway || 0),
        delivery: Number(availability?.pricing?.branch_channel_prices?.[p.branchId]?.delivery || 0)
      })),
      track_inventory: Boolean(availability?.inventory?.track_inventory),
      is_recipe_item: Boolean(schedule?.recipe?.is_recipe_item),
      recipe_ingredients:
        item.recipes[0]?.lines.map((l) => ({
          inventory_item_id: l.inventoryItemId,
          item_name: l.inventoryItem.name,
          qty: Number(l.qtyPerItem),
          uom: l.inventoryItem.uomId || "unit",
          unit_cost: 0
        })) || [],
      inventory: availability?.inventory || {},
      accounting: schedule?.accounting || {}
    };
  }

  async upsertItemAdvancedConfig(ctx: TenantContext, itemId: string, dto: UpsertItemAdvancedConfigDto) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: itemId, tenantId: ctx.tenant_id, conceptId: ctx.concept_id },
      include: { recipes: true }
    });
    if (!item) throw new NotFoundException("Item not found");

    const availability = ((item.availabilityJson as Record<string, any> | null) || {}) as Record<string, any>;
    const schedule = ((item.scheduleJson as Record<string, any> | null) || {}) as Record<string, any>;

    if (dto.price_takeaway !== undefined || dto.price_delivery !== undefined || dto.branch_price_overrides) {
      availability.pricing = {
        ...(availability.pricing || {}),
        ...(dto.price_takeaway !== undefined ? { takeaway: dto.price_takeaway } : {}),
        ...(dto.price_delivery !== undefined ? { delivery: dto.price_delivery } : {})
      };
    }
    if (dto.track_inventory !== undefined || dto.inventory) {
      availability.inventory = {
        ...(availability.inventory || {}),
        ...(dto.track_inventory !== undefined ? { track_inventory: dto.track_inventory } : {}),
        ...(dto.inventory || {})
      };
    }
    if (dto.is_recipe_item !== undefined || dto.accounting) {
      schedule.recipe = {
        ...(schedule.recipe || {}),
        ...(dto.is_recipe_item !== undefined ? { is_recipe_item: dto.is_recipe_item } : {})
      };
      if (dto.accounting) schedule.accounting = { ...(schedule.accounting || {}), ...dto.accounting };
    }

    if (dto.branch_price_overrides) {
      await this.applyBranchPriceOverrides(item.id, dto.branch_price_overrides, availability);
    }

    await this.prisma.menuItem.update({
      where: { id: item.id },
      data: {
        availabilityJson: availability,
        scheduleJson: schedule
      }
    });

    if (dto.is_recipe_item && dto.recipe_ingredients) {
      await this.upsertRecipeLines(ctx, item.id, item.recipes[0]?.id || null, dto.recipe_ingredients);
    }

    return this.getItemAdvancedConfig(ctx, item.id);
  }

  private async applyBranchPriceOverrides(
    menuItemId: string,
    rows: BranchPriceOverrideInputDto[],
    availabilityRef: Record<string, any>
  ) {
    const byBranch = new Map<string, BranchPriceOverrideInputDto>();
    rows.forEach((r) => byBranch.set(r.branch_id, r));
    const branchIds = Array.from(byBranch.keys());

    await this.prisma.$transaction(async (tx) => {
      await tx.priceList.deleteMany({ where: { menuItemId, branchId: { in: branchIds } } });
      const listRows = rows.filter((r) => r.dine_in !== undefined);
      if (listRows.length) {
        await tx.priceList.createMany({
          data: listRows.map((r) => ({
            menuItemId,
            branchId: r.branch_id,
            priceOverride: r.dine_in || 0
          }))
        });
      }
    });

    const branchChannelPrices: Record<string, { takeaway: number; delivery: number }> =
      availabilityRef?.pricing?.branch_channel_prices || {};
    for (const row of rows) {
      branchChannelPrices[row.branch_id] = {
        takeaway: Number(row.takeaway || 0),
        delivery: Number(row.delivery || 0)
      };
    }
    availabilityRef.pricing = { ...(availabilityRef.pricing || {}), branch_channel_prices: branchChannelPrices };
  }

  private async upsertRecipeLines(
    ctx: TenantContext,
    menuItemId: string,
    recipeId: string | null,
    lines: RecipeIngredientInputDto[]
  ) {
    const resolved: Array<{ inventoryItemId: string; qtyPerItem: number }> = [];
    for (const line of lines) {
      if (!line.qty || line.qty <= 0) continue;
      let inventoryItemId = line.inventory_item_id;
      if (!inventoryItemId && line.item_name) {
        const inv = await this.prisma.inventoryItem.findFirst({
          where: {
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            name: { equals: line.item_name, mode: "insensitive" }
          }
        });
        inventoryItemId = inv?.id;
      }
      if (!inventoryItemId) continue;
      resolved.push({ inventoryItemId, qtyPerItem: line.qty });
    }

    const recipe =
      recipeId ||
      (
        await this.prisma.recipe.create({
          data: {
            menuItemId,
            tenantId: ctx.tenant_id,
            conceptId: ctx.concept_id,
            branchId: null
          }
        })
      ).id;

    await this.prisma.$transaction(async (tx) => {
      await tx.recipeLine.deleteMany({ where: { recipeId: recipe } });
      if (resolved.length) {
        await tx.recipeLine.createMany({
          data: resolved.map((r) => ({
            recipeId: recipe,
            inventoryItemId: r.inventoryItemId,
            qtyPerItem: r.qtyPerItem
          }))
        });
      }
    });
  }

  async getPosMenu(ctx: TenantContext) {
    const [categories, items, overrides, links, groups] = await this.prisma.$transaction([
      this.prisma.menuCategory.findMany({
        where: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          isActive: true,
          OR: [{ branchId: null }, { branchId: ctx.branch_id }]
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
      }),
      this.prisma.menuItem.findMany({
        where: {
          tenantId: ctx.tenant_id,
          conceptId: ctx.concept_id,
          isActive: true
        },
        include: { variants: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
      }),
      this.prisma.priceList.findMany({
        where: { branchId: ctx.branch_id }
      }),
      this.prisma.menuItemModifierGroup.findMany(),
      this.prisma.modifierGroup.findMany({
        where: { tenantId: ctx.tenant_id },
        include: { options: { orderBy: { displayOrder: "asc" } } }
      })
    ]);

    const overrideMap = new Map(overrides.map((o) => [o.menuItemId, Number(o.priceOverride)]));
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const itemModifiers = new Map<string, any[]>();
    for (const link of links) {
      const group = groupMap.get(link.modifierGroupId);
      if (!group) continue;
      if (!itemModifiers.has(link.menuItemId)) itemModifiers.set(link.menuItemId, []);
      itemModifiers.get(link.menuItemId)!.push({
        id: group.id,
        name: group.name,
        min_select: group.minSelect,
        max_select: group.maxSelect,
        is_required: group.isRequired,
        options: group.options.map((o) => ({
          id: o.id,
          name: o.name,
          price: Number(o.price),
          display_order: o.displayOrder
        }))
      });
    }

    return {
      branch_id: ctx.branch_id,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        display_order: c.displayOrder
      })),
      items: items.map((i) => ({
        id: i.id,
        category_id: i.categoryId,
        name: i.name,
        description: i.description,
        barcode: i.barcode,
        image_url: i.imageUrl,
        price: overrideMap.get(i.id) ?? Number(i.basePrice),
        is_combo: i.isCombo,
        kitchen_station_id: i.kitchenStationId,
        tax_profile: i.taxProfile,
        service_charge_rule: i.serviceChargeRule,
        variants: i.variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: Number(v.price),
          is_default: v.isDefault,
          sku: v.sku,
          barcode: v.barcode
        })),
        modifiers: itemModifiers.get(i.id) || []
      }))
    };
  }
}
