import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Trigger a full sync of all NBG rates from database to Google Sheets.
 * This is useful when the sheet is empty or needs to be rebuilt.
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Trigger Google Sheets sync
    const sheetsResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/cron/sync-to-sheets`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    });

    if (!sheetsResponse.ok) {
      const errorText = await sheetsResponse.text();
      console.error("[sync-sheets] Sheets sync failed", errorText);
      return NextResponse.json(
        { error: "Failed to sync to Google Sheets", details: errorText },
        { status: 500 }
      );
    }

    const result = await sheetsResponse.json();

    return NextResponse.json({
      success: true,
      message: "Google Sheets sync completed",
      ...result
    });
  } catch (error: any) {
    console.error("[sync-sheets] POST error", error);
    return NextResponse.json(
      { error: error?.message || "Failed to sync to Google Sheets" },
      { status: 500 }
    );
  }
}
