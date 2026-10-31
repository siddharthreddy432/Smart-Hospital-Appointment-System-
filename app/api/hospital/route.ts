import { NextRequest, NextResponse } from 'next/server';
import { getScopedHospitalData } from '../../../src/db/queries.ts';
import {
  extractTokenFromHeadersAndCookies,
  verifySignedSessionToken,
} from '../../../lib/rbac-security.ts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawToken = extractTokenFromHeadersAndCookies(
      req.headers,
      req.cookies.get('sahs_session')?.value
    );
    const principal = verifySignedSessionToken(rawToken);
    const data = await getScopedHospitalData(principal);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch hospital data.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
