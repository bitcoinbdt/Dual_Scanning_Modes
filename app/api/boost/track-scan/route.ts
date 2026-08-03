import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { BoostTrackScanRequest, BoostTrackScanResponse } from '@/types/boost';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Parse request body
    const body: BoostTrackScanRequest = await request.json();

    // Validate required fields
    if (!body.boostId || !body.contractAddress || !body.scanType) {
      return NextResponse.json<BoostTrackScanResponse>(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Call database function to increment scan count
    const { data: result, error } = await supabase.rpc('increment_boost_scan_count', {
      p_boost_id: body.boostId,
    });

    if (error) {
      console.error('Error tracking scan:', error);
      return NextResponse.json<BoostTrackScanResponse>(
        { success: false, message: 'Error tracking scan' },
        { status: 500 }
      );
    }

    if (!result.success) {
      return NextResponse.json<BoostTrackScanResponse>(
        { success: false, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json<BoostTrackScanResponse>({
      success: true,
      totalScans: result.totalScans,
    });
  } catch (error: any) {
    console.error('Unexpected error in track-scan:', error);
    return NextResponse.json<BoostTrackScanResponse>(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
