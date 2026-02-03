import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export type ParsedQuoteItem = {
  category: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  amount: number;
};

export type ParsedQuote = {
  company: string;
  items: ParsedQuoteItem[];
  total_amount: number;
};

export async function parseQuoteWithAI(content: string, fileName: string): Promise<ParsedQuote> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `다음은 인테리어 견적서 내용입니다. 이 견적서를 분석해서 JSON 형식으로 반환해주세요.

파일명: ${fileName}

견적서 내용:
${content}

다음 JSON 형식으로 반환해주세요. 반드시 유효한 JSON만 반환하고 다른 텍스트는 포함하지 마세요:
{
  "company": "업체명 (파일명이나 내용에서 추출, 없으면 '업체명 미상')",
  "items": [
    {
      "category": "공사 카테고리 (예: 철거, 목공, 도배, 타일, 전기, 설비, 필름, 조명, 기타 등으로 표준화)",
      "description": "상세 내용",
      "quantity": 수량 (숫자 또는 null),
      "unit": "단위 (예: 식, 개, m, m2, 평 등 또는 null)",
      "unit_price": 단가 (숫자 또는 null),
      "amount": 금액 (숫자, 필수)
    }
  ],
  "total_amount": 총 합계 금액 (숫자)
}

카테고리는 다음 중에서 선택해서 표준화해주세요:
- 철거: 기존 시설 철거, 해체
- 목공: 목공사, 가구, 몰딩
- 도배: 도배, 벽지
- 페인트: 페인트, 도장
- 타일: 타일, 욕실 타일
- 바닥: 바닥재, 마루, 장판
- 전기: 전기 공사, 배선
- 설비: 배관, 수도, 난방
- 조명: 조명 설치, 조명 기구
- 필름: 시트지, 필름
- 창호: 창문, 샷시
- 욕실: 욕실 시공, 위생 도기
- 주방: 싱크대, 주방 가구
- 운반/폐기물: 폐기물 처리, 운반
- 기타: 위에 해당하지 않는 항목`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // JSON 부분만 추출
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as ParsedQuote;
    return parsed;
  } catch (e) {
    throw new Error('JSON 파싱 실패: ' + (e as Error).message);
  }
}

export async function parseQuoteFromImage(imageBuffer: Buffer, mimeType: string, fileName: string): Promise<ParsedQuote> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `이 이미지는 인테리어 견적서입니다. 이미지에서 견적 내용을 읽어서 JSON 형식으로 반환해주세요.

파일명: ${fileName}

다음 JSON 형식으로 반환해주세요. 반드시 유효한 JSON만 반환하고 다른 텍스트는 포함하지 마세요:
{
  "company": "업체명 (이미지에서 추출, 없으면 '업체명 미상')",
  "items": [
    {
      "category": "공사 카테고리 (예: 철거, 목공, 도배, 타일, 전기, 설비, 필름, 조명, 기타 등으로 표준화)",
      "description": "상세 내용",
      "quantity": 수량 (숫자 또는 null),
      "unit": "단위 (예: 식, 개, m, m2, 평 등 또는 null)",
      "unit_price": 단가 (숫자 또는 null),
      "amount": 금액 (숫자, 필수)
    }
  ],
  "total_amount": 총 합계 금액 (숫자)
}

카테고리는 다음 중에서 선택해서 표준화해주세요:
- 철거: 기존 시설 철거, 해체
- 목공: 목공사, 가구, 몰딩
- 도배: 도배, 벽지
- 페인트: 페인트, 도장
- 타일: 타일, 욕실 타일
- 바닥: 바닥재, 마루, 장판
- 전기: 전기 공사, 배선
- 설비: 배관, 수도, 난방
- 조명: 조명 설치, 조명 기구
- 필름: 시트지, 필름
- 창호: 창문, 샷시
- 욕실: 욕실 시공, 위생 도기
- 주방: 싱크대, 주방 가구
- 운반/폐기물: 폐기물 처리, 운반
- 기타: 위에 해당하지 않는 항목`;

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType: mimeType,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  const text = response.text();

  // JSON 부분만 추출
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as ParsedQuote;
    return parsed;
  } catch (e) {
    throw new Error('JSON 파싱 실패: ' + (e as Error).message);
  }
}
