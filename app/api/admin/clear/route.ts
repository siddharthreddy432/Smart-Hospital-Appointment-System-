import { NextRequest, NextResponse } from 'next/server';
import { clearAllHospitalData } from '../../../../src/db/queries.ts';
import {
  extractTokenFromHeadersAndCookies,
  verifySignedSessionToken,
  requireAdminAccess,
} from '../../../../lib/rbac-security.ts';

export async function POST(req: NextRequest) {
  try {
    const rawToken = extractTokenFromHeadersAndCookies(
      req.headers,
      req.cookies.get('sahs_session')?.value
    );
    const principal = verifySignedSessionToken(rawToken);
    const adminCheck = requireAdminAccess(principal);
    if (!adminCheck.allowed) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const res = await clearAllHospitalData();
    return NextResponse.json(res);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to clear data.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
