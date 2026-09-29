import { NextRequest, NextResponse } from 'next/server';
import { getReturnRequests, processReturnDecision, submitReturnRequest } from '@/lib/db/store-service';

export async function GET() {
  try {
    const requests = await getReturnRequests();
    return NextResponse.json({ requests });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch returns';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const req = await submitReturnRequest(body);
    return NextResponse.json(req, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Return request submission failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { returnRequestId, decision, adminNotes, actorId } = body;
    const result = await processReturnDecision(returnRequestId, decision, adminNotes, actorId || 'admin');
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Processing return failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
