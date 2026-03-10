import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDocumentToSignify, type SignifySignatureType, type SignifyRecipientContactType } from '@/lib/signify';

type SendRequestBody = {
  trigger?: string;
  counteragentUuid?: string;
  counteragentName?: string;
  email?: string;
  phone?: string;
  recipientContactType?: SignifyRecipientContactType;
  documentName?: string;
  extension?: 'pdf' | 'doc' | 'docx';
  fileBase64?: string;
  signatureField?: {
    fileNumber?: number;
    page?: number;
    left?: number;
    top?: number;
    width?: number;
    height?: number;
  };
  workflowType?: 'SERIAL' | 'PARALLEL';
  possibleSignatureTypes?: SignifySignatureType[];
  shareAutomatically?: boolean;
  messageForRecipients?: string;
  language?: 'en' | 'ka';
  metadata?: Record<string, unknown>;
};

const DEFAULT_SIGNATURE_FIELD = {
  page: 1,
  left: 100,
  top: 100,
  width: 200,
  height: 60,
};

function unauthorizedIfSecretMismatch(request: NextRequest) {
  const configuredSecret = process.env.SIGNIFY_TRIGGER_SECRET;
  if (!configuredSecret) return null;

  const incomingSecret = request.headers.get('x-signify-trigger-secret');
  if (!incomingSecret || incomingSecret !== configuredSecret) {
    return NextResponse.json({ error: 'Unauthorized trigger request' }, { status: 401 });
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const unauthorized = unauthorizedIfSecretMismatch(request);
    if (unauthorized) return unauthorized;

    const body = (await request.json()) as SendRequestBody;

    if (!body.documentName || !body.fileBase64) {
      return NextResponse.json(
        { error: 'documentName and fileBase64 are required' },
        { status: 400 }
      );
    }

    let resolvedName = body.counteragentName || '';
    let resolvedEmail = body.email || '';
    let resolvedPhone = body.phone || '';

    if (body.counteragentUuid) {
      const counteragent = await prisma.counteragents.findUnique({
        where: { counteragent_uuid: body.counteragentUuid },
        select: {
          counteragent: true,
          name: true,
          email: true,
          phone: true,
        },
      });

      if (!counteragent) {
        return NextResponse.json({ error: 'Counteragent not found' }, { status: 404 });
      }

      resolvedName = resolvedName || counteragent.counteragent || counteragent.name || '';
      resolvedEmail = resolvedEmail || counteragent.email || '';
      resolvedPhone = resolvedPhone || counteragent.phone || '';
    }

    if (!resolvedName) {
      return NextResponse.json(
        { error: 'Recipient name is required. Provide counteragentName or counteragentUuid with a valid counteragent record.' },
        { status: 400 }
      );
    }

    const recipientContactType = body.recipientContactType || (resolvedPhone ? 'MOBILE' : 'EMAIL');

    if (recipientContactType === 'EMAIL' && !resolvedEmail) {
      return NextResponse.json(
        { error: 'Recipient email is required for EMAIL delivery. Provide email or keep email on counteragent record.' },
        { status: 400 }
      );
    }

    if (recipientContactType === 'MOBILE' && !resolvedPhone) {
      return NextResponse.json(
        { error: 'Recipient phone is required for MOBILE delivery. Provide phone or keep phone on counteragent record.' },
        { status: 400 }
      );
    }

    const signatureField = {
      fileNumber: body.signatureField?.fileNumber,
      page: body.signatureField?.page ?? DEFAULT_SIGNATURE_FIELD.page,
      left: body.signatureField?.left ?? DEFAULT_SIGNATURE_FIELD.left,
      top: body.signatureField?.top ?? DEFAULT_SIGNATURE_FIELD.top,
      width: body.signatureField?.width ?? DEFAULT_SIGNATURE_FIELD.width,
      height: body.signatureField?.height ?? DEFAULT_SIGNATURE_FIELD.height,
    };

    const result = await sendDocumentToSignify({
      documentName: body.documentName,
      extension: body.extension || 'pdf',
      fileBase64: body.fileBase64,
      recipient: {
        name: resolvedName,
        email: resolvedEmail || undefined,
        mobileNumber: resolvedPhone || undefined,
        recipientContactType,
      },
      signatureField,
      workflowType: body.workflowType || 'SERIAL',
      possibleSignatureTypes: body.possibleSignatureTypes,
      shareAutomatically: body.shareAutomatically,
      messageForRecipients: body.messageForRecipients,
      xLanguage: body.language || 'en',
    });

    return NextResponse.json({
      status: 'SUCCESS',
      trigger: body.trigger || null,
      counteragentUuid: body.counteragentUuid || null,
      recipient: {
        name: resolvedName,
        email: resolvedEmail || null,
        phone: resolvedPhone || null,
        recipientContactType,
      },
      documentId: result.documentId,
      metadata: body.metadata || null,
    });
  } catch (error: any) {
    console.error('[signify.send] Failed to send document:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send document to Signify' },
      { status: 500 }
    );
  }
}
