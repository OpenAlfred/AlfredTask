import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/features/auth/auth';
import { prisma } from '@/features/shared/data-access/prisma';

export const dynamic = 'force-dynamic';

/*
 * Single sign-on from AlfredDashboard. The dashboard sends its signed-in user here with a token
 * that is valid for two minutes: the claims ({ email, name, exp }) as base64url JSON, a dot, and
 * their HMAC-SHA256 in base64url, keyed with OPENALFRED_SSO_SECRET. Both apps need the same secret.
 * A valid token opens a Better Auth session for the account with that email address. An account
 * that doesn't exist yet is created, even when DISABLE_SIGNUP closes the sign-up page: whoever the
 * dashboard signs in may use the app.
 */

const DEFAULT_PATH = '/app/today';
const MAX_NAME_LENGTH = 500;

const errorResponse = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

const isSameSignature = (provided: string, expected: string) => {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);

  return (
    providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
  );
};

const parseClaims = (payload: string) => {
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims === 'object' && claims !== null
      ? (claims as { email?: unknown; name?: unknown; exp?: unknown })
      : null;
  } catch {
    return null;
  }
};

/*
 * Behind a reverse proxy (tailscale serve, Caddy) the request reaches the app as plain HTTP on an
 * internal address, so the public address comes from BETTER_AUTH_URL. Only paths within the app
 * are followed.
 */
const getRedirectTarget = (request: NextRequest) => {
  const origin = new URL(process.env.BETTER_AUTH_URL?.trim() || request.nextUrl.origin).origin;
  const next = request.nextUrl.searchParams.get('next');

  if (next?.startsWith('/')) {
    const target = new URL(next, origin);
    if (target.origin === origin) return target;
  }

  return new URL(DEFAULT_PATH, origin);
};

export async function GET(request: NextRequest) {
  const secret = process.env.OPENALFRED_SSO_SECRET?.trim();
  if (!secret) {
    return errorResponse(
      503,
      'Single sign-on is not set up. Set OPENALFRED_SSO_SECRET to the value AlfredDashboard uses.',
    );
  }

  const token = request.nextUrl.searchParams.get('token') ?? '';
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) {
    return errorResponse(400, 'Invalid sign-on token.');
  }

  const expectedSignature = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!isSameSignature(signature, expectedSignature)) {
    return errorResponse(401, 'Invalid sign-on signature.');
  }

  const claims = parseClaims(payload);
  const email = typeof claims?.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (!email) return errorResponse(400, 'Invalid sign-on token.');

  // The dashboard sends seconds since the epoch, like a JWT. Milliseconds are accepted too.
  const exp = typeof claims?.exp === 'number' ? claims.exp : 0;
  if (Date.now() > (exp < 1e12 ? exp * 1000 : exp)) {
    return errorResponse(401, 'The sign-on token has expired.');
  }

  const name =
    (typeof claims?.name === 'string' ? claims.name.trim().slice(0, MAX_NAME_LENGTH) : '') ||
    email.split('@')[0];

  const user =
    (await prisma.user.findUnique({ where: { email }, select: { id: true } })) ??
    (await prisma.user.create({
      data: { id: randomUUID(), email, name, emailVerified: true },
      select: { id: true },
    }));

  const context = await getAuth().$context;
  const sessionToken = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + context.sessionConfig.expiresIn * 1000);

  await prisma.session.create({
    data: {
      id: randomUUID(),
      token: sessionToken,
      userId: user.id,
      expiresAt,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: request.headers.get('user-agent'),
    },
  });

  /*
   * Set the cookie Better Auth itself reads, signed the way it signs it (HMAC-SHA256 in base64
   * with its secret). In production and behind HTTPS its name has the __Secure- prefix, so a fixed
   * name would leave the user signed out.
   */
  const { name: cookieName, attributes } = context.authCookies.sessionToken;
  const cookieSignature = createHmac('sha256', context.secret)
    .update(sessionToken)
    .digest('base64');

  const response = NextResponse.redirect(getRedirectTarget(request));
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(cookieName, `${sessionToken}.${cookieSignature}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: Boolean(attributes.secure),
    expires: expiresAt,
  });

  return response;
}
