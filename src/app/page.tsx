'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type QuoteItem = {
  id: string;
  quote_id: string;
  category: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  amount: number;
};

type Quote = {
  id: string;
  name: string;
  company: string;
  total_amount: number;
  created_at: string;
  items?: QuoteItem[];
};

type ComparisonGroup = {
  id: string;
  name: string;
  created_at: string;
  quotes?: Quote[];
};

export default function Home() {
  const [groups, setGroups] = useState<ComparisonGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ComparisonGroup | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // 그룹 목록 불러오기
  const fetchGroups = async () => {
    const { data, error } = await supabase
      .from('comparison_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setGroups(data);
    }
    setIsLoading(false);
  };

  // 그룹 상세 (견적서 포함) 불러오기
  const fetchGroupDetail = async (groupId: string) => {
    const { data: quotes, error } = await supabase
      .from('quotes')
      .select(`
        *,
        items:quote_items(*)
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (!error && quotes) {
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        setSelectedGroup({ ...group, quotes });
      }
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // 새 비교 그룹 생성
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const { data, error } = await supabase
      .from('comparison_groups')
      .insert({ name: newGroupName.trim() })
      .select()
      .single();

    if (!error && data) {
      setGroups([data, ...groups]);
      setNewGroupName('');
      setIsCreatingGroup(false);
      setSelectedGroup({ ...data, quotes: [] });
    }
  };

  // 파일 업로드
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedGroup || !e.target.files?.length) return;

    setIsUploading(true);
    const files = Array.from(e.target.files);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`${file.name} 분석 중... (${i + 1}/${files.length})`);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('groupId', selectedGroup.id);

      try {
        const response = await fetch('/api/parse-quote', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          alert(`${file.name} 처리 실패: ${result.error}`);
        }
      } catch (error) {
        alert(`${file.name} 업로드 실패`);
      }
    }

    setIsUploading(false);
    setUploadProgress('');
    fetchGroupDetail(selectedGroup.id);
    e.target.value = '';
  };

  // 견적서 삭제
  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('이 견적서를 삭제하시겠습니까?')) return;

    await supabase.from('quotes').delete().eq('id', quoteId);

    if (selectedGroup) {
      fetchGroupDetail(selectedGroup.id);
    }
  };

  // 그룹 삭제
  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('이 비교 그룹을 삭제하시겠습니까? 포함된 모든 견적서도 삭제됩니다.')) return;

    await supabase.from('comparison_groups').delete().eq('id', groupId);
    setGroups(groups.filter((g) => g.id !== groupId));
    if (selectedGroup?.id === groupId) {
      setSelectedGroup(null);
    }
  };

  // 카테고리별 비교 데이터 생성
  const getCategoryComparison = () => {
    if (!selectedGroup?.quotes?.length) return {};

    const comparison: {
      [category: string]: {
        [quoteId: string]: { items: QuoteItem[]; total: number };
      };
    } = {};

    for (const quote of selectedGroup.quotes) {
      if (!quote.items) continue;

      for (const item of quote.items) {
        if (!comparison[item.category]) {
          comparison[item.category] = {};
        }
        if (!comparison[item.category][quote.id]) {
          comparison[item.category][quote.id] = { items: [], total: 0 };
        }
        comparison[item.category][quote.id].items.push(item);
        comparison[item.category][quote.id].total += item.amount;
      }
    }

    return comparison;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const categoryComparison = getCategoryComparison();
  const categories = Object.keys(categoryComparison).sort();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800">견적서 비교</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-6">
          {/* 사이드바 - 그룹 목록 */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-800">비교 목록</h2>
                <button
                  onClick={() => setIsCreatingGroup(true)}
                  className="text-sm text-blue-500 hover:text-blue-600"
                >
                  + 새로 만들기
                </button>
              </div>

              {isCreatingGroup && (
                <form onSubmit={handleCreateGroup} className="mb-4">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="예: 우리집 인테리어"
                    className="w-full px-3 py-2 border rounded-lg text-sm text-gray-800 mb-2"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-1 bg-blue-500 text-white rounded text-sm"
                    >
                      생성
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingGroup(false)}
                      className="flex-1 py-1 bg-gray-200 text-gray-700 rounded text-sm"
                    >
                      취소
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedGroup?.id === group.id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setSelectedGroup(group);
                      fetchGroupDetail(group.id);
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-800 text-sm">
                        {group.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
                {groups.length === 0 && !isCreatingGroup && (
                  <p className="text-gray-400 text-sm text-center py-4">
                    비교 목록이 없습니다
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 메인 컨텐츠 */}
          <div className="md:col-span-3">
            {selectedGroup ? (
              <div className="space-y-6">
                {/* 업로드 영역 */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    {selectedGroup.name}
                  </h2>

                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {isUploading ? (
                      <div className="text-gray-500">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p>{uploadProgress}</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-500 mb-2">
                          견적서 파일을 업로드하세요 (Excel, PDF)
                        </p>
                        <label className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600">
                          파일 선택
                          <input
                            type="file"
                            accept=".xlsx,.xls,.pdf"
                            multiple
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                {/* 업로드된 견적서 목록 */}
                {selectedGroup.quotes && selectedGroup.quotes.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">
                      업로드된 견적서 ({selectedGroup.quotes.length}개)
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      {selectedGroup.quotes.map((quote) => (
                        <div
                          key={quote.id}
                          className="p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-gray-800">
                              {quote.company}
                            </span>
                            <button
                              onClick={() => handleDeleteQuote(quote.id)}
                              className="text-red-400 hover:text-red-600 text-xs"
                            >
                              삭제
                            </button>
                          </div>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(quote.total_amount)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {quote.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 카테고리별 비교 */}
                {categories.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">
                      항목별 비교
                    </h3>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-gray-600">
                              카테고리
                            </th>
                            {selectedGroup.quotes?.map((quote) => (
                              <th
                                key={quote.id}
                                className="text-right py-3 px-4 font-medium text-gray-600"
                              >
                                {quote.company}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {categories.map((category) => {
                            const categoryData = categoryComparison[category];
                            const amounts = selectedGroup.quotes?.map(
                              (q) => categoryData[q.id]?.total || 0
                            ) || [];
                            const minAmount = Math.min(...amounts.filter((a) => a > 0));
                            const maxAmount = Math.max(...amounts);

                            return (
                              <tr key={category} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-4 font-medium text-gray-800">
                                  {category}
                                </td>
                                {selectedGroup.quotes?.map((quote) => {
                                  const data = categoryData[quote.id];
                                  const amount = data?.total || 0;
                                  const isMin = amount === minAmount && amount > 0;
                                  const isMax = amount === maxAmount && amounts.filter((a) => a > 0).length > 1;

                                  return (
                                    <td
                                      key={quote.id}
                                      className={`py-3 px-4 text-right ${
                                        isMin
                                          ? 'text-green-600 font-semibold'
                                          : isMax
                                          ? 'text-red-500'
                                          : 'text-gray-700'
                                      }`}
                                    >
                                      {amount > 0 ? (
                                        <div>
                                          <div>{formatCurrency(amount)}</div>
                                          {data?.items && data.items.length > 1 && (
                                            <div className="text-xs text-gray-400">
                                              ({data.items.length}개 항목)
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-gray-300">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                          {/* 합계 행 */}
                          <tr className="bg-gray-100 font-semibold">
                            <td className="py-3 px-4 text-gray-800">합계</td>
                            {selectedGroup.quotes?.map((quote) => (
                              <td
                                key={quote.id}
                                className="py-3 px-4 text-right text-gray-800"
                              >
                                {formatCurrency(quote.total_amount)}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex gap-4 text-sm">
                      <span className="text-green-600">● 최저가</span>
                      <span className="text-red-500">● 최고가</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <p className="text-gray-400">
                  왼쪽에서 비교 목록을 선택하거나 새로 만들어주세요
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
