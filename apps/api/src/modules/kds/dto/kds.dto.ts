import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateKdsTicketDto {
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @IsOptional()
  @IsString()
  station_id?: string;

  @IsOptional()
  @IsString({ each: true })
  order_item_ids?: string[];
}

export class UpdateKdsTicketDto {
  @IsString()
  @IsNotEmpty()
  ticket_id!: string;

  @IsString()
  @IsNotEmpty()
  status!: "pending" | "preparing" | "ready" | "served";
}

export class KdsEventDto {
  @IsString()
  @IsNotEmpty()
  ticket_id!: string;

  @IsString()
  @IsNotEmpty()
  event_type!: string;

  @IsOptional()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  status?: string;
}
