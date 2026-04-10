import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class OpenTableOrderDto {
  @IsString()
  table_id!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  guest_count?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  client_order_id?: string;

  @IsOptional()
  @IsString()
  customer_id?: string;
}

export class OpenTakeawayOrderDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  client_order_id?: string;

  @IsOptional()
  @IsString()
  customer_id?: string;
}

export class OpenDeliveryOrderDto extends OpenTakeawayOrderDto {
  @IsOptional()
  @IsString()
  delivery_contact_name?: string;

  @IsOptional()
  @IsString()
  delivery_phone?: string;

  @IsOptional()
  @IsString()
  delivery_address?: string;

  @IsOptional()
  @IsString()
  delivery_instructions?: string;
}

export class AddItemPosDto {
  @IsString()
  order_id!: string;

  @IsString()
  menu_item_id!: string;

  @IsOptional()
  @IsString()
  variant_id?: string;

  @IsNumber()
  @Min(1)
  qty!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seat_no?: number;
}

export class UpdateQtyDto {
  @IsString()
  order_item_id!: string;

  @IsNumber()
  @Min(0)
  qty!: number;
}

export class RemoveItemDto {
  @IsString()
  order_item_id!: string;
}

export class MoveItemDto {
  @IsString()
  order_item_id!: string;

  @IsString()
  target_order_id!: string;
}

export class AddModifierDto {
  @IsString()
  order_item_id!: string;

  @IsString()
  modifier_option_id!: string;
}

export class AddOrderNoteDto {
  @IsString()
  order_id!: string;

  @IsString()
  note!: string;
}

export class ApplyDiscountDto {
  @IsString()
  order_id!: string;

  @IsString()
  type!: "percent" | "fixed";

  @IsNumber()
  value!: number;

  @IsOptional()
  @IsIn(["order", "item"])
  scope?: "order" | "item";

  @IsOptional()
  @IsString()
  order_item_id?: string;

  @IsOptional()
  @IsString()
  manager_email?: string;

  @IsOptional()
  @IsString()
  manager_password?: string;

  @IsOptional()
  @IsString()
  manager_pin?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApplyPromotionDto {
  @IsString()
  order_id!: string;

  @IsString()
  promotion_id!: string;
}

export class SendKitchenDto {
  @IsString()
  order_id!: string;
}

export class TransferTableDto {
  @IsString()
  order_id!: string;

  @IsString()
  to_table_id!: string;
}

export class MergeOrdersDto {
  @IsString()
  source_order_id!: string;

  @IsString()
  target_order_id!: string;
}

export class SplitOrderDto {
  @IsString()
  order_id!: string;

  @IsString({ each: true })
  order_item_ids!: string[];
}

export class VoidItemDto {
  @IsString()
  order_item_id!: string;
}

export class VoidOrderDto {
  @IsString()
  order_id!: string;
}

export class MonitorMoveDto {
  @IsString()
  order_id!: string;

  @IsIn(["open", "preparing", "ready", "paid", "closed"])
  column!: "open" | "preparing" | "ready" | "paid" | "closed";
}

export class CreateSectionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  branch_id?: string;
}

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateDiningTableDto {
  @IsString()
  @IsNotEmpty()
  floor_id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;
}

export class UpdateDiningTableDto {
  @IsOptional()
  @IsString()
  floor_id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
