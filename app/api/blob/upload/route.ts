import { handleUpload } from '@vercel/blob';

export async function POST(request: Request) {
  return handleUpload({
    request,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: ['application/xml', 'text/xml'],
      maximumSizeInBytes: 20 * 1024 * 1024,
      tokenPayload: JSON.stringify({}),
    }),
    onUploadCompleted: async () => {},
  });
}
