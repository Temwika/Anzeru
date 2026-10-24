import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Post, Put, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApplicationCreateInput, applicationCreateSchema, applicationDocumentSchema, decisionSchema, guarantorSignatureSchema } from "@anzelu/contracts";
import type { Response } from "express";
import { AuthUser, CurrentUser, RequirePermissions } from "../common/auth";
import { ZodPipe } from "../common/http";
import { ApplicationsService } from "./applications.service";

@Controller("applications")
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  @RequirePermissions("applications:read")
  list(@CurrentUser() user: AuthUser, @Query() q: Record<string, string>) {
    return this.applications.list(user, q);
  }

  @Post()
  @RequirePermissions("applications:write")
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(applicationCreateSchema)) body: ApplicationCreateInput, @Ip() ip: string) {
    return this.applications.create(user, body, ip);
  }

  @Get(":id")
  @RequirePermissions("applications:read")
  get(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.applications.get(user, id);
  }

  @Post(":id/decisions")
  @RequirePermissions("applications:decide")
  decide(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(decisionSchema)) body: { decision: "approve" | "reject"; reason: string },
    @Ip() ip: string,
  ) {
    return this.applications.decide(user, id, body.decision, body.reason, ip);
  }

  @Post(":id/documents")
  @RequirePermissions("applications:write")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  addDocument(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(applicationDocumentSchema))
    body: { docType: "guarantor_nrc_front" | "guarantor_nrc_back" | "collateral_photo"; guarantorId?: string; collateralId?: string },
    @UploadedFile() file: Express.Multer.File,
    @Ip() ip: string,
  ) {
    return this.applications.addDocument(user, id, body, file, ip);
  }

  @Get(":id/documents/:docId")
  @RequirePermissions("applications:read")
  async document(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string, @Param("docId", ParseUUIDPipe) docId: string, @Res() res: Response) {
    const doc = await this.applications.getDocument(user, id, docId);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${doc.fileName.replace(/"/g, "")}"`);
    res.sendFile(doc.path);
  }

  @Put(":id/guarantors/:guarantorId/signature")
  @RequirePermissions("applications:write")
  sign(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("guarantorId", ParseUUIDPipe) guarantorId: string,
    @Body(new ZodPipe(guarantorSignatureSchema)) body: { signature: string },
    @Ip() ip: string,
  ) {
    return this.applications.signGuarantor(user, id, guarantorId, body.signature, ip);
  }
}
