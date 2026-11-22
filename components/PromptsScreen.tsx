import React, { useState, useRef } from 'react';
import { useGame } from '../hooks/useGame';
import { GameScreen } from '../types';
import Button from './ui/Button';
import InputField from './ui/InputField';
import { VIETNAMESE } from '../constants';

const PromptsScreen: React.FC = () => {
    const { knowledgeBase, setKnowledgeBase, setCurrentScreen, showNotification } = useGame();
    const [newPrompt, setNewPrompt] = useState('');
    const importFileRef = useRef<HTMLInputElement>(null);

    // State for editing
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editText, setEditText] = useState('');

    const userPrompts = knowledgeBase.userPrompts || [];

    const handleAddPrompt = () => {
        if (newPrompt.trim()) {
            setKnowledgeBase(prevKb => ({
                ...prevKb,
                userPrompts: [...(prevKb.userPrompts || []), newPrompt.trim()]
            }));
            setNewPrompt('');
        }
    };

    const handleRemovePrompt = (indexToRemove: number) => {
        setKnowledgeBase(prevKb => ({
            ...prevKb,
            userPrompts: (prevKb.userPrompts || []).filter((_, index) => index !== indexToRemove)
        }));
    };

    const handleStartEdit = (index: number) => {
        setEditingIndex(index);
        setEditText(userPrompts[index]);
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditText('');
    };

    const handleSaveEdit = () => {
        if (editingIndex === null || !editText.trim()) {
            showNotification("Lời nhắc không được để trống.", "warning");
            return;
        };
        
        setKnowledgeBase(prevKb => {
            const newPrompts = [...(prevKb.userPrompts || [])];
            newPrompts[editingIndex] = editText.trim();
            return {
                ...prevKb,
                userPrompts: newPrompts
            };
        });

        handleCancelEdit();
        showNotification("Đã cập nhật lời nhắc.", "success");
    };


    const handleExportPrompts = () => {
        if (userPrompts.length === 0) {
            showNotification("Không có lời nhắc nào để xuất.", "warning");
            return;
        }

        const fileContent = userPrompts.join('\n');
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'daodoai_prompts.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showNotification("Đã xuất các lời nhắc thành công!", "success");
    };

    const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const promptsFromFile = content
                    .split('\n')
                    .map(p => p.trim())
                    .filter(p => p !== '');

                if (promptsFromFile.length > 0) {
                    setKnowledgeBase(prevKb => ({
                        ...prevKb,
                        userPrompts: promptsFromFile
                    }));
                    showNotification(`Đã nhập ${promptsFromFile.length} lời nhắc thành công.`, "success");
                } else {
                    showNotification("File không chứa lời nhắc hợp lệ nào.", "warning");
                }
            } catch (error) {
                showNotification("Lỗi khi đọc file. Vui lòng kiểm tra lại file.", "error");
                console.error("Error reading prompts file:", error);
            }
        };
        reader.onerror = () => {
            showNotification("Lỗi khi đọc file.", "error");
        };
        reader.readAsText(file);

        if (importFileRef.current) {
            importFileRef.current.value = "";
        }
    };


    return (
        <div className="min-h-screen flex flex-col items-center justify-start bg-gray-800 p-4 py-8 sm:p-6">
            <div className="w-full max-w-2xl bg-gray-900 shadow-2xl rounded-xl p-6 sm:p-8">
                <header className="mb-6 flex justify-between items-center">
                    <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-500">
                        Lời Nhắc Cho AI
                    </h1>
                    <Button variant="secondary" onClick={() => setCurrentScreen(GameScreen.Gameplay)}>
                        {VIETNAMESE.goBackButton}
                    </Button>
                </header>
                
                <div className="space-y-4">
                    <p className="text-sm text-gray-400">
                        Thêm các lời nhắc hoặc quy tắc mà bạn muốn AI luôn tuân theo trong suốt quá trình chơi. 
                        Ví dụ: "Nhân vật chính luôn nói chuyện một cách lịch sự", "Không bao giờ mô tả cảnh giết chóc động vật", "Luôn ưu tiên tìm kiếm cơ duyên để mạnh lên".
                    </p>
                    
                    {/* Import / Export Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 justify-start items-center py-3 border-y border-gray-700/50">
                        <Button onClick={handleExportPrompts} variant="secondary" className="w-full sm:w-auto">
                            Xuất ra file .txt
                        </Button>
                        <Button onClick={() => importFileRef.current?.click()} variant="secondary" className="w-full sm:w-auto">
                            Nhập từ file .txt
                        </Button>
                        <input
                            type="file"
                            ref={importFileRef}
                            onChange={handleImportFileChange}
                            accept=".txt,text/plain"
                            className="hidden"
                        />
                    </div>

                    {/* Add new prompt section */}
                    <div className="flex gap-2">
                        <InputField
                            label=""
                            id="new-prompt-input"
                            value={newPrompt}
                            onChange={(e) => setNewPrompt(e.target.value)}
                            placeholder="Nhập lời nhắc mới tại đây..."
                            className="flex-grow !mb-0"
                        />
                        <Button onClick={handleAddPrompt} disabled={!newPrompt.trim()}>
                            Thêm
                        </Button>
                    </div>

                    {/* List of current prompts */}
                    <div className="space-y-2 pt-4 border-t border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-300">Các lời nhắc hiện tại:</h2>
                        {userPrompts.length > 0 ? (
                            <ul className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                                {userPrompts.map((prompt, index) => (
                                    <li key={index} className="p-3 bg-gray-800/50 rounded-lg">
                                        {editingIndex === index ? (
                                            <div className="space-y-3">
                                                <InputField
                                                    label={`Sửa lời nhắc #${index + 1}`}
                                                    id={`edit-prompt-${index}`}
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    textarea
                                                    rows={3}
                                                    className="!mb-0"
                                                />
                                                <div className="flex gap-2 justify-end">
                                                    <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Hủy</Button>
                                                    <Button variant="primary" size="sm" onClick={handleSaveEdit}>Lưu</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <p className="text-gray-200 text-sm flex-grow mr-4">{prompt}</p>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <Button variant="secondary" size="sm" onClick={() => handleStartEdit(index)}>Sửa</Button>
                                                    <Button variant="danger" size="sm" onClick={() => handleRemovePrompt(index)}>Xóa</Button>
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 italic text-center py-4">Chưa có lời nhắc nào.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PromptsScreen;