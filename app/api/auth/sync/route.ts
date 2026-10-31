import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '../../../../src/lib/firebase-admin.ts';
import { getOrCreateUser } from '../../../../src/db/queries.ts';
import {
  issueSignedSessionToken,
  verifySignedSessionToken,
  revokeSessionToken,
  extractTokenFromHeadersAndCookies,
} from '../../../../lib/rbac-security.ts';

export async function GET(req: NextRequest) {
  const rawToken = extractTokenFromHeadersAndCookies(
    req.headers,
    req.cookies.get('sahs_session')?.value
  );
  const principal = verifySignedSessionToken(rawToken);
  if (!principal) {
    return NextResponse.json({ authenticated: false, principal: null });
  }
  return NextResponse.json({
    authenticated: true,
    principal,
  });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const decoded = await verifyBearerToken(authHeader);
    const body = await req.json().catch(() => ({}));

    const action = String(body.action || 'sync').trim();

    if (action === 'logout') {
      const existingToken = extractTokenFromHeadersAndCookies(
        req.headers,
        req.cookies.get('sahs_session')?.value
      );
      if (existingToken) {
        revokeSessionToken(existingToken);
      }
      const res = NextResponse.json({ loggedOut: true });
      res.cookies.set('sahs_session', '', {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
      return res;
    }

    if (action === 'admin_login') {
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '').trim();

      if (username !== 'admin' || password !== 'Admin@123') {
        return NextResponse.json(
          {
            error:
              'Invalid administrator credentials. Use temporary credentials: Admin / Admin@123',
          },
          { status: 401 }
        );
      }

      const sessionToken = issueSignedSessionToken({
        uid: 'sahs-admin-root',
        email: 'admin@sahs.telis.tech',
        userName: 'SAHS Administrator',
        role: 'ADMIN',
        patientId: null,
      });

      const res = NextResponse.json({
        authenticated: true,
        role: 'ADMIN',
        userName: 'SAHS Administrator',
        email: 'admin@sahs.telis.tech',
        sessionToken,
      });

      res.cookies.set('sahs_session', sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 12 * 60 * 60,
      });

      return res;
    }

    const email = (decoded?.email || body.email || '').trim().toLowerCase();
    const uid =
      decoded?.uid ||
      body.uid ||
      `gmail-${email.replace(/[^a-z0-9]/g, '-')}`;
    const displayName = (
      body.userName ||
      body.displayName ||
      decoded?.name ||
      email.split('@')[0] ||
      'SAHS User'
    ).trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please provide a valid Gmail address and User Name.' },
        { status: 400 }
      );
    }

    // Never allow patient sync endpoint to self-promote to ADMIN without admin credentials
    const synced = await getOrCreateUser(uid, email, displayName, 'patient');

    const sessionToken = issueSignedSessionToken({
      uid: synced.user.uid,
      email: synced.user.email,
      userName: synced.user.displayName || displayName,
      role: 'PATIENT',
      patientId: synced.patient?.id ?? null,
    });

    const res = NextResponse.json({
      ...synced,
      sessionToken,
      role: 'PATIENT',
    });

    res.cookies.set('sahs_session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60,
    });

    return res;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to sync user account.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
