import { IsArray, IsBoolean, IsDateString, IsEmail, IsInt, IsNumber, IsOptional, IsString, MinLength, Min } from "class-validator";

export class SuperAdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class UpdatePlatformSettingDto {
  @IsOptional()
  @IsString()
  system_name?: string;

  @IsOptional()
  @IsEmail()
  support_email?: string;

  @IsOptional()
  @IsString()
  maintenance_mode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  default_trial_days?: number;

  @IsOptional()
  @IsString()
  default_plan_id?: string;

  @IsOptional()
  @IsString()
  smtp_host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  smtp_port?: number;

  @IsOptional()
  @IsString()
  smtp_user?: string;

  @IsOptional()
  @IsString()
  smtp_password?: string;

  @IsOptional()
  @IsString()
  smtp_from_email?: string;

  @IsOptional()
  @IsString()
  smtp_from_name?: string;

  @IsOptional()
  @IsString()
  storage_driver?: string;

  @IsOptional()
  @IsString()
  storage_bucket?: string;

  @IsOptional()
  @IsString()
  storage_region?: string;

  @IsOptional()
  @IsString()
  storage_base_url?: string;

  @IsOptional()
  @IsString()
  branding_app_name?: string;

  @IsOptional()
  @IsString()
  branding_logo_url?: string;

  @IsOptional()
  @IsBoolean()
  feature_inventory?: boolean;

  @IsOptional()
  @IsBoolean()
  feature_billing?: boolean;

  @IsOptional()
  @IsBoolean()
  feature_reports?: boolean;

  @IsOptional()
  @IsBoolean()
  feature_hr?: boolean;

  @IsOptional()
  @IsBoolean()
  feature_promotions?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  global_tax_default?: number;

  @IsOptional()
  @IsString()
  currency_default?: string;

  @IsOptional()
  @IsString()
  timezone_default?: string;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  plan_id?: string;

  @IsOptional()
  @IsDateString()
  trial_ends_at?: string;

  @IsOptional()
  @IsString()
  suspension_reason?: string;
}

export class CreatePlanDto {
  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsInt()
  @Min(0)
  trial_days!: number;

  @IsNumber()
  @Min(0)
  price_monthly!: number;

  @IsNumber()
  @Min(0)
  price_yearly!: number;

  @IsInt()
  @Min(1)
  max_branches!: number;

  @IsInt()
  @Min(1)
  max_concepts!: number;

  @IsInt()
  @Min(1)
  max_devices!: number;

  @IsInt()
  @Min(1)
  max_users!: number;

  @IsInt()
  @Min(1)
  max_items!: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  trial_days?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price_monthly?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price_yearly?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_branches?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_concepts?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_devices?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_users?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_items?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ExtendTrialDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  extend_days?: number;
}

export class ConvertTrialDto {
  @IsOptional()
  @IsString()
  plan_id?: string;
}

export class SuspendTenantDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ChangeSubscriptionDto {
  @IsString()
  tenant_id!: string;

  @IsString()
  plan_id!: string;

  @IsOptional()
  @IsString()
  billing_cycle?: "monthly" | "yearly";

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  next_billing_date?: string;
}

export class CancelSubscriptionDto {
  @IsString()
  tenant_id!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateBlogPostDto {
  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  seo_title?: string;

  @IsOptional()
  @IsString()
  seo_description?: string;

  @IsOptional()
  @IsString()
  og_image?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateBlogPostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  seo_title?: string;

  @IsOptional()
  @IsString()
  seo_description?: string;

  @IsOptional()
  @IsString()
  og_image?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

