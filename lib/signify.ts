type SignifyStatus = 'SUCCESS' | 'VALIDATION_WARNING' | 'ERROR';

type SignifyBaseResponse = {
  status: SignifyStatus;
  statusMessage?: string | null;
};

type SignifyAuthResponse = SignifyBaseResponse & {
  accessToken?: string;
  secondsBeforeTokenExpiration?: number;
};

type SignifyCreateDocumentResponse = SignifyBaseResponse & {
  documentId?: number;
};

export type SignifyRecipientContactType = 'EMAIL' | 'MOBILE' | 'LINK';
export type SignifyWorkflowType = 'SERIAL' | 'PARALLEL';
export type SignifySignatureType = 'BASIC' | 'SMS_OTP' | 'SIGN_PAD' | 'QUALIFIED' | 'REMOTE_ID';

export type SignifySignatureField = {
  fileNumber?: number;
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SendSignifyDocumentInput = {
  documentName: string;
  extension?: 'pdf' | 'doc' | 'docx';
  fileBase64: string;
  recipient: {
    name: string;
    email?: string | null;
    mobileNumber?: string | null;
    recipientContactType?: SignifyRecipientContactType;
  };
  signatureField: SignifySignatureField;
  workflowType?: SignifyWorkflowType;
  possibleSignatureTypes?: SignifySignatureType[];
  shareAutomatically?: boolean;
  messageForRecipients?: string;
  xLanguage?: 'en' | 'ka';
  xUserEmail?: string;
};

type CachedToken = {
  value: string;
  expiresAtMs: number;
};

let tokenCache: CachedToken | null = null;

const getBaseUrl = () =>
  (process.env.SIGNIFY_BASE_URL || 'https://portal.signifyapp.com/integration-api/v2').replace(/\/$/, '');

const ensureCredentials = () => {
  const clientId = process.env.SIGNIFY_CLIENT_ID;
  const clientSecret = process.env.SIGNIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Signify credentials are not configured. Set SIGNIFY_CLIENT_ID and SIGNIFY_CLIENT_SECRET.');
  }

  return { clientId, clientSecret };
};

const isSuccess = (response: SignifyBaseResponse) => response.status === 'SUCCESS';

async function postToSignify<T extends SignifyBaseResponse>(
  path: string,
  payload: Record<string, unknown>,
  options?: { token?: string; language?: 'en' | 'ka'; userEmail?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Language': options?.language || 'en',
  };

  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (options?.userEmail) {
    headers['X-User-Email'] = options.userEmail;
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const json = (await response.json().catch(() => ({}))) as T;

  if (!response.ok) {
    throw new Error(json?.statusMessage || `Signify request failed (${response.status})`);
  }

  if (!json || typeof json !== 'object') {
    throw new Error('Invalid Signify response format');
  }

  if (!isSuccess(json)) {
    throw new Error(json.statusMessage || `Signify response status: ${json.status}`);
  }

  return json;
}

export async function getSignifyAccessToken(opts?: { forceRefresh?: boolean; language?: 'en' | 'ka' }) {
  if (!opts?.forceRefresh && tokenCache && Date.now() < tokenCache.expiresAtMs) {
    return tokenCache.value;
  }

  const { clientId, clientSecret } = ensureCredentials();

  const auth = await postToSignify<SignifyAuthResponse>(
    '/authenticate',
    { clientId, clientSecret },
    { language: opts?.language || 'en' }
  );

  if (!auth.accessToken) {
    throw new Error('Signify authentication succeeded but no access token was returned');
  }

  const expiresInSeconds = Number(auth.secondsBeforeTokenExpiration || 3600);
  tokenCache = {
    value: auth.accessToken,
    expiresAtMs: Date.now() + Math.max(30, expiresInSeconds - 30) * 1000,
  };

  return auth.accessToken;
}

export async function createSignifyDocument(input: {
  documentName: string;
  extension: 'pdf' | 'doc' | 'docx';
  fileBase64: string;
  token?: string;
  xLanguage?: 'en' | 'ka';
  xUserEmail?: string;
}) {
  const token = input.token || (await getSignifyAccessToken({ language: input.xLanguage || 'en' }));

  const created = await postToSignify<SignifyCreateDocumentResponse>(
    '/create-document',
    {
      documentName: input.documentName,
      extension: input.extension,
      fileBase64: input.fileBase64,
    },
    { token, language: input.xLanguage || 'en', userEmail: input.xUserEmail }
  );

  if (!created.documentId) {
    throw new Error('Signify did not return documentId from create-document');
  }

  return { documentId: created.documentId, token };
}

export async function setSignifyDocumentDetails(input: {
  documentId: number;
  recipient: {
    name: string;
    email?: string | null;
    mobileNumber?: string | null;
    recipientContactType?: SignifyRecipientContactType;
  };
  signatureField: SignifySignatureField;
  workflowType?: SignifyWorkflowType;
  possibleSignatureTypes?: SignifySignatureType[];
  shareAutomatically?: boolean;
  messageForRecipients?: string;
  token?: string;
  xLanguage?: 'en' | 'ka';
  xUserEmail?: string;
}) {
  const token = input.token || (await getSignifyAccessToken({ language: input.xLanguage || 'en' }));

  const signatureTypes = input.possibleSignatureTypes?.length
    ? input.possibleSignatureTypes
    : ['BASIC'];

  const recipientContactType = input.recipient.recipientContactType || (input.recipient.mobileNumber ? 'MOBILE' : 'EMAIL');

  if (recipientContactType === 'EMAIL' && !input.recipient.email) {
    throw new Error('Recipient email is required for EMAIL contact type');
  }

  if ((recipientContactType === 'MOBILE' || signatureTypes.includes('SMS_OTP')) && !input.recipient.mobileNumber) {
    throw new Error('Recipient mobileNumber is required for MOBILE contact type or SMS_OTP signature type');
  }

  const field = {
    fileNumber: input.signatureField.fileNumber,
    type: 'SIGNATURE',
    page: input.signatureField.page,
    left: input.signatureField.left,
    top: input.signatureField.top,
    width: input.signatureField.width,
    height: input.signatureField.height,
    required: true,
  };

  return postToSignify<SignifyBaseResponse>(
    '/set-document-details',
    {
      documentId: input.documentId,
      workflowType: input.workflowType || 'SERIAL',
      recipients: [
        {
          name: input.recipient.name,
          email: input.recipient.email || undefined,
          mobileNumber: input.recipient.mobileNumber || undefined,
          role: 'SIGNER',
          recipientContactType,
          possibleSignatureTypes: signatureTypes,
          fields: [field],
        },
      ],
      additionalDetails: {
        messageForRecipients: input.messageForRecipients || undefined,
        workflowLanguage: input.xLanguage || 'en',
      },
      shareAutomatically: input.shareAutomatically !== false,
    },
    { token, language: input.xLanguage || 'en', userEmail: input.xUserEmail }
  );
}

export async function sendDocumentToSignify(input: SendSignifyDocumentInput) {
  const extension = input.extension || 'pdf';
  const token = await getSignifyAccessToken({ language: input.xLanguage || 'en' });

  const { documentId } = await createSignifyDocument({
    documentName: input.documentName,
    extension,
    fileBase64: input.fileBase64,
    token,
    xLanguage: input.xLanguage,
    xUserEmail: input.xUserEmail,
  });

  await setSignifyDocumentDetails({
    documentId,
    recipient: input.recipient,
    signatureField: input.signatureField,
    workflowType: input.workflowType,
    possibleSignatureTypes: input.possibleSignatureTypes,
    shareAutomatically: input.shareAutomatically,
    messageForRecipients: input.messageForRecipients,
    token,
    xLanguage: input.xLanguage,
    xUserEmail: input.xUserEmail,
  });

  return { documentId };
}
