import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { parseQuoteWithAI } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';

// PDF.js 워커 비활성화 (서버 환경)
GlobalWorkerOptions.workerSrc = '';

async function parsePDF(buffer: Buffer): Promise<string> {
  const uint8Array = new Uint8Array(buffer);
  const pdf = await getDocument({ data: uint8Array, useSystemFonts: true }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: unknown) => (item as { str: string }).str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const groupId = formData.get('groupId') as string;

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 });
    }

    const fileName = file.name;
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let content = '';

    // 파일 형식에 따라 파싱
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      content = XLSX.utils.sheet_to_csv(sheet);
    } else if (fileName.endsWith('.pdf')) {
      content = await parsePDF(fileBuffer);
    } else {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다 (xlsx, xls, pdf만 가능)' }, { status: 400 });
    }

    // AI로 견적서 파싱
    const parsedQuote = await parseQuoteWithAI(content, fileName);

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
