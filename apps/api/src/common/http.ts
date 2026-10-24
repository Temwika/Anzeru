import {
  ArgumentsHost,
  BadRequestException,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
  NestMiddleware,
  PipeTransform,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { map, Observable } from 'rxjs';
import type { ZodType } from 'zod';

/** Validates a request part against a shared Zod schema from @anzelu/contracts. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: result.error.issues[0]?.message ?? 'Invalid request',
        details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}

/** A business-rule violation (422) with a stable machine-readable code. */
export class BusinessRuleError extends UnprocessableEntityException {
  constructor(code: string, message: string, details?: unknown) {
    super({ code, message, details });
  }
}

/** Marker for paginated results; the envelope interceptor moves paging info into `meta`. */
export class Paged<T> {
  constructor(
    readonly items: T[],
    readonly total: number,
    readonly page: number,
    readonly pageSize: number,
  ) {}
}

export function paging(query: { page?: string; pageSize?: string }) {
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const pageSize = Math.min(200, Math.max(1, Number.parseInt(query.pageSize ?? '25', 10) || 25));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    (req as Request & { requestId: string }).requestId = id;
    res.setHeader('x-request-id', id);
    next();
  }
}

/** Wraps every JSON response as { data, meta: { requestId, ...paging } }. */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { requestId?: string }>();
    return next.handle().pipe(
      map((body) => {
        if (body instanceof Paged) {
          return {
            data: body.items,
            meta: { requestId: req.requestId, page: body.page, pageSize: body.pageSize, total: body.total },
          };
        }
        return { data: body ?? null, meta: { requestId: req.requestId } };
      }),
    );
  }
}

const PG_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  '23505': { status: HttpStatus.CONFLICT, code: 'DUPLICATE', message: 'A record with these details already exists' },
  '23503': { status: HttpStatus.UNPROCESSABLE_ENTITY, code: 'INVALID_REFERENCE', message: 'A referenced record does not exist' },
  '23514': { status: HttpStatus.UNPROCESSABLE_ENTITY, code: 'CONSTRAINT_FAILED', message: 'The change would violate a financial control' },
  P0001: { status: HttpStatus.UNPROCESSABLE_ENTITY, code: 'CONTROL_VIOLATION', message: 'The change was blocked by a financial control' },
};

function pgError(err: unknown): { code?: string; detail?: string; message?: string } | undefined {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    const c = e as { code?: unknown; cause?: unknown };
    if (typeof c.code === 'string' && /^[0-9A-Z]{5}$/.test(c.code)) return c as { code: string };
    e = c.cause;
  }
  return undefined;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = req.requestId ?? randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong. Quote the request ID if you contact support.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body) {
        const b = body as { code?: string; message?: string | string[]; details?: unknown };
        code = b.code ?? HttpStatus[status] ?? 'ERROR';
        message = Array.isArray(b.message) ? b.message.join('; ') : (b.message ?? exception.message);
        details = b.details;
      } else {
        code = HttpStatus[status] ?? 'ERROR';
        message = String(body);
      }
    } else {
      const pg = pgError(exception);
      const mapped = pg?.code ? PG_ERRORS[pg.code] : undefined;
      if (mapped) {
        status = mapped.status;
        code = mapped.code;
        message = pg?.code === 'P0001' && pg.message ? pg.message : mapped.message;
      } else {
        this.logger.error(`[${requestId}] ${req.method} ${req.url}`, exception instanceof Error ? exception.stack : exception);
      }
    }

    res.status(status).json({ error: { code, message, details }, meta: { requestId } });
  }
}
