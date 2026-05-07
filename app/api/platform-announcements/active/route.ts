import { NextResponse } from "next/server";
import {
  getActivePlatformAnnouncementForAudience,
  platformAnnouncementToNotice,
  resolveCurrentViewerAudience,
} from "@/lib/notices/platform-announcements";

export async function GET() {
  try {
    const viewerAudience = await resolveCurrentViewerAudience();
    const announcement = await getActivePlatformAnnouncementForAudience(viewerAudience);

    return NextResponse.json(
      {
        announcement,
        notice: announcement ? platformAnnouncementToNotice(announcement) : null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { announcement: null, notice: null },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
