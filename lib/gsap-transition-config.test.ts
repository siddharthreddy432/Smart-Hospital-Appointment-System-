import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAHS_NAV_ROUTES,
  normalizeRoutePath,
  getRouteIndex,
  getRouteMeta,
  computeTransitionDirection,
  getTransitionTimings,
} from './gsap-transition-config';

test('SAHS_NAV_ROUTES contains all 7 required persistent navigation routes', () => {
  const labels = SAHS_NAV_ROUTES.map((r) => r.label);
  assert.deepEqual(labels, [
    'Home',
    'Doctors',
    'Schedules',
    'Appointments & QR',
    'Patients',
    'Symptom Booking',
    'No-Show AI',
  ]);
});

test('normalizeRoutePath strips query strings and trailing slashes cleanly', () => {
  assert.equal(normalizeRoutePath('/doctors/?specialty=Cardiology'), '/doctors');
  assert.equal(normalizeRoutePath('/book?doctorId=2'), '/book');
  assert.equal(normalizeRoutePath('/'), '/');
  assert.equal(normalizeRoutePath(''), '/');
});

test('computeTransitionDirection resolves forward, backward, and neutral scene directions', () => {
  assert.equal(computeTransitionDirection('/', '/doctors'), 'forward');
  assert.equal(computeTransitionDirection('/doctors', '/schedules'), 'forward');
  assert.equal(computeTransitionDirection('/schedules', '/appointments'), 'forward');
  assert.equal(computeTransitionDirection('/appointments', '/patients'), 'forward');
  assert.equal(computeTransitionDirection('/patients', '/book'), 'forward');
  assert.equal(computeTransitionDirection('/book', '/predictor'), 'forward');
  assert.equal(computeTransitionDirection('/predictor', '/doctors'), 'backward');
  assert.equal(computeTransitionDirection('/doctors', '/'), 'backward');
  assert.equal(computeTransitionDirection('/doctors', '/doctors'), 'neutral');
});

test('getTransitionTimings respects prefers-reduced-motion accessibility flag', () => {
  const reduced = getTransitionTimings(true, 'forward');
  assert.equal(reduced.isReducedMotion, true);
  assert.equal(reduced.headingOffsetY, 0);
  assert.equal(reduced.cardOffsetY, 0);
  assert.equal(reduced.staggerStep, 0);

  const forward = getTransitionTimings(false, 'forward');
  assert.equal(forward.isReducedMotion, false);
  assert.ok(forward.headingOffsetY > 0);
  assert.equal(forward.curtainEnterFromYPercent, 100);
  assert.equal(forward.curtainExitToYPercent, -100);

  const backward = getTransitionTimings(false, 'backward');
  assert.ok(backward.headingOffsetY < 0);
  assert.equal(backward.curtainEnterFromYPercent, -100);
  assert.equal(backward.curtainExitToYPercent, 100);
});

test('getRouteMeta returns accurate scene metadata for routes', () => {
  const bookMeta = getRouteMeta('/book?doctorId=1');
  assert.equal(bookMeta.label, 'Symptom Booking');
  const loginMeta = getRouteMeta('/login');
  assert.equal(loginMeta.href, '/login');
});
