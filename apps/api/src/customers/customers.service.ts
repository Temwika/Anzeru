import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerCreateInput, DocumentType, KycStatus } from '@anzelu/contracts';
import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assertBranchAccess, AuthUser, scope, tenantOf } from '../common/auth';
import { BusinessRuleError, Paged, paging } from '../common/http';
import { AuditService } from '../core/audit.service';
import { NumberingService } from '../core/numbering.service';
import { DB, InjectDb } from '../db/database';
import { branches, customerDocuments, customers, loans } from '../db/schema';

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
export const storageRoot = () => resolve(process.env.DOCUMENT_STORAGE_DIR ?? join(process.cwd(), 'storage'));

@Injectable()
export class CustomersService {
  constructor(
    @InjectDb() private readonly db: DB,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, q: { search?: string; kyc?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, offset } = paging(q);
    const conditions = [scope(user, customers.tenantId, customers.branchId)];
    if (q.search) {
      const term = `%${q.search.trim()}%`;
      conditions.push(
        or(
          ilike(customers.firstName, term),
          ilike(customers.lastName, term),
          ilike(customers.nrc, term),
          ilike(customers.phone, term),
          ilike(customers.customerNumber, term),
          ilike(sql`${customers.firstName} || ' ' || ${customers.lastName}`, term),
        )!,
      );
    }
    if (q.kyc) conditions.push(eq(customers.kycStatus, q.kyc as KycStatus));
    const where = and(...conditions);
    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select({
          id: customers.id,
          customerNumber: customers.customerNumber,
          firstName: customers.firstName,
          lastName: customers.lastName,
          nrc: customers.nrc,
          phone: customers.phone,
          kycStatus: customers.kycStatus,
          branchName: branches.name,
          createdAt: customers.createdAt,
          activeLoans: sql<number>`(SELECT count(*)::int FROM ${loans} WHERE ${loans.customerId} = ${customers.id} AND ${loans.status} = 'active')`,
        })
        .from(customers)
        .innerJoin(branches, eq(customers.branchId, branches.id))
        .where(where)
        .orderBy(desc(customers.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)::int` }).from(customers).where(where),
    ]);
    return new Paged(rows, count, page, pageSize);
  }

  async get(user: AuthUser, id: string) {
    const [row] = await this.db
      .select({ customer: customers, branchName: branches.name })
      .from(customers)
      .innerJoin(branches, eq(customers.branchId, branches.id))
      .where(and(eq(customers.id, id), scope(user, customers.tenantId, customers.branchId)));
    if (!row) throw new NotFoundException('Customer not found');
    const c = row.customer;
    const [documents, customerLoans, possibleDuplicates] = await Promise.all([
      this.db
        .select({
          id: customerDocuments.id,
          docType: customerDocuments.docType,
          fileName: customerDocuments.fileName,
          sizeBytes: customerDocuments.sizeBytes,
          createdAt: customerDocuments.createdAt,
        })
        .from(customerDocuments)
        .where(and(eq(customerDocuments.customerId, id), eq(customerDocuments.tenantId, c.tenantId)))
        .orderBy(desc(customerDocuments.createdAt)),
      this.db
        .select({ id: loans.id, loanNumber: loans.loanNumber, principal: loans.principal, status: loans.status, disbursedOn: loans.disbursedOn })
        .from(loans)
        .where(and(eq(loans.customerId, id), eq(loans.tenantId, c.tenantId)))
        .orderBy(desc(loans.createdAt)),
      this.db
        .select({ id: customers.id, customerNumber: customers.customerNumber, firstName: customers.firstName, lastName: customers.lastName })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, c.tenantId),
            ne(customers.id, id),
            or(eq(customers.phone, c.phone), and(eq(customers.lastName, c.lastName), eq(customers.dateOfBirth, c.dateOfBirth))),
          ),
        ),
    ]);
    return { ...c, branchName: row.branchName, documents, loans: customerLoans, possibleDuplicates };
  }

  async create(user: AuthUser, input: CustomerCreateInput, ip?: string) {
    const tenantId = tenantOf(user);
    assertBranchAccess(user, input.branchId);
    const [branch] = await this.db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenantId)));
    if (!branch) throw new BusinessRuleError('INVALID_BRANCH', 'Select a branch of your institution');

    const [existing] = await this.db
      .select({ customerNumber: customers.customerNumber })
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.nrc, input.nrc)));
    if (existing) throw new ConflictException({ code: 'DUPLICATE_NRC', message: `NRC ${input.nrc} is already registered to ${existing.customerNumber}` });

    const age = (Date.now() - Date.parse(input.dateOfBirth)) / (365.25 * 86_400_000);
    if (!(age >= 18 && age <= 100)) throw new BusinessRuleError('INVALID_AGE', 'Customers must be at least 18 years old');

    return this.db.transaction(async (tx) => {
      const { consent: _consent, ...fields } = input;
      const [created] = await tx
        .insert(customers)
        .values({
          ...fields,
          tenantId,
          customerNumber: await this.numbering.next(tx, tenantId, 'customer'),
          consentAt: new Date(),
          createdBy: user.id,
        })
        .returning();
      const duplicatesByPhone = await tx
        .select({ customerNumber: customers.customerNumber })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.phone, input.phone), ne(customers.id, created.id)));
      await this.audit.record(tx, {
        tenantId,
        userId: user.id,
        action: 'customer.created',
        entityType: 'customer',
        entityId: created.id,
        data: { customerNumber: created.customerNumber, branchId: input.branchId },
        ip,
      });
      return {
        ...created,
        warnings: duplicatesByPhone.length
          ? [`Phone number is also used by ${duplicatesByPhone.map((d) => d.customerNumber).join(', ')}`]
          : [],
      };
    });
  }

  async decideKyc(user: AuthUser, id: string, status: Exclude<KycStatus, 'pending'>, note?: string) {
    const c = await this.get(user, id);
    if (status === 'verified' && c.documents.length === 0) {
      throw new BusinessRuleError('KYC_DOCUMENTS_MISSING', 'Upload at least one identity document before verifying KYC');
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(customers)
        .set({ kycStatus: status, kycNote: note ?? null, kycDecidedBy: user.id })
        .where(and(eq(customers.id, id), eq(customers.tenantId, c.tenantId)));
      await this.audit.record(tx, {
        tenantId: c.tenantId,
        userId: user.id,
        action: `customer.kyc_${status}`,
        entityType: 'customer',
        entityId: id,
        data: { note },
      });
    });
    return { id, kycStatus: status };
  }

  async addDocument(user: AuthUser, customerId: string, docType: DocumentType, file?: Express.Multer.File) {
    const c = await this.get(user, customerId);
    return this.storeDocument(c.tenantId, customerId, user.id, docType, file);
  }

  /** Saves an upload for a customer the caller has already been authorised for (staff scope or the borrower themselves). */
  async storeDocument(tenantId: string, customerId: string, uploadedBy: string, docType: DocumentType, file?: Express.Multer.File) {
    if (!file) throw new BusinessRuleError('FILE_REQUIRED', 'Attach a file');
    if (!ALLOWED_MIME.includes(file.mimetype)) throw new BusinessRuleError('FILE_TYPE', 'Upload a PDF, JPEG or PNG file');
    // Stored privately under an opaque key; only served through the authorised download endpoint.
    const key = join(tenantId, randomUUID());
    mkdirSync(join(storageRoot(), tenantId), { recursive: true });
    writeFileSync(join(storageRoot(), key), file.buffer);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    return this.db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(customerDocuments)
        .values({
          tenantId,
          customerId,
          docType,
          fileName: file.originalname.slice(0, 200),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey: key,
          sha256,
          uploadedBy,
        })
        .returning({ id: customerDocuments.id, fileName: customerDocuments.fileName, docType: customerDocuments.docType });
      await this.audit.record(tx, {
        tenantId,
        userId: uploadedBy,
        action: 'customer.document_uploaded',
        entityType: 'customer',
        entityId: customerId,
        data: { documentId: doc.id, docType, sha256 },
      });
      return doc;
    });
  }

  async getDocument(user: AuthUser, customerId: string, docId: string) {
    await this.get(user, customerId);
    const [doc] = await this.db
      .select()
      .from(customerDocuments)
      .where(and(eq(customerDocuments.id, docId), eq(customerDocuments.customerId, customerId), eq(customerDocuments.tenantId, tenantOf(user))));
    if (!doc) throw new NotFoundException('Document not found');
    return { ...doc, path: join(storageRoot(), doc.storageKey) };
  }
}
