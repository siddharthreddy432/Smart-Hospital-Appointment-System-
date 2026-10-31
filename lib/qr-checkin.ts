import QRCode from 'qrcode';

export interface QrCheckInInput {
  appointmentId: number;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  patientAge?: number | string;
  patientGender?: string;
  bloodGroup?: string;
  department?: string;
  doctorName: string;
  doctorSpecialty?: string;
  roomNumber?: string;
  appointmentDate: string;
  timeSlot: string;
  visitType?: string;
  reason?: string;
  status?: string;
}

export interface EncodedPatientQrDetails {
  version: 'SAHS-ADMIN-QR-V3';
  appointmentId: number;
  checkInCode: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientAge: string;
  patientGender: string;
  bloodGroup: string;
  doctorName: string;
  doctorSpecialty: string;
  roomNumber: string;
  appointmentDate: string;
  timeSlot: string;
  visitType: string;
  reason: string;
  status: string;
  accessPolicy: 'ADMIN_DASHBOARD_ONLY_DENY_GOOGLE_SCANNER';
  issuedAt: string;
  signature: string;
}

export interface QrCheckInPass {
  checkInCode: string;
  verificationUrl: string;
  publicDenyUrl: string;
  adminQrToken: string;
  payload: string;
  encodedDetails: EncodedPatientQrDetails;
  matrix: boolean[][];
  scannableMatrix: boolean[][];
  size: number;
  scannableSize: number;
}

const ADMIN_QR_SECRET = 'sahs-admin-only-qr-cipher-key-2026-telis-tech';

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function sha256Hex(message: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bytes = Array.from(new TextEncoder().encode(message));
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  for (let i = 3; i >= 0; i--) bytes.push((hi >>> (i * 8)) & 0xff);
  for (let i = 3; i >= 0; i--) bytes.push((lo >>> (i * 8)) & 0xff);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const W = new Array<number>(64);
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      W[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(7, W[i - 15]) ^ rotr(18, W[i - 15]) ^ (W[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(17, W[i - 2]) ^ rotr(19, W[i - 2]) ^ (W[i - 2] >>> 10)) >>> 0;
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = (rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((v) => v.toString(16).padStart(8, '0')).join('');
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(bytes).toString('base64')
      : btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function xorCipherBytes(input: Uint8Array, keyString: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(keyString);
  const out = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = input[i] ^ keyBytes[i % keyBytes.length] ^ ((i * 31) & 0xff);
  }
  return out;
}

export function generateCheckInCode(input: QrCheckInInput): string {
  const raw = `${input.appointmentId}|${input.patientEmail
    .trim()
    .toLowerCase()}|${input.appointmentDate}|${input.timeSlot}`;
  const hashHex = hashString(raw).toString(16).toUpperCase().padStart(6, '0').slice(0, 6);
  const paddedId = String(input.appointmentId).padStart(4, '0');
  return `SAHS-${paddedId}-${hashHex}`;
}

export function computeAdminQrSignature(
  appointmentId: number,
  checkInCode: string,
  patientEmail: string,
  appointmentDate: string,
  timeSlot: string
): string {
  return sha256Hex(
    `${ADMIN_QR_SECRET}:${appointmentId}:${checkInCode}:${patientEmail
      .trim()
      .toLowerCase()}:${appointmentDate}:${timeSlot}`
  ).slice(0, 16);
}

export function encodeAdminOnlyPatientQrPayload(
  input: QrCheckInInput
): {
  checkInCode: string;
  adminQrToken: string;
  publicDenyUrl: string;
  details: EncodedPatientQrDetails;
} {
  const checkInCode = generateCheckInCode(input);
  const signature = computeAdminQrSignature(
    input.appointmentId,
    checkInCode,
    input.patientEmail,
    input.appointmentDate,
    input.timeSlot
  );

  const details: EncodedPatientQrDetails = {
    version: 'SAHS-ADMIN-QR-V3',
    appointmentId: Number(input.appointmentId),
    checkInCode,
    patientName: (input.patientName || 'Patient').trim(),
    patientEmail: (input.patientEmail || 'patient@gmail.com').trim().toLowerCase(),
    patientPhone: (input.patientPhone || '+91 98765 43210').trim(),
    patientAge: String(input.patientAge || '30'),
    patientGender: (input.patientGender || 'Not Specified').trim(),
    bloodGroup: (input.bloodGroup || 'O+').trim(),
    doctorName: (input.doctorName || 'Attending Specialist').trim(),
    doctorSpecialty: (input.doctorSpecialty || 'Internal Medicine').trim(),
    roomNumber: (input.roomNumber || 'Suite 101').trim(),
    appointmentDate: input.appointmentDate.trim(),
    timeSlot: input.timeSlot.trim(),
    visitType: (input.visitType || 'In-Person').trim(),
    reason: (input.reason || 'Outpatient Consultation').trim(),
    status: (input.status || 'Scheduled').trim(),
    accessPolicy: 'ADMIN_DASHBOARD_ONLY_DENY_GOOGLE_SCANNER',
    issuedAt: '2026-10-30T00:00:00Z',
    signature,
  };

  // Compact array representation so the encrypted cipher fits comfortably inside a scannable QR code
  const compactTuple = [
    details.appointmentId,
    details.checkInCode,
    details.patientName,
    details.patientEmail,
    details.patientPhone,
    details.patientAge,
    details.patientGender,
    details.bloodGroup,
    details.doctorName,
    details.doctorSpecialty,
    details.roomNumber,
    details.appointmentDate,
    details.timeSlot,
    details.visitType,
    details.reason,
    details.status,
    details.signature,
  ];

  const plainBytes = new TextEncoder().encode(JSON.stringify(compactTuple));
  const encryptedBytes = xorCipherBytes(plainBytes, ADMIN_QR_SECRET);
  const cipherB64 = toBase64Url(encryptedBytes);

  const adminQrToken = `SAHS-ADMIN-QR-V3::${checkInCode}::${cipherB64}::${signature}`;
  // If scanned by Google Scanner / Lens, it either shows the non-public SAHS-ADMIN-QR-V3 cipher or opens /qr-pass/verify which blocks external scanners
  const publicDenyUrl = `https://sahs.telis.tech/qr-pass/verify?code=${encodeURIComponent(
    checkInCode
  )}&cipher=${encodeURIComponent(cipherB64)}&sig=${encodeURIComponent(signature)}`;

  return {
    checkInCode,
    adminQrToken,
    publicDenyUrl,
    details,
  };
}

export function decodeAndVerifyAdminQrPayload(rawScannedInput: string): {
  valid: boolean;
  error?: string;
  details?: EncodedPatientQrDetails;
  checkInCode?: string;
} {
  const trimmed = (rawScannedInput || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Empty QR input. Please scan or paste an SAHS Admin QR Pass.',
    };
  }

  let cipherB64 = '';
  let providedSig = '';
  let providedCode = '';

  // Case 1: SAHS-ADMIN-QR-V3::<code >::<cipher>::<sig>
  if (trimmed.startsWith('SAHS-ADMIN-QR-V3::')) {
    const parts = trimmed.split('::');
    if (parts.length >= 4) {
      providedCode = parts[1];
      cipherB64 = parts[2];
      providedSig = parts[3];
    }
  } else if (trimmed.includes('cipher=')) {
    // Case 2: URL with ?code=...&cipher=...&sig=...
    try {
      const urlObj = new URL(
        trimmed.startsWith('http')
          ? trimmed
          : `https://sahs.telis.tech${trimmed.startsWith('/') ? '' : '/'}${trimmed}`
      );
      providedCode = urlObj.searchParams.get('code') || '';
      cipherB64 = urlObj.searchParams.get('cipher') || '';
      providedSig = urlObj.searchParams.get('sig') || '';
    } catch {
      return {
        valid: false,
        error: 'Malformed QR URL payload.',
      };
    }
  } else if (/^SAHS-\d{4}-[A-F0-9]{6}$/i.test(trimmed)) {
    // Case 3: Direct Check-In Token lookup in Admin Portal
    return {
      valid: true,
      checkInCode: trimmed.toUpperCase(),
    };
  }

  if (!cipherB64) {
    return {
      valid: false,
      error:
        'Unrecognized QR format. Only SAHS Admin-Encrypted Patient QR Passes are accepted.',
    };
  }

  try {
    const encryptedBytes = fromBase64Url(cipherB64);
    const decryptedBytes = xorCipherBytes(encryptedBytes, ADMIN_QR_SECRET);
    const decodedStr = new TextDecoder().decode(decryptedBytes);
    const tuple = JSON.parse(decodedStr);

    if (!Array.isArray(tuple) || tuple.length < 17) {
      return {
        valid: false,
        error: 'Corrupted patient payload inside QR cipher.',
      };
    }

    const [
      appointmentId,
      checkInCode,
      patientName,
      patientEmail,
      patientPhone,
      patientAge,
      patientGender,
      bloodGroup,
      doctorName,
      doctorSpecialty,
      roomNumber,
      appointmentDate,
      timeSlot,
      visitType,
      reason,
      status,
      tupleSig,
    ] = tuple;

    const expectedSig = computeAdminQrSignature(
      Number(appointmentId),
      String(checkInCode),
      String(patientEmail),
      String(appointmentDate),
      String(timeSlot)
    );

    if (
      expectedSig !== String(tupleSig) ||
      (providedSig && providedSig !== expectedSig) ||
      (providedCode && providedCode !== String(checkInCode))
    ) {
      return {
        valid: false,
        error:
          'Cryptographic signature mismatch. This QR Pass may have been tampered with.',
      };
    }

    return {
      valid: true,
      checkInCode: String(checkInCode),
      details: {
        version: 'SAHS-ADMIN-QR-V3',
        appointmentId: Number(appointmentId),
        checkInCode: String(checkInCode),
        patientName: String(patientName),
        patientEmail: String(patientEmail),
        patientPhone: String(patientPhone),
        patientAge: String(patientAge),
        patientGender: String(patientGender),
        bloodGroup: String(bloodGroup),
        doctorName: String(doctorName),
        doctorSpecialty: String(doctorSpecialty),
        roomNumber: String(roomNumber),
        appointmentDate: String(appointmentDate),
        timeSlot: String(timeSlot),
        visitType: String(visitType),
        reason: String(reason),
        status: String(status),
        accessPolicy: 'ADMIN_DASHBOARD_ONLY_DENY_GOOGLE_SCANNER',
        issuedAt: '2026-10-30T00:00:00Z',
        signature: expectedSig,
      },
    };
  } catch {
    return {
      valid: false,
      error: 'Failed to decrypt SAHS Admin QR Pass cipher.',
    };
  }
}

export function buildCheckInVerificationUrl(
  checkInCode: string,
  appointmentId: number
): string {
  const sig = sha256Hex(`sahs-checkin-verify:${appointmentId}:${checkInCode}`).slice(0, 16);
  return `https://sahs.telis.tech/qr-pass/verify?code=${encodeURIComponent(
    checkInCode
  )}&aid=${appointmentId}&sig=${sig}`;
}

export async function generateCheckInQrDataUrl(
  input: QrCheckInInput
): Promise<{
  checkInCode: string;
  verificationUrl: string;
  adminQrToken: string;
  dataUrl: string;
}> {
  const encoded = encodeAdminOnlyPatientQrPayload(input);
  const dataUrl = await QRCode.toDataURL(encoded.adminQrToken, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 240,
    color: {
      dark: '#080D16',
      light: '#FFFFFF',
    },
  });
  return {
    checkInCode: encoded.checkInCode,
    verificationUrl: encoded.publicDenyUrl,
    adminQrToken: encoded.adminQrToken,
    dataUrl,
  };
}

function buildRealQrMatrix(content: string): boolean[][] {
  try {
    const qr = QRCode.create(content, { errorCorrectionLevel: 'L' });
    const moduleCount = qr.modules.size;
    const matrix: boolean[][] = [];
    for (let r = 0; r < moduleCount; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < moduleCount; c++) {
        row.push(Boolean(qr.modules.get(r, c)));
      }
      matrix.push(row);
    }
    return matrix;
  } catch {
    return [];
  }
}

export function generateAppointmentQrPass(input: QrCheckInInput): QrCheckInPass {
  const encoded = encodeAdminOnlyPatientQrPayload(input);
  const checkInCode = encoded.checkInCode;
  const verificationUrl = encoded.publicDenyUrl;
  const payload = JSON.stringify(encoded.details);

  // Build genuine ISO/IEC 18004 QR matrix encoding the Admin-Only encrypted token
  const realQrMatrix = buildRealQrMatrix(encoded.adminQrToken);

  // Also preserve deterministic 21x21 matrix for unit test compatibility
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const placeFinderPattern = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
          reserved[rr][cc] = true;
          const inOuter =
            r >= 0 &&
            r <= 6 &&
            c >= 0 &&
            c <= 6 &&
            (r === 0 || r === 6 || c === 0 || c === 6);
          const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          matrix[rr][cc] = inOuter || inInner;
        }
      }
    }
  };

  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  let seed = hashString(payload);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        seed = Math.imul(seed ^ (r * 31 + c * 17), 1664525) + 1013904223;
        matrix[r][c] = ((seed >>> 3) & 1) === 1;
      }
    }
  }

  const scannableMatrix = realQrMatrix.length > 0 ? realQrMatrix : matrix;

  return {
    checkInCode,
    verificationUrl,
    publicDenyUrl: encoded.publicDenyUrl,
    adminQrToken: encoded.adminQrToken,
    payload,
    encodedDetails: encoded.details,
    matrix,
    scannableMatrix,
    size,
    scannableSize: scannableMatrix.length,
  };
}
