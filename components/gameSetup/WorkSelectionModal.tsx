import React, { useState, useMemo } from 'react';
import Modal from '../ui/Modal';
import InputField from '../ui/InputField';
import { FanficWork } from '../../src/types/fanfic';

interface WorkSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  works: FanficWork[];
  onSelect: (work: FanficWork) => void;
}

const WorkSelectionModal: React.FC<WorkSelectionModalProps> = ({ isOpen, onClose, works, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('Tất cả');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleClose = () => {
    const trimmed = searchTerm.trim();
    if (trimmed) {
      if (!trimmed.startsWith('http')) {
        const exactMatch = works.find(w => w.title.toLowerCase() === trimmed.toLowerCase());
        if (exactMatch) {
          onSelect(exactMatch);
        } else {
          onSelect({
            id: 'custom-unlisted-work',
            title: trimmed,
            description: 'Tác phẩm tự nhập ngoài danh sách.',
            country: 'Khác',
            plot: `Đồng nhân bối cảnh dựa trên nguyên tác: ${trimmed}`,
            worldSetting: `Bối cảnh thế giới dựa trên nguyên tác: ${trimmed}`,
            characters: []
          });
        }
      }
      setSearchTerm('');
    }
    onClose();
  };

  const countries = useMemo(() => {
    const uniqueCountries = Array.from(new Set(works.map(w => w.country).filter(Boolean)));
    return ['Tất cả', ...uniqueCountries];
  }, [works]);

  const filteredWorks = useMemo(() => {
    let result = works.filter(work => {
      const title = work?.title || '';
      const description = work?.description || '';
      const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCountry = selectedCountry === 'Tất cả' || work.country === selectedCountry;
      return matchesSearch && matchesCountry;
    });

    result.sort((a, b) => {
      if (sortOrder === 'asc') return a.title.localeCompare(b.title);
      return b.title.localeCompare(a.title);
    });

    return result;
  }, [works, searchTerm, selectedCountry, sortOrder]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Chọn Tác Phẩm Nguyên Tác">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Quốc gia</label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-1.5 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Sắp xếp</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-1.5 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="asc">Tên A-Z</option>
              <option value="desc">Tên Z-A</option>
            </select>
          </div>
        </div>

        <InputField
          label="Tìm kiếm tác phẩm"
          id="workSearch"
          name="workSearch"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Nhập tên truyện hoặc nội dung..."
          className="text-sm"
        />

        <div className="mt-4 max-h-[400px] overflow-y-auto border border-gray-700 rounded-md divide-y divide-gray-700 bg-gray-900/50 custom-scrollbar">
          {searchTerm.trim().startsWith('http') && (
            <div
              onClick={() => {
                onSelect({
                  id: 'url-source',
                  title: searchTerm.trim(),
                  description: 'Sử dụng dữ liệu từ liên kết bên ngoài làm nguồn nguyên tác.',
                  country: 'URL',
                  plot: 'Nội dung sẽ được tải từ liên kết được cung cấp.',
                  worldSetting: 'Bối cảnh dựa trên nội dung tại URL.',
                  characters: []
                });
                setSearchTerm('');
                onClose();
              }}
              className="p-4 bg-orange-600/10 hover:bg-orange-600/20 cursor-pointer border-b border-orange-500/30 group transition-all"
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-orange-900/40">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-orange-400 font-bold text-sm">Sử dụng URL này làm nguồn nguyên tác</h3>
                  <p className="text-gray-400 text-xs truncate italic">{searchTerm.trim()}</p>
                </div>
              </div>
            </div>
          )}
          {filteredWorks.length > 0 ? (
            filteredWorks.map((work) => (
              <div
                key={work.id}
                onClick={() => {
                  onSelect(work);
                  setSearchTerm('');
                  onClose();
                }}
                className="p-3 hover:bg-orange-900/20 cursor-pointer transition-colors group"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-medium text-orange-300 group-hover:text-orange-200">{work.title}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded border border-gray-700 uppercase">{work.country}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2 italic">{work.description}</p>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500 italic">
              Không tìm thấy tác phẩm nào phù hợp.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default WorkSelectionModal;
