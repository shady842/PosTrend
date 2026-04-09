import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { DemoRequestDto, LeadCaptureDto, NewsletterSignupDto, SignupDto } from "./dto/signup.dto";
import { SaasService } from "./saas.service";

@Controller("public")
export class PublicController {
  constructor(private readonly saasService: SaasService) {}

  @Get("plans")
  plans() {
    return this.saasService.getPlans();
  }

  @Post("signup")
  signup(@Body() dto: SignupDto) {
    return this.saasService.signup(dto);
  }

  @Post("demo-request")
  demoRequest(@Body() dto: DemoRequestDto) {
    return this.saasService.createDemoRequest(dto);
  }

  @Post("leads/capture")
  captureLead(@Body() dto: LeadCaptureDto) {
    return this.saasService.captureLead(dto);
  }

  @Post("newsletter/signup")
  newsletterSignup(@Body() dto: NewsletterSignupDto) {
    return this.saasService.newsletterSignup(dto);
  }

  @Get("blog")
  blog(
    @Query("category") category?: string,
    @Query("tag") tag?: string,
    @Query("q") q?: string
  ) {
    return this.saasService.listPublicBlogPosts({ category, tag, q });
  }

  @Get("blog/:slug")
  blogBySlug(@Param("slug") slug: string) {
    return this.saasService.getPublicBlogPost(slug);
  }
}
