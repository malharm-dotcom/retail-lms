import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadLearnerEnrollment, orderedLessons, recomputeEnrollment } from "@/lib/learning";
import { coveredSeconds, mergeRanges, unlockedLessonIds, videoPercent, type Range } from "@/lib/progress";
import { requireLearner } from "@/lib/session";

type Heartbeat = { enrollmentId?: unknown; lessonId?: unknown; ranges?: unknown; position?: unknown; duration?: unknown };

function parseRanges(value: unknown): Range[] {
  if (!Array.isArray(value) || value.length > 100) return [];
  return value.filter(
    (range): range is Range =>
      Array.isArray(range) &&
      range.length === 2 &&
      range.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 86400) &&
      range[1] > range[0] &&
      range[1] - range[0] <= 300,
  );
}

/**
 * Video heartbeat. The browser reports the second-ranges it actually played; the server merges
 * them into unique coverage and refuses credit faster than wall-clock time allows (2x speed max).
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireLearner();
  } catch {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Heartbeat;
  const enrollmentId = String(body.enrollmentId ?? "");
  const lessonId = String(body.lessonId ?? "");
  const loaded = await loadLearnerEnrollment(enrollmentId, user.id);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lessons = orderedLessons(loaded.version);
  const lesson = lessons.find((row) => row.id === lessonId);
  if (!lesson || lesson.type !== "VIDEO") return NextResponse.json({ error: "Not a video lesson" }, { status: 400 });
  if (!unlockedLessonIds(lessons, loaded.evidence.completedLessonIds, loaded.version.sequential).has(lessonId))
    return NextResponse.json({ error: "Locked" }, { status: 409 });

  let duration = lesson.videoDurationSeconds;
  const reported = Number(body.duration);
  if (!duration && Number.isFinite(reported) && reported >= 1 && reported < 86400) {
    duration = Math.round(reported);
    // ponytail: first player-reported length wins; HR can re-save the lesson URL to reset it.
    await prisma().lesson.update({ where: { id: lesson.id }, data: { videoDurationSeconds: duration } });
  }

  const existing = loaded.enrollment.lessonProgress.find((row) => row.lessonId === lessonId);
  const previousRanges = (existing?.watchedRanges as Range[] | undefined) ?? [];
  const previousCovered = coveredSeconds(previousRanges, duration);
  let merged = mergeRanges([...previousRanges, ...parseRanges(body.ranges)]);
  const gained = coveredSeconds(merged, duration) - previousCovered;
  const elapsedSeconds = existing ? (Date.now() - existing.updatedAt.getTime()) / 1000 : 15;
  if (gained > elapsedSeconds * 2.1 + 5) merged = mergeRanges(previousRanges);

  const watched = coveredSeconds(merged, duration);
  const percent = videoPercent(watched, duration);
  const completed = Boolean(existing?.completedAt) || (duration !== null && percent >= lesson.requiredWatchPercentage);
  const position = Math.max(0, Math.min(Number(body.position) || 0, duration ?? 86400));

  await prisma().lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    update: {
      watchedRanges: merged,
      watchedSeconds: watched,
      percentComplete: percent,
      lastPositionSeconds: Math.round(position),
      completedAt: existing?.completedAt ?? (completed ? new Date() : null),
    },
    create: {
      enrollmentId,
      lessonId,
      watchedRanges: merged,
      watchedSeconds: watched,
      percentComplete: percent,
      lastPositionSeconds: Math.round(position),
      completedAt: completed ? new Date() : null,
    },
  });

  if ((previousCovered === 0 && watched > 0) || (completed && !existing?.completedAt)) await recomputeEnrollment(enrollmentId);
  return NextResponse.json({ watched, duration, percent, completed, required: lesson.requiredWatchPercentage });
}
