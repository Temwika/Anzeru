import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { customerCreateSchema, CustomerCreateInput, documentTypeSchema, kycDecisionSchema } from '@anzelu/contracts';
import type { Response } from 'express';
import { AuthUser, CurrentUser, RequirePermissions } from '../common/auth';
import { ZodPipe } from '../common/http';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('customers:read')
  list(@CurrentUser() user: AuthUser, @Query() q: Record<string, string>) {
    return this.customers.list(user, q);
  }

  @Post()
  @RequirePermissions('customers:write')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(customerCreateSchema)) body: CustomerCreateInput, @Ip() ip: string) {
    return this.customers.create(user, body, ip);
  }

  @Get(':id')
  @RequirePermissions('customers:read')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.customers.get(user, id);
  }

  @Post(':id/kyc')
  @RequirePermissions('customers:verify')
  kyc(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(kycDecisionSchema)) body: { status: 'verified' | 'rejected'; note?: string },
  ) {
    return this.customers.decideKyc(user, id, body.status, body.note);
  }

  @Post(':id/documents')
  @RequirePermissions('customers:write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(documentTypeSchema)) body: { docType: 'nrc' },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.customers.addDocument(user, id, body.docType, file);
  }

  @Get(':id/documents/:docId')
  @RequirePermissions('customers:read')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Res() res: Response,
  ) {
    const doc = await this.customers.getDocument(user, id, docId);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName.replace(/"/g, '')}"`);
    res.sendFile(doc.path);
  }
}
