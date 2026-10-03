import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

/**
 * The two shapes a browser sends a Content-Security-Policy violation in: the legacy
 * `report-uri` body (`{ "csp-report": { … } }`, `application/csp-report`) and the
 * Reporting API's list (`[{ type: "csp-violation", body: { … } }]`). Only the fields
 * this service reads are declared; anything else in the body is dropped on parse.
 */
const legacy = z.object({
  'csp-report': z.object({
    'blocked-uri': z.string().max(2048).optional(),
    'effective-directive': z.string().max(128).optional(),
    'violated-directive': z.string().max(256).optional()
  })
});

const modern = z
  .array(
    z.object({
      body: z.object({ blockedURL: z.string().max(2048).optional(), effectiveDirective: z.string().max(128).optional() }),
      type: z.literal('csp-violation')
    })
  )
  .min(1)
  .max(20);

export type CspViolation = { readonly blocked: string; readonly directive: string };

/** Directive names are a closed vocabulary of lowercase words and dashes; anything else is not one. */
const DIRECTIVE = /^[a-z-]{1,40}$/;

/**
 * Turns a blocked address into the part worth reading and nothing more: the origin of a
 * URL, or the keyword the browser uses (`inline`, `eval`, `data`, `blob`, `self`). The path
 * and the query are dropped here, before anything is logged — a blocked URL can carry a
 * token in its query.
 */
export function blockedOrigin(raw: string | undefined): string {
  if (!raw) {
    return 'unknown';
  }

  try {
    const url = new URL(raw);

    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : url.protocol.replace(/:$/, '');
  } catch {
    return /^[a-z-]{1,20}$/.test(raw) ? raw : 'unknown';
  }
}

/**
 * Report-only CSP violations (project 011, phase 9).
 *
 * Logs the directive and the blocked origin — never the document URL, a query string or the
 * client address — and keeps nothing: the log line is the record, read by whoever decides
 * to enforce the policy.
 */
@Injectable()
export class CspReportService {
  private readonly logger = new Logger(CspReportService.name);

  record(body: unknown): void {
    const violations = this.parse(body);

    for (const violation of violations) {
      this.logger.warn(`csp-report directive=${violation.directive} blocked=${violation.blocked}`);
    }
  }

  parse(body: unknown): readonly CspViolation[] {
    const old = legacy.safeParse(body);

    if (old.success) {
      const report = old.data['csp-report'];

      return [toViolation(report['effective-directive'] ?? report['violated-directive'], report['blocked-uri'])];
    }

    const next = modern.safeParse(body);

    if (next.success) {
      return next.data.map(({ body: report }) => toViolation(report.effectiveDirective, report.blockedURL));
    }

    throw new BadRequestException({ code: 'INVALID_REPORT', message: 'Not a CSP report', statusCode: 400 });
  }
}

function toViolation(directive: string | undefined, blocked: string | undefined): CspViolation {
  const name = directive?.split(' ')[0] ?? '';

  return { blocked: blockedOrigin(blocked), directive: DIRECTIVE.test(name) ? name : 'unknown' };
}
