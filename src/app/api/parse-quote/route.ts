import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { extractText } from 'unpdf';
import { parseQuoteWithAI, parseQuoteFromImage } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';

async function parsePDF(buffer: Buffer): Promise<string> {
  const { text } = await extractText(buffer);
  return Array.isArray(text) ? text.join('\n') : text;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const groupId = formData.get('groupId') as string;

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let parsedQuote;

    // 파일 형식에 따라 파싱
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const isImage = imageExtensions.some(ext => fileName.endsWith(ext));

    if (isImage) {
      // 이미지 파일은 Gemini Vision으로 직접 분석
      const mimeType = file.type || 'image/png';
      parsedQuote = await parseQuoteFromImage(fileBuffer, mimeType, file.name);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const content = XLSX.utils.sheet_to_csv(sheet);
      parsedQuote = await parseQuoteWithAI(content, file.name);
    } else if (fileName.endsWith('.pdf')) {
      const content = await parsePDF(fileBuffer);
      parsedQuote = await parseQuoteWithAI(content, file.name);
    } else {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다 (xlsx, xls, pdf, png, jpg 가능)' }, { status: 400 });
    }

    // 견적서 저장
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        group_id: groupId,
        name: fileName,
        company: parsedQuote.company,
        total_amount: parsedQuote.total_amount,
      })
      .select()
      .single();

    if (quoteError) {
      throw new Error('견적서 저장 실패: ' + quoteError.message);
    }

    // 견적 항목 저장
    const items = parsedQuote.items.map((item) => ({
      quote_id: quote.id,
      category: item.category,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      amount: item.amount,
    }));

    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(items);

    if (itemsError) {
      throw new Error('견적 항목 저장 실패: ' + itemsError.message);
    }

    return NextResponse.json({
      success: true,
      quote: {
        ...quote,
        items: parsedQuote.items,
      },
    });
  } catch (error) {
    console.error('Error parsing quote:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
