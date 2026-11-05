import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function err(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: { message, code } }, { status });
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return NextResponse.json({
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}
