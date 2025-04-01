import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { trackDocumentExport } from '@/lib/subscription';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    const { documentId, userId } = await request.json();

    // Track the export
    await trackDocumentExport(userId, documentId);

    // Get the document data
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (documentError) {
      throw documentError;
    }

    // Generate export data (you can customize this based on your needs)
    const exportData = {
      ...document,
      exported_at: new Date().toISOString()
    };

    return NextResponse.json(exportData);
  } catch (error: any) {
    console.error('Error exporting document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export document' },
      { status: 500 }
    );
  }
} 