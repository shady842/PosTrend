import { Body, Controller, Post } from "@nestjs/common";
import { CurrentTenant } from "../auth/decorators/tenant-context.decorator";
import { TenantContext } from "../auth/types/tenant-context.type";
import { Roles } from "../auth/decorators/roles.decorator";
import { PostingService } from "./posting.service";
import type { PostingEvent } from "./posting.types";

@Controller("posting")
export class PostingController {
  constructor(private readonly posting: PostingService) {}

  /** Admin backfill/retry endpoint. Most postings should be called internally from domain services. */
  @Post("apply")
  @Roles("tenant_owner", "branch_manager", "inventory_manager")
  apply(@CurrentTenant() ctx: TenantContext, @Body() event: PostingEvent) {
    return this.posting.post(ctx, event);
  }
}

