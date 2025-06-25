// DOM要素の参照
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebarToggle');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const addDirectoryBtn = document.getElementById('addDirectoryBtn');
const addDirectoryBtnMobile = document.getElementById('addDirectoryBtnMobile');
const newFieldForm = document.getElementById('newFieldForm');
const cancelNewFieldBtn = document.getElementById('cancelNewField');
const saveNewFieldBtn = document.getElementById('saveNewField');
const currentFieldNameEl = document.getElementById('currentFieldName');
const directoriesList = document.getElementById('directoriesList');
const fieldsList = document.getElementById('fieldsList');
const fieldSearchInput = document.getElementById('fieldSearchInput');
const fieldSearchBtn = document.getElementById('fieldSearchBtn');
const fieldSortSelect = document.getElementById('fieldSortSelect');
const sortOrderBtn = document.getElementById('sortOrderBtn');
const viewModeBtn = document.getElementById('viewModeBtn');
const multiSelectionPanel = document.getElementById('multiSelectionPanel');
const selectedFieldsCount = document.getElementById('selectedFieldsCount');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');
const compareFieldsBtn = document.getElementById('compareFieldsBtn');
const batchAnalyzeBtn = document.getElementById('batchAnalyzeBtn');
const editFieldForm = document.getElementById('editFieldForm');
const editFieldId = document.getElementById('editFieldId');
const editFieldName = document.getElementById('editFieldName');
const editFieldMemo = document.getElementById('editFieldMemo');
const editFieldCrop = document.getElementById('editFieldCrop');
const editFieldDirectorySelect = document.getElementById('editFieldDirectorySelect');
const cancelEditFieldBtn = document.getElementById('cancelEditField');
const saveEditFieldBtn = document.getElementById('saveEditField');
const deleteFieldBtn = document.getElementById('deleteFieldBtn');
const fieldDrawnConfirmation = document.getElementById('fieldDrawnConfirmation');
const drawInstructionText = document.getElementById('drawInstructionText');
const newDirectoryForm = document.getElementById('newDirectoryForm');
const directoryName = document.getElementById('directoryName');
const saveNewDirectory = document.getElementById('saveNewDirectory');
const cancelNewDirectory = document.getElementById('cancelNewDirectory');
const editDirectoryForm = document.getElementById('editDirectoryForm');
const editDirectoryId = document.getElementById('editDirectoryId');
const editDirectoryName = document.getElementById('editDirectoryName');
const saveEditDirectory = document.getElementById('saveEditDirectory');
const cancelEditDirectory = document.getElementById('cancelEditDirectory');
const deleteDirectoryBtn = document.getElementById('deleteDirectoryBtn');
const fieldDirectorySelect = document.getElementById('fieldDirectorySelect');

// グローバル変数
let currentSortBy = 'updatedAt';
let currentSortOrder = false; // false = 降順 (最新順)
let isListView = true; // リスト表示とグリッド表示の切り替え
let selectedFields = []; // 選択された区画のID
let currentFieldId = null; // 現在表示中の区画ID
let currentDirectoryId = DEFAULT_DIRECTORY_ID; // 現在選択されているディレクトリID

// グローバルスコープにも公開
window.currentFieldId = null;

// サイドバーのイベントリスナー設定
function setupSidebarEventListeners() {
    // フィールドの順序を初期化（既存データにorderプロパティがない場合）
    initializeFieldsOrder();
    
    // サイドバートグル（モバイル用）
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
            document.body.classList.toggle('sidebar-open');
        });
    }

    // サイドバーを閉じるボタン
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
            document.body.classList.remove('sidebar-open');
        });
    }

    // サイドバーの外側をクリックしたら閉じる（モバイル用）
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== sidebarToggleBtn) {
            sidebar.classList.remove('open');
            document.body.classList.remove('sidebar-open');
        }
    });

    // 新規リスト追加ボタン
    const showNewDirectoryForm = () => {
        hideEditFieldForm();
        hideNewFieldForm();
        hideEditDirectoryForm();
        
        if (newDirectoryForm) {
            newDirectoryForm.classList.remove('hidden');
            directoryName.focus();
        }
    };
    
    if (addDirectoryBtn) {
        addDirectoryBtn.addEventListener('click', showNewDirectoryForm);
    }
    
    if (addDirectoryBtnMobile) {
        addDirectoryBtnMobile.addEventListener('click', showNewDirectoryForm);
    }

    // 新規リストフォームのキャンセル
    if (cancelNewDirectory) {
        cancelNewDirectory.addEventListener('click', hideNewDirectoryForm);
    }
    
    // 新規リストの保存
    if (saveNewDirectory) {
        saveNewDirectory.addEventListener('click', saveNewDirectoryHandler);
    }
    
    // 圃場検索
    if (fieldSearchInput) {
        fieldSearchInput.addEventListener('input', debounce(() => {
            renderFieldsList();
        }, 300));
    }
    
    if (fieldSearchBtn) {
        fieldSearchBtn.addEventListener('click', () => {
            renderFieldsList();
        });
    }
    
    // ソート
    if (fieldSortSelect) {
        fieldSortSelect.addEventListener('change', () => {
            currentSortBy = fieldSortSelect.value;
            renderFieldsList();
        });
    }
    
    // ソート順
    if (sortOrderBtn) {
        sortOrderBtn.addEventListener('click', () => {
            currentSortOrder = !currentSortOrder;
            updateSortOrderIcon();
            renderFieldsList();
        });
    }
    
    // 表示モード切り替え
    if (viewModeBtn) {
        viewModeBtn.addEventListener('click', () => {
            isListView = !isListView;
            updateViewModeIcon();
            renderFieldsList();
        });
    }
    
    // 複数選択関連
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', clearFieldSelection);
    }
    
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllFields);
    }
    
    if (compareFieldsBtn) {
        compareFieldsBtn.addEventListener('click', compareSelectedFields);
    }
    
    if (batchAnalyzeBtn) {
        batchAnalyzeBtn.addEventListener('click', batchAnalyzeSelectedFields);
    }
    
    // 編集フォーム関連
    if (cancelEditFieldBtn) {
        cancelEditFieldBtn.addEventListener('click', hideEditFieldForm);
    }
    
    if (saveEditFieldBtn) {
        saveEditFieldBtn.addEventListener('click', saveEditField);
    }
    
    if (deleteFieldBtn) {
        deleteFieldBtn.addEventListener('click', deleteFieldConfirm);
    }
    
    // 描画完了イベントをリッスン
    document.addEventListener('drawingCompleted', updateDrawingStatus);
    document.addEventListener('drawingDeleted', updateDrawingStatus);

    // ディレクトリ編集ヒントを表示
    showDirectoryEditHint();

    // 新規圃場フォームのキャンセル
    if (cancelNewFieldBtn) {
        cancelNewFieldBtn.addEventListener('click', () => {
            hideNewFieldForm();
        });
    }
    
    // 新規圃場の保存
    if (saveNewFieldBtn) {
        saveNewFieldBtn.addEventListener('click', saveNewField);
    }
}

// ディレクトリリストの描画
function renderDirectoriesList() {
    if (!directoriesList) return;
    
    // ディレクトリデータの取得
    const directories = getDirectoriesList();
    
    // ソート (デフォルトディレクトリは常に先頭)
    const sortedDirectories = sortDirectories(directories);
    
    // 検索キーワードの取得
    const searchTerm = fieldSearchInput ? fieldSearchInput.value.trim() : '';
    
    // HTMLの作成
    let html = '';
    
    // 各ディレクトリ項目の作成
    sortedDirectories.forEach(dir => {
        const isActive = dir.id === currentDirectoryId;
        const fields = getFieldsInDirectory(dir.id);
        const fieldsCount = fields.length;
        
        // リスト内の選択済み区画の数を計算
        const selectedCount = fields.filter(field => selectedFields.includes(field.id)).length;
        const isAllSelected = fieldsCount > 0 && selectedCount === fieldsCount;
        const isPartialSelected = selectedCount > 0 && selectedCount < fieldsCount;
        
        html += `
            <div class="directory-container mb-3">
                <div class="directory-item ${isActive ? 'bg-blue-50 border-blue-300' : 'border-gray-200'} 
                    border rounded-lg p-2 cursor-pointer transition hover:border-blue-200"
                    data-directory-id="${dir.id}" draggable="true">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center flex-1">
                            ${fieldsCount > 0 ? 
                                `<div class="directory-checkbox mr-2">
                                    <input type="checkbox" 
                                        class="directory-select-all h-4 w-4 text-blue-600 rounded" 
                                        data-directory-id="${dir.id}"
                                        ${isAllSelected ? 'checked' : ''}
                                        ${isPartialSelected ? 'indeterminate="true"' : ''}>
                                </div>` : ''}
                            <i class="fas fa-folder${isActive ? '-open' : ''} text-${isActive ? 'blue' : 'gray'}-500 mr-2"></i>
                            <div class="relative inline-block dir-name-container">
                                <span class="directory-name font-medium text-gray-800 hover:bg-blue-100 hover:text-blue-800 cursor-text px-1 py-0.5 rounded" 
                                      data-directory-id="${dir.id}" 
                                      title="ダブルクリックして編集">
                                    ${escapeHtml(dir.name)}
                                </span>
                                ${dir.crop ? `<span class="ml-2 text-xs text-gray-600">(${escapeHtml(dir.crop)})</span>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs px-2 py-0.5 bg-gray-100 rounded-full mr-2">${fieldsCount}</span>
                            <button class="directory-edit-btn text-gray-500 hover:text-gray-700 p-1">
                                <i class="fas fa-edit text-xs"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- インライン編集フォーム -->
                    <div class="directory-edit-form mt-2 hidden" data-directory-id="${dir.id}">
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700">リスト名</label>
                                <input type="text" class="edit-directory-name-input mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm" 
                                    value="${escapeHtml(dir.name)}">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700">作物名</label>
                                <input type="text" class="edit-directory-crop-input mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm" 
                                    value="${escapeHtml(dir.crop || '')}">
                            </div>
                            <div class="flex justify-between space-x-2">
                                <button class="delete-directory-btn px-3 py-2 border border-red-300 rounded-md text-sm text-red-700 hover:bg-red-50">
                                    <i class="fas fa-trash-alt mr-1"></i> 削除
                                </button>
                                <div class="flex space-x-2">
                                    <button class="cancel-edit-directory px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                                        キャンセル
                                    </button>
                                    <button class="save-edit-directory px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700">
                                        更新する
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex justify-end mt-1">
                        <button class="add-field-btn text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200">
                            <i class="fas fa-plus mr-1"></i> 新規
                        </button>
                    </div>
                </div>
                
                <!-- ディレクトリ内の区画一覧 (このディレクトリがアクティブな場合のみ表示) -->
                <div class="fields-container ${isActive ? '' : 'hidden'} pl-3 mt-2 space-y-2">
                    ${fields.length === 0 ? `
                        <div class="add-new-field-container mb-2">
                            <button class="add-new-field-btn w-full text-xs bg-green-100 text-green-800 px-2 py-2 rounded hover:bg-green-200 flex items-center justify-center">
                                <i class="fas fa-plus mr-1"></i> 新規区画を追加
                            </button>
                        </div>
                        <div class="text-xs text-gray-500 py-2 pl-2 italic">
                            区画がありません
                        </div>
                    ` : 
                    renderFieldsInDirectory(fields)
                    }
                </div>
            </div>
        `;
    });
    
    directoriesList.innerHTML = html;
    
    // ディレクトリアイテムのイベントリスナーを設定
    setupDirectoryItemEventListeners();
    
    // 区画アイテムのイベントリスナーを設定
    setupFieldItemEventListeners();
    
    // チェックボックスの中間状態を設定（HTMLの属性だけでは効かないため）
    document.querySelectorAll('.directory-select-all[indeterminate="true"]').forEach(checkbox => {
        checkbox.indeterminate = true;
    });
}

// 特定ディレクトリ内の区画リストをレンダリング
function renderFieldsInDirectory(fields) {
    // 検索フィルタリング
    const searchTerm = fieldSearchInput ? fieldSearchInput.value.trim() : '';
    if (searchTerm) {
        fields = fields.filter(field => 
            field.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (field.memo && field.memo.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }
    
    // ソート
    fields = sortFields(fields, currentSortBy, currentSortOrder);
    
    // 新規区画追加ボタンをリストの最上部に表示
    let html = `
        <div class="add-new-field-container mb-2">
            <button class="add-new-field-btn w-full text-xs bg-green-100 text-green-800 px-2 py-2 rounded hover:bg-green-200 flex items-center justify-center">
                <i class="fas fa-plus mr-1"></i> 新規区画を追加
            </button>
        </div>
    `;
    
    // 新規区画フォームがすでに表示されている場合は、ここで非表示にする
    // これにより、renderFieldsList()が呼ばれるたびにフォームが元の位置に戻るのを防ぐ
    if (newFieldForm && !newFieldForm.classList.contains('hidden')) {
        newFieldForm.classList.add('hidden');
        // showNewFieldForm()を呼び出して適切な位置に再表示
        setTimeout(() => showNewFieldForm(), 0);
    }
    
    // 結果が空の場合
    if (fields.length === 0) {
        html += `
            <div class="text-xs text-gray-500 py-2 pl-2 italic">
                ${searchTerm ? '検索条件に一致する区画がありません。' : '区画がありません。'}
            </div>
        `;
        return html;
    }
    
    // リスト表示
    fields.forEach(field => {
        const isSelected = selectedFields.includes(field.id);
        const isCurrent = field.id === currentFieldId;
        
        const hasAnalysis = field.lastAnalysis != null;
        const analysisDate = hasAnalysis 
            ? new Date(field.lastAnalysis.analyzedAt).toLocaleDateString() 
            : null;
        
        html += `
            <div class="field-item p-2 border border-l-4 rounded-lg cursor-pointer transition 
                ${isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-gray-200 border-l-gray-300'} 
                ${isCurrent ? 'ring-2 ring-green-500' : ''}" 
                data-field-id="${field.id}" draggable="true">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center">
                            <input type="checkbox" class="field-select-checkbox mr-2 h-4 w-4 text-blue-600 rounded" 
                                ${isSelected ? 'checked' : ''}>
                            <h3 class="font-medium text-gray-800">${escapeHtml(field.name)}</h3>
                            ${isCurrent ? 
                                `<span class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded ml-2">表示中</span>` : 
                                ''}
                        </div>
                        <div class="flex items-center">
                            ${field.crop ? `<span class="text-xs text-gray-600 mr-2">作物: ${escapeHtml(field.crop)}</span>` : ''}
                            ${field.memo ? `<p class="text-xs text-gray-500 mt-1">${escapeHtml(field.memo)}</p>` : ''}
                        </div>
                    </div>
                </div>
                <div class="mt-1 text-xs text-gray-500">
                    ${hasAnalysis ? 
                        `<div class="flex items-center">
                            <i class="fas fa-chart-line mr-1"></i> 
                            <span class="px-1 py-0.5 rounded ${getHealthStatusClass(getLastAnalysisValue(field.lastAnalysis))}">
                                NDVI: ${formatAnalysisValue(field.lastAnalysis)}
                            </span>
                            <span class="ml-2">${analysisDate}</span>
                        </div>` : 
                        '<div>未分析</div>'}
                </div>
                <div class="flex justify-end mt-1 space-x-1">
                    <button class="field-view-btn text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded hover:bg-gray-200">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="field-analyze-btn text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200">
                        <i class="fas fa-chart-line"></i>
                    </button>
                    <button class="field-edit-btn text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded hover:bg-gray-200">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
                
                <!-- インライン編集フォーム -->
                <div class="field-edit-form mt-2 hidden" data-field-id="${field.id}">
                    <div class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">圃場名</label>
                            <input type="text" class="edit-field-name-input mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm" 
                                value="${escapeHtml(field.name)}">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">メモ (任意)</label>
                            <textarea class="edit-field-memo-input mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm" rows="2">${escapeHtml(field.memo || '')}</textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">作物名 (任意)</label>
                            <input type="text" class="edit-field-crop-input mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm" 
                                value="${escapeHtml(field.crop || '')}">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">所属リスト</label>
                            <select class="edit-field-directory-select mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm">
                                <!-- 選択肢はJSで動的に生成 -->
                            </select>
                        </div>
                        <div class="flex justify-between space-x-2">
                            <button class="delete-field-btn px-3 py-2 border border-red-300 rounded-md text-sm text-red-700 hover:bg-red-50">
                                <i class="fas fa-trash-alt mr-1"></i> 削除
                            </button>
                            <div class="flex space-x-2">
                                <button class="cancel-edit-field px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                                    キャンセル
                                </button>
                                <button class="save-edit-field px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700">
                                    更新する
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    return html;
}

// ディレクトリアイテムのイベントリスナー設定
function setupDirectoryItemEventListeners() {
    // ディレクトリ選択チェックボックスのイベント
    document.querySelectorAll('.directory-select-all').forEach(checkbox => {
        checkbox.addEventListener('change', function(e) {
            e.stopPropagation(); // ディレクトリのクリックイベントが発火しないようにする
            
            const dirId = this.dataset.directoryId;
            const isChecked = this.checked;
            
            // ディレクトリ内の全区画を取得
            const fields = getFieldsInDirectory(dirId);
            
            if (isChecked) {
                // すべての区画を選択リストに追加
                fields.forEach(field => {
                    if (!selectedFields.includes(field.id)) {
                        selectedFields.push(field.id);
                    }
                });
            } else {
                // このディレクトリの区画をすべて選択リストから削除
                selectedFields = selectedFields.filter(id => 
                    !fields.some(field => field.id === id)
                );
            }
            
            // 表示を更新
            renderDirectoriesList();
            
            // 複数選択パネルの更新
            updateMultiSelectionPanel();
        });
    });

    // ディレクトリ名のダブルクリックでインライン編集
    document.querySelectorAll('.directory-name').forEach(nameElement => {
        const directoryId = nameElement.dataset.directoryId;
        
        // ダブルクリックでインライン編集を開始
        nameElement.addEventListener('dblclick', function(e) {
            startDirectoryEdit(this, directoryId);
        });
    });
    
    // 編集アイコンのクリックイベント
    document.querySelectorAll('.directory-edit-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const dirId = this.closest('.directory-item').dataset.directoryId;
            showEditDirectoryForm(dirId);
        });
    });

    // インライン編集フォームの保存ボタン
    document.querySelectorAll('.save-edit-directory').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const dirItem = this.closest('.directory-item');
            const dirId = dirItem.dataset.directoryId;
            const nameInput = dirItem.querySelector('.edit-directory-name-input');
            const cropInput = dirItem.querySelector('.edit-directory-crop-input');
            
            saveDirectoryNameInlineForm(dirId, nameInput.value, cropInput.value);
        });
    });

    // インライン編集フォームのキャンセルボタン
    document.querySelectorAll('.cancel-edit-directory').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const dirId = this.closest('.directory-item').dataset.directoryId;
            hideEditDirectoryForm(dirId);
        });
    });

    // インライン編集フォームの削除ボタン
    document.querySelectorAll('.delete-directory-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const dirId = this.closest('.directory-item').dataset.directoryId;
            deleteDirectoryConfirmInline(dirId);
        });
    });

    // ディレクトリアイテムのクリックイベント
    document.querySelectorAll('.directory-item').forEach(dirItem => {
        // ディレクトリ自体のクリックイベント（アクティブ化）
        dirItem.addEventListener('click', function(e) {
            // チェックボックスやボタンのクリックは除外
            if (e.target.closest('button') || e.target.closest('input[type="checkbox"]')) return;
            // 編集フォームがある場合もクリックを無視
            if (e.target.closest('.directory-edit-form')) return;
            
            const dirId = this.dataset.directoryId;
            activateDirectory(dirId);
        });
        
        // 新規ボタンのクリックイベント
        const addFieldBtn = dirItem.querySelector('.add-field-btn');
        if (addFieldBtn) {
            addFieldBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const dirId = dirItem.closest('.directory-item').dataset.directoryId;
                activateDirectory(dirId);
                showNewFieldForm();
            });
        }
        
        // ドラッグ&ドロップのイベント
        dirItem.addEventListener('dragstart', handleDirectoryDragStart);
        dirItem.addEventListener('dragover', handleDirectoryDragOver);
        dirItem.addEventListener('dragleave', handleDirectoryDragLeave);
        dirItem.addEventListener('dragend', handleDirectoryDragEnd);
        dirItem.addEventListener('drop', handleDirectoryDrop);
    });
}

// ディレクトリ名編集開始の共通処理
function startDirectoryEdit(nameElement, directoryId) {
    // 代わりにインライン編集フォームを表示する
    showEditDirectoryForm(directoryId);
}

// ディレクトリをアクティブ化
function activateDirectory(dirId) {
    currentDirectoryId = dirId;
    renderDirectoriesList();
    renderFieldsList();
}

// ドラッグ&ドロップイベントハンドラ
let draggedFieldId = null;
let draggedDirectoryId = null;

// ディレクトリのドラッグ開始
function handleDirectoryDragStart(e) {
    // デフォルトディレクトリは移動不可
    if (this.dataset.directoryId === DEFAULT_DIRECTORY_ID) {
        e.preventDefault();
        return;
    }
    
    draggedDirectoryId = this.dataset.directoryId;
    this.classList.add('opacity-50');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.directoryId);
}

// ディレクトリのドラッグ中
function handleDirectoryDragOver(e) {
    e.preventDefault();
    // 自分自身へのドラッグやデフォルトディレクトリへのディレクトリドラッグは不可
    if (draggedDirectoryId && (draggedDirectoryId === this.dataset.directoryId || 
        (this.dataset.directoryId === DEFAULT_DIRECTORY_ID && draggedDirectoryId))) {
        return;
    }
    
    this.classList.add('bg-blue-100', 'border-blue-300');
}

// ディレクトリから離れる
function handleDirectoryDragLeave(e) {
    if (this.dataset.directoryId !== currentDirectoryId) {
        this.classList.remove('bg-blue-100', 'border-blue-300');
    }
}

// ディレクトリのドラッグ終了
function handleDirectoryDragEnd(e) {
    this.classList.remove('opacity-50');
    document.querySelectorAll('.directory-item').forEach(item => {
        if (item.dataset.directoryId !== currentDirectoryId) {
            item.classList.remove('bg-blue-100', 'border-blue-300');
        }
    });
    draggedDirectoryId = null;
}

// ディレクトリへのドロップ
function handleDirectoryDrop(e) {
    e.preventDefault();
    this.classList.remove('bg-blue-100', 'border-blue-300');
    
    const targetDirId = this.dataset.directoryId;
    
    // フィールドのドラッグ&ドロップの場合
    if (draggedFieldId) {
        try {
            moveFieldToDirectory(draggedFieldId, targetDirId);
            renderFieldsList();
            showToast('成功', `区画を「${getDirectoryById(targetDirId).name}」に移動しました`);
        } catch (error) {
            showToast('エラー', error.message);
        }
        draggedFieldId = null;
        return;
    }
    
    // 自分自身へのドラッグは不可
    if (draggedDirectoryId === targetDirId) {
        return;
    }
    
    // ディレクトリ間の移動は現在のバージョンではサポートしていません
    showToast('情報', 'リスト間の移動は現在サポートされていません');
    draggedDirectoryId = null;
}

// 区画リストの描画
function renderFieldsList() {
    if (!fieldsList) return;
    
    // fieldsList要素を隠す（入れ子表示方式に変更するため）
    fieldsList.classList.add('hidden');
    
    // ディレクトリリストを再描画して最新状態を反映
    renderDirectoriesList();
    
    // 複数選択パネルの表示・非表示
    updateMultiSelectionPanel();
}

// 区画アイテムのイベントリスナー設定
function setupFieldItemEventListeners() {
    // チェックボックスのイベント
    document.querySelectorAll('.field-select-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function(e) {
            e.stopPropagation();
            const fieldItem = this.closest('.field-item');
            const fieldId = fieldItem.dataset.fieldId;
            
            if (this.checked) {
                // 選択リストに追加
                if (!selectedFields.includes(fieldId)) {
                    selectedFields.push(fieldId);
                }
            } else {
                // 選択リストから削除
                selectedFields = selectedFields.filter(id => id !== fieldId);
            }
            
            // ディレクトリリストを再描画して親チェックボックス状態を更新
            renderDirectoriesList();
            
            // 複数選択パネルの更新
            updateMultiSelectionPanel();
        });
    });
    
    // 新規区画追加ボタンのイベント
    document.querySelectorAll('.add-new-field-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            showNewFieldForm();
        });
    });
    
    // フィールドアイテムのクリックイベント
    document.querySelectorAll('.field-item').forEach(item => {
        // 表示ボタン
        const viewBtn = item.querySelector('.field-view-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const fieldId = item.dataset.fieldId;
                displayField(fieldId);
            });
        }
        
        // 分析ボタン
        const analyzeBtn = item.querySelector('.field-analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const fieldId = item.dataset.fieldId;
                analyzeField(fieldId);
            });
        }
        
        // 編集ボタン
        const editBtn = item.querySelector('.field-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const fieldId = item.dataset.fieldId;
                showInlineEditFieldForm(fieldId);
            });
        }
        
        // インラインフォームのキャンセルボタン
        const cancelEditBtn = item.querySelector('.cancel-edit-field');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const fieldId = item.dataset.fieldId;
                hideInlineEditFieldForm(fieldId);
            });
        }
        
        // インラインフォームの保存ボタン
        const saveEditBtn = item.querySelector('.save-edit-field');
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const fieldId = item.dataset.fieldId;
                saveInlineEditField(fieldId);
            });
        }
        
        // インラインフォームの削除ボタン
        const deleteBtn = item.querySelector('.delete-field-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const fieldId = item.dataset.fieldId;
                deleteFieldInline(fieldId);
            });
        }
        
        // アイテム全体のクリックでも表示可能
        item.addEventListener('click', function(e) {
            // チェックボックスやボタンのクリックではない場合のみ
            if (!e.target.closest('button') && !e.target.closest('input[type="checkbox"]') && !e.target.closest('.field-edit-form')) {
                const fieldId = this.dataset.fieldId;
                displayField(fieldId);
            }
        });
        
        // ドラッグ&ドロップのイベント
        item.setAttribute('draggable', 'true');
        
        item.addEventListener('dragstart', function(e) {
            draggedFieldId = this.dataset.fieldId;
            this.classList.add('opacity-50', 'bg-yellow-50');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.dataset.fieldId);
        });
        
        item.addEventListener('dragend', function(e) {
            this.classList.remove('opacity-50', 'bg-yellow-50');
            document.querySelectorAll('.directory-item').forEach(dir => {
                if (dir.dataset.directoryId !== currentDirectoryId) {
                    dir.classList.remove('bg-blue-100', 'border-blue-300');
                }
            });
            // 同じディレクトリ内のフィールドのドロップハイライトを削除
            document.querySelectorAll('.field-item').forEach(field => {
                field.classList.remove('border-blue-300', 'bg-blue-50');
            });
            draggedFieldId = null;
        });
        
        // 同一リスト内での並び替え用のイベント
        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            // 同一ディレクトリ内のドラッグ&ドロップのみ許可
            if (draggedFieldId && draggedFieldId !== this.dataset.fieldId) {
                this.classList.add('border-blue-300', 'bg-blue-50');
            }
        });
        
        item.addEventListener('dragleave', function(e) {
            this.classList.remove('border-blue-300', 'bg-blue-50');
        });
        
        item.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('border-blue-300', 'bg-blue-50');
            
            if (draggedFieldId && draggedFieldId !== this.dataset.fieldId) {
                const sourceFieldId = draggedFieldId;
                const targetFieldId = this.dataset.fieldId;
                // 同じディレクトリ内での並び替え
                handleFieldReorder(sourceFieldId, targetFieldId);
            }
        });
        
        // インライン編集フォームのディレクトリ選択肢を設定
        const directorySelect = item.querySelector('.edit-field-directory-select');
        if (directorySelect) {
            updateDirectorySelect(directorySelect, item.dataset.fieldId ? getFieldById(item.dataset.fieldId).directoryId : currentDirectoryId);
        }
    });
}

// 区画を表示
function displayField(fieldId) {
    const field = getFieldById(fieldId);
    if (!field) return;
    
    // 現在の区画IDを設定
    currentFieldId = fieldId;
    window.currentFieldId = fieldId;
    
    // マップに表示
    displayFieldOnMap(field);
    
    // 圃場名を表示
    if (currentFieldNameEl) {
        currentFieldNameEl.textContent = field.name;
    }
    
    // リストを再描画して表示中状態を反映
    renderFieldsList();
    
    // モバイルでサイドバーが開いていたら閉じる
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        document.body.classList.remove('sidebar-open');
    }
}

// 区画を分析
function analyzeField(fieldId) {
    console.log('=== analyzeField 呼び出し ===');
    console.log('引数 fieldId:', fieldId);
    
    const field = getFieldById(fieldId);
    console.log('取得した圃場データ:', field);
    if (!field) {
        console.error('圃場データが取得できませんでした:', fieldId);
        return;
    }
    
    // まず区画を表示
    console.log('displayFieldを呼び出します:', fieldId);
    displayField(fieldId);
    
    // currentFieldIdが正しく設定されたか確認
    console.log('displayField後のcurrentFieldId:', window.currentFieldId);
    
    // 分析を実行
    if (typeof runAnalysis === 'function') {
        console.log('runAnalysisを呼び出します:', field.id);
        runAnalysis(field.id);
    } else {
        console.error('分析関数が定義されていません');
    }
}

// 複数選択パネル更新
function updateMultiSelectionPanel() {
    if (!multiSelectionPanel || !selectedFieldsCount) return;
    
    if (selectedFields.length > 0) {
        multiSelectionPanel.classList.remove('hidden');
        selectedFieldsCount.textContent = selectedFields.length;
    } else {
        multiSelectionPanel.classList.add('hidden');
    }
}

// 選択解除
function clearFieldSelection() {
    selectedFields = [];
    renderDirectoriesList();
    updateMultiSelectionPanel();
}

// 全ての区画を選択
function selectAllFields() {
    // 全ての区画を取得
    const allFields = getFieldsList();
    
    // 選択リストをクリア
    selectedFields = [];
    
    // 全区画を選択リストに追加
    allFields.forEach(field => {
        selectedFields.push(field.id);
    });
    
    // 表示を更新
    renderDirectoriesList();
    updateMultiSelectionPanel();
}

// 比較分析
function compareSelectedFields() {
    if (selectedFields.length < 2) {
        showToast('エラー', '比較するには2つ以上の区画を選択してください');
        return;
    }
    
    const fields = getSelectedFields(selectedFields);
    console.log('選択された区画を比較:', fields);
    
    // 比較モーダルを表示する処理を実装予定
    showCompletionModal('開発中', '区画比較機能は開発中です。現在は表示される区画の情報を個別に確認してください。');
}

// 一括分析
function batchAnalyzeSelectedFields() {
    if (selectedFields.length === 0) {
        showToast('エラー', '分析する区画を選択してください');
        return;
    }
    
    const fields = getSelectedFields(selectedFields);
    console.log('選択された区画を一括分析:', fields);
    
    // 一括分析機能を実装予定
    showCompletionModal('開発中', '一括分析機能は開発中です。現在は個別に分析を実行してください。');
}

// 新規区画の保存
function saveNewField() {
    const nameInput = document.getElementById('fieldName');
    const memoInput = document.getElementById('fieldMemo');
    const cropInput = document.getElementById('fieldCrop');
    const dirSelect = document.getElementById('fieldDirectorySelect');
    
    // 入力チェック
    if (!nameInput.value.trim()) {
        showToast('エラー', '圃場名を入力してください');
        nameInput.focus();
        return;
    }
    
    // 描画チェック
    if (!currentAOIGeoJSON) {
        showToast('エラー', 'マップ上で区画を描画してください');
        return;
    }
    
    try {
        // 中心座標の計算
        const center = calculateFieldCenter(currentAOIGeoJSON);
        
        // 選択されたディレクトリID（または現在のディレクトリID）
        const selectedDirId = dirSelect && dirSelect.value ? dirSelect.value : currentDirectoryId;
        
        // 新規区画の作成
        const newField = addField({
            name: nameInput.value.trim(),
            memo: memoInput.value.trim(),
            crop: cropInput.value.trim(),
            center: center,
            geoJSON: currentAOIGeoJSON,
            color: CONFIG.FIELDS.DEFAULT_COLOR,
            directoryId: selectedDirId
        });
        
        console.log('新規圃場を登録しました:', newField);
        
        // 現在のディレクトリが異なる場合は切り替え
        if (currentDirectoryId !== selectedDirId) {
            activateDirectory(selectedDirId);
        } else {
            // 同じディレクトリならフィールドリストだけ更新
            renderFieldsList();
        }
        
        // ディレクトリリストも強制的に更新（アイテム数の反映）
        renderDirectoriesList();
        
        // マップ上の保存済み圃場も更新
        if (typeof loadSavedFields === 'function') {
            loadSavedFields();
        }
        
        // フォームを閉じる
        console.log('区画保存成功 - フォームを閉じます');
        hideNewFieldForm();
        
        // 保存した区画を表示
        displayField(newField.id);
        
        // 成功メッセージ
        showToast('成功', '新規区画を登録しました');
    } catch (error) {
        console.error('区画保存エラー:', error);
        showToast('エラー', `区画の保存に失敗しました: ${error.message}`);
        // エラーが発生した場合でもフォームを閉じる
        console.log('区画保存エラー - フォームを閉じます');
        hideNewFieldForm();
    }
}

// 新規区画フォームを表示
function showNewFieldForm() {
    hideAllEditForms();
    
    // 所属リストのセレクトボックスを更新
    updateDirectorySelect(fieldDirectorySelect, currentDirectoryId);
    
    if (newFieldForm) {
        // フォームを表示する前に、「新規追加」ボタンの位置までスクロール
        const addNewFieldBtn = document.querySelector('.add-new-field-btn');
        if (addNewFieldBtn) {
            addNewFieldBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // フォームを「新規追加」ボタンの直後に移動
        const addNewFieldContainer = document.querySelector('.add-new-field-container');
        if (addNewFieldContainer && addNewFieldContainer.parentNode) {
            // フォームをボタンの直後に挿入
            addNewFieldContainer.parentNode.insertBefore(newFieldForm, addNewFieldContainer.nextSibling);
        }
        
        newFieldForm.classList.remove('hidden');
        document.getElementById('fieldName').focus();
        
        // 描画状態の更新
        updateDrawingStatus();
    }
}

// 新規区画フォームを隠す
function hideNewFieldForm() {
    // DOM内から確実にフォームを見つけて非表示にする
    const currentForm = document.getElementById('newFieldForm');
    if (currentForm) {
        currentForm.classList.add('hidden');
        
        // 要素の存在確認をしてからvalue設定
        const fieldNameEl = document.getElementById('fieldName');
        const fieldMemoEl = document.getElementById('fieldMemo');
        const fieldCropEl = document.getElementById('fieldCrop');
        
        if (fieldNameEl) fieldNameEl.value = '';
        if (fieldMemoEl) fieldMemoEl.value = '';
        if (fieldCropEl) fieldCropEl.value = '';
        
        console.log('新規区画フォームを非表示にしました');
    } else {
        console.warn('新規区画フォームが見つかりませんでした');
    }
}

// 新規ディレクトリフォームを表示
function showNewDirectoryForm() {
    hideAllEditForms();
    
    if (newDirectoryForm) {
        newDirectoryForm.classList.remove('hidden');
        directoryName.focus();
    }
}

// 新規ディレクトリフォームを閉じる
function hideNewDirectoryForm() {
    if (newDirectoryForm) {
        newDirectoryForm.classList.add('hidden');
        directoryName.value = '';
        
        // 作物入力フィールドもクリア
        const cropInput = document.getElementById('directoryCrop');
        if (cropInput) {
            cropInput.value = '';
        }
    }
}

// 編集ディレクトリフォームを表示（インライン版）
function showEditDirectoryForm(dirId) {
    // すべての編集フォームを非表示
    hideAllEditForms();
    
    // 対象のディレクトリの編集フォームを表示
    const form = document.querySelector(`.directory-edit-form[data-directory-id="${dirId}"]`);
    if (form) {
        form.classList.remove('hidden');
        const nameInput = form.querySelector('.edit-directory-name-input');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }
}

// 編集ディレクトリフォームを閉じる（インライン版）
function hideEditDirectoryForm(dirId) {
    if (dirId) {
        // 特定のディレクトリの編集フォームを非表示
        const form = document.querySelector(`.directory-edit-form[data-directory-id="${dirId}"]`);
        if (form) {
            form.classList.add('hidden');
        }
    } else {
        // すべての編集フォームを非表示
        document.querySelectorAll('.directory-edit-form').forEach(form => {
            form.classList.add('hidden');
        });
    }
}

// 編集フォームを表示（従来版 - 今後は非推奨）
function showEditFieldForm(fieldId) {
    // インライン編集に置き換え
    showInlineEditFieldForm(fieldId);
}

// 区画編集を保存
function saveEditField() {
    if (!editFieldId.value) return;
    
    // 入力チェック
    if (!editFieldName.value.trim()) {
        showToast('エラー', '圃場名を入力してください');
        editFieldName.focus();
        return;
    }
    
    try {
        // 区画の更新
        const updatedField = updateField(editFieldId.value, {
            name: editFieldName.value.trim(),
            memo: editFieldMemo.value.trim(),
            crop: editFieldCrop.value.trim(),
            directoryId: editFieldDirectorySelect.value
        });
        
        console.log('区画情報を更新しました:', updatedField);
        
        // フォームを閉じる
        hideEditFieldForm();
        
        // リストを更新（表示中のディレクトリと所属ディレクトリが異なる場合は切り替え）
        if (currentDirectoryId !== updatedField.directoryId) {
            activateDirectory(updatedField.directoryId);
        } else {
            renderFieldsList();
        }
        
        // 表示中の区画名も更新
        if (currentFieldId === updatedField.id && currentFieldNameEl) {
            currentFieldNameEl.textContent = updatedField.name;
        }
        
        // 成功メッセージ
        showToast('成功', '区画情報を更新しました');
    } catch (error) {
        console.error('区画更新エラー:', error);
        showToast('エラー', `区画の更新に失敗しました: ${error.message}`);
    }
}

// 区画削除の確認
function deleteFieldConfirm() {
    if (!editFieldId.value) return;
    
    if (confirm('この区画を削除してもよろしいですか？この操作は元に戻せません。')) {
        try {
            // 区画の削除
            deleteField(editFieldId.value);
            
            console.log('区画を削除しました:', editFieldId.value);
            
            // 現在表示中の区画が削除された場合
            if (currentFieldId === editFieldId.value) {
                clearDrawing();
                if (currentFieldNameEl) {
                    currentFieldNameEl.textContent = '';
                }
                currentFieldId = null;
            }
            
            // フォームを閉じてリストを更新
            hideEditFieldForm();
            renderFieldsList();
            
            // 選択リストからも削除
            selectedFields = selectedFields.filter(id => id !== editFieldId.value);
            updateMultiSelectionPanel();
            
            // 成功メッセージ
            showToast('成功', '区画を削除しました');
        } catch (error) {
            console.error('区画削除エラー:', error);
            showToast('エラー', `区画の削除に失敗しました: ${error.message}`);
        }
    }
}

// マップ上に区画を表示
function displayFieldOnMap(field) {
    // map.jsで定義されているはずの関数を呼び出し
    if (typeof displayGeoJSON === 'function') {
        displayGeoJSON(field.geoJSON, field.color);
    } else {
        console.error('displayGeoJSON関数が定義されていません');
    }
}

// ソート順アイコンの更新
function updateSortOrderIcon() {
    if (sortOrderBtn) {
        sortOrderBtn.innerHTML = currentSortOrder
            ? '<i class="fas fa-sort-amount-up"></i>'
            : '<i class="fas fa-sort-amount-down"></i>';
    }
}

// 表示モードアイコンの更新
function updateViewModeIcon() {
    if (viewModeBtn) {
        viewModeBtn.innerHTML = isListView
            ? '<i class="fas fa-th-list"></i>'
            : '<i class="fas fa-th"></i>';
    }
}

// 描画状態の更新
function updateDrawingStatus() {
    if (!fieldDrawnConfirmation || !drawInstructionText) return;
    
    if (currentAOIGeoJSON) {
        fieldDrawnConfirmation.classList.remove('hidden');
        drawInstructionText.classList.add('hidden');
    } else {
        fieldDrawnConfirmation.classList.add('hidden');
        drawInstructionText.classList.remove('hidden');
    }
}

// NDVI値に基づくスタイルクラスを取得
function getHealthStatusClass(ndviValue) {
    // 数値でない場合、または無効な値の場合
    if (ndviValue === null || ndviValue === undefined || isNaN(ndviValue)) {
        return 'bg-gray-100 text-gray-800';
    }
    
    // 数値に変換
    const value = parseFloat(ndviValue);
    
    if (value > CONFIG.NDVI.GOOD) {
        return 'bg-green-100 text-green-800';
    } else if (value > CONFIG.NDVI.MODERATE) {
        return 'bg-yellow-100 text-yellow-800';
    } else {
        return 'bg-red-100 text-red-800';
    }
}

// HTML文字列のエスケープ
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// デバウンス関数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    // サイドバーイベントリスナーの設定
    setupSidebarEventListeners();
    
    // ソートアイコンの初期化
    updateSortOrderIcon();
    
    // 表示モードアイコンの初期化
    updateViewModeIcon();
    
    // ディレクトリと区画リストの初期描画
    renderDirectoriesList();
    renderFieldsList();
});

// 所属リスト選択肢の更新
function updateDirectorySelect(selectElement, selectedDirId) {
    if (!selectElement) return;
    
    const directories = getDirectoriesList();
    const sortedDirectories = sortDirectories(directories);
    
    // オプションをクリア
    selectElement.innerHTML = '';
    
    // 選択肢を作成
    sortedDirectories.forEach(dir => {
        const option = document.createElement('option');
        option.value = dir.id;
        option.textContent = dir.name;
        selectElement.appendChild(option);
    });
    
    // 現在のディレクトリを選択
    if (selectedDirId) {
        selectElement.value = selectedDirId;
    }
}

// 新規ディレクトリの保存
function saveNewDirectoryHandler() {
    if (!directoryName.value.trim()) {
        showToast('エラー', 'リスト名を入力してください');
        directoryName.focus();
        return;
    }
    
    // 作物名の入力チェック
    const cropName = document.getElementById('directoryCrop').value.trim();
    if (!cropName) {
        showToast('エラー', '作物名を入力してください');
        document.getElementById('directoryCrop').focus();
        return;
    }
    
    try {
        // 新規ディレクトリの作成
        const newDirectory = addDirectory({
            name: directoryName.value.trim(),
            crop: cropName
        });
        
        console.log('新規リストを作成しました:', newDirectory);
        
        // フォームを閉じてリストを更新
        hideNewDirectoryForm();
        renderDirectoriesList();
        
        // 作成したディレクトリをアクティブ化
        activateDirectory(newDirectory.id);
        
        // 成功メッセージ
        showToast('成功', '新規リストを作成しました');
    } catch (error) {
        console.error('リスト作成エラー:', error);
        showToast('エラー', `リストの作成に失敗しました: ${error.message}`);
    }
}

// インライン編集フォームを表示
function showInlineEditFieldForm(fieldId) {
    // 他の編集フォームを全て非表示
    hideAllEditForms();
    
    // 対象の区画の編集フォームを表示
    const form = document.querySelector(`.field-edit-form[data-field-id="${fieldId}"]`);
    if (form) {
        form.classList.remove('hidden');
        const nameInput = form.querySelector('.edit-field-name-input');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
        
        // ディレクトリ選択肢を更新
        const directorySelect = form.querySelector('.edit-field-directory-select');
        if (directorySelect) {
            updateDirectorySelect(directorySelect, getFieldById(fieldId).directoryId);
        }
    }
}

// インライン編集フォームを非表示
function hideInlineEditFieldForm(fieldId) {
    if (fieldId) {
        const form = document.querySelector(`.field-edit-form[data-field-id="${fieldId}"]`);
        if (form) {
            form.classList.add('hidden');
        }
    } else {
        document.querySelectorAll('.field-edit-form').forEach(form => {
            form.classList.add('hidden');
        });
    }
}

// 全ての編集フォームを非表示
function hideAllEditForms() {
    // ディレクトリ編集フォーム
    hideEditDirectoryForm();
    // 区画編集フォーム（従来型）
    hideEditFieldForm();
    // 区画編集フォーム（インライン型）
    hideInlineEditFieldForm();
    // 新規フォーム
    hideNewFieldForm();
    hideNewDirectoryForm();
}

// インラインフォームからディレクトリ名を保存
function saveDirectoryNameInlineForm(directoryId, newName, newCrop) {
    const formElement = document.querySelector(`.directory-edit-form[data-directory-id="${directoryId}"]`);
    if (!formElement) return;
    
    const nameInput = formElement.querySelector('.edit-directory-name-input');
    const cropInput = formElement.querySelector('.edit-directory-crop-input');
    
    newName = nameInput.value.trim();
    newCrop = cropInput.value.trim();
    
    // 名前が空の場合
    if (!newName) {
        showToast('エラー', 'リスト名を入力してください');
        return;
    }
    
    try {
        // ディレクトリの更新
        const updatedDirectory = updateDirectory(directoryId, {
            name: newName,
            crop: newCrop
        });
        
        // フォームを閉じてリストを更新
        hideEditDirectoryForm(directoryId);
        renderDirectoriesList();
        
        // 成功メッセージ
        showToast('成功', 'リスト情報を更新しました');
    } catch (error) {
        console.error('リスト更新エラー:', error);
        showToast('エラー', `リストの更新に失敗しました: ${error.message}`);
    }
}

// インラインでディレクトリ削除の確認
function deleteDirectoryConfirmInline(directoryId) {
    // 最後の唯一のディレクトリの場合は削除不可
    const directories = getDirectoriesList();
    if (directories.length <= 1) {
        showToast('警告', '最後のリストは削除できません。少なくとも1つのリストが必要です。');
        return;
    }
    
    if (confirm('このリストを削除してもよろしいですか？このリスト内の区画は他のリストに移動します。この操作は元に戻せません。')) {
        try {
            // ディレクトリの削除
            deleteDirectory(directoryId);
            
            console.log('リストを削除しました:', directoryId);
            
            // 現在表示中のディレクトリが削除された場合
            if (currentDirectoryId === directoryId) {
                // 残りのディレクトリの最初のものを選択
                const remainingDirs = getDirectoriesList();
                if (remainingDirs.length > 0) {
                    currentDirectoryId = remainingDirs[0].id;
                }
            }
            
            // リストを更新
            renderDirectoriesList();
            renderFieldsList();
            
            // 成功メッセージ
            showToast('成功', 'リストを削除しました');
        } catch (error) {
            console.error('リスト削除エラー:', error);
            showToast('エラー', `リストの削除に失敗しました: ${error.message}`);
        }
    }
}

// 編集フォームを隠す（従来型）
function hideEditFieldForm() {
    if (editFieldForm) {
        editFieldForm.classList.add('hidden');
    }
}

// 分析結果の値を安全に取得する関数
function getLastAnalysisValue(lastAnalysis) {
    if (!lastAnalysis) return null;
    
    // 新しい形式: lastAnalysis.stats.ndvi.mean
    if (lastAnalysis.stats && lastAnalysis.stats.ndvi && typeof lastAnalysis.stats.ndvi.mean === 'string') {
        return parseFloat(lastAnalysis.stats.ndvi.mean);
    }
    
    // 旧形式: lastAnalysis.stats.mean
    if (lastAnalysis.stats && typeof lastAnalysis.stats.mean === 'number') {
        return lastAnalysis.stats.mean;
    }
    
    return null;
}

// 分析値を表示用にフォーマットする関数
function formatAnalysisValue(lastAnalysis) {
    if (!lastAnalysis) return '-';
    
    // 新しい形式: lastAnalysis.stats.ndvi.mean (すでに文字列の可能性)
    if (lastAnalysis.stats && lastAnalysis.stats.ndvi && typeof lastAnalysis.stats.ndvi.mean === 'string') {
        // すでに小数点以下が処理されているかチェック
        const value = lastAnalysis.stats.ndvi.mean;
        return value.includes('.') ? value : parseFloat(value).toFixed(2);
    }
    
    // 旧形式: lastAnalysis.stats.mean
    if (lastAnalysis.stats && typeof lastAnalysis.stats.mean === 'number') {
        return lastAnalysis.stats.mean.toFixed(2);
    }
    
    return '-';
}

// ディレクトリ編集ヒントを表示
function showDirectoryEditHint() {
    // ヒントがすでに表示されているかチェック
    const hintId = 'directory-edit-hint';
    if (document.getElementById(hintId)) return;
    
    // 初回のみヒントを表示
    const hintShown = localStorage.getItem('directoryEditHintShown');
    if (!hintShown) {
        // ヒントを表示
        const hint = document.createElement('div');
        hint.id = hintId;
        hint.className = 'fixed bottom-4 right-4 bg-blue-100 text-blue-800 p-4 rounded-lg shadow-lg max-w-xs z-50';
        hint.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <p class="text-sm font-medium">ヒント: リスト名をダブルクリックすると編集できます</p>
                </div>
                <button class="text-blue-500 hover:text-blue-700 ml-2" id="close-directory-hint">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(hint);
        
        // 閉じるボタンのイベント
        document.getElementById('close-directory-hint').addEventListener('click', () => {
            hint.remove();
            localStorage.setItem('directoryEditHintShown', 'true');
        });
        
        // 10秒後に自動的に消える
        setTimeout(() => {
            if (document.getElementById(hintId)) {
                hint.remove();
                localStorage.setItem('directoryEditHintShown', 'true');
            }
        }, 10000);
    }
}

// フィールドの並び替え処理を行う関数
function handleFieldReorder(sourceFieldId, targetFieldId) {
    try {
        console.log(`フィールド並び替え: ${sourceFieldId} -> ${targetFieldId}`);
        
        // 現在のディレクトリ内のフィールドを取得
        let fields = [];
        const allFields = JSON.parse(localStorage.getItem('fields') || '[]');
        fields = allFields.filter(field => field.directoryId === currentDirectoryId);
        
        if (!fields || fields.length < 2) return;
        
        // 並び替え前の順序をチェック（順序情報がなければインデックスを使用）
        fields.forEach((field, index) => {
            if (field.order === undefined) field.order = index * 10;
        });
        
        // ソースとターゲットのフィールドを特定
        const sourceField = fields.find(f => f.id === sourceFieldId);
        const targetField = fields.find(f => f.id === targetFieldId);
        
        if (!sourceField || !targetField) {
            console.error('並び替え対象のフィールドが見つかりません');
            return;
        }
        
        // 現在の順序でソート
        fields.sort((a, b) => a.order - b.order);
        
        // 新しい順序を計算
        const sourceIndex = fields.findIndex(f => f.id === sourceFieldId);
        const targetIndex = fields.findIndex(f => f.id === targetFieldId);
        
        if (sourceIndex === -1 || targetIndex === -1) {
            console.error('ソートインデックスが不正です');
            return;
        }
        
        // 配列から削除して新しい位置に挿入
        const [removed] = fields.splice(sourceIndex, 1);
        fields.splice(targetIndex, 0, removed);
        
        // 順序を再計算（10単位で）
        fields.forEach((field, index) => {
            field.order = index * 10;
        });
        
        // 順序を保存
        saveFieldsOrder(fields);
        
        // 再描画
        renderFieldsList();
        
    } catch (error) {
        console.error('フィールド並び替えエラー:', error);
    }
}

// フィールドの順序を保存する関数
function saveFieldsOrder(fieldsToUpdate) {
    try {
        // ローカルストレージから全フィールドデータを取得
        const allFields = JSON.parse(localStorage.getItem('fields') || '[]');
        
        // 各フィールドの順序情報を更新
        fieldsToUpdate.forEach(updatedField => {
            const existingFieldIndex = allFields.findIndex(f => f.id === updatedField.id);
            if (existingFieldIndex !== -1) {
                allFields[existingFieldIndex].order = updatedField.order;
                // 更新日時も更新
                allFields[existingFieldIndex].updatedAt = new Date().toISOString();
            }
        });
        
        // 更新したデータを保存
        localStorage.setItem('fields', JSON.stringify(allFields));
        console.log('フィールド順序を保存しました');
        
    } catch (error) {
        console.error('フィールド順序の保存に失敗:', error);
    }
}

// 既存のフィールドにorderプロパティを初期化する関数
function initializeFieldsOrder() {
    try {
        // ローカルストレージから全フィールドデータを取得
        const allFields = JSON.parse(localStorage.getItem('fields') || '[]');
        if (allFields.length === 0) return; // フィールドがなければ何もしない
        
        // ディレクトリごとにフィールドをグループ化
        const fieldsByDirectory = {};
        allFields.forEach(field => {
            if (!fieldsByDirectory[field.directoryId]) {
                fieldsByDirectory[field.directoryId] = [];
            }
            fieldsByDirectory[field.directoryId].push(field);
        });
        
        let needsUpdate = false;
        
        // 各ディレクトリ内のフィールドのorderプロパティを初期化
        Object.values(fieldsByDirectory).forEach(dirFields => {
            // 現在のソート順（updatedAt）でソート
            dirFields.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            
            // orderプロパティがないフィールドがあれば初期化する
            let hasUnorderedFields = dirFields.some(field => field.order === undefined);
            
            if (hasUnorderedFields) {
                // 10単位で順序を設定（後で間に挿入しやすくするため）
                dirFields.forEach((field, index) => {
                    if (field.order === undefined) {
                        field.order = index * 10;
                        needsUpdate = true;
                    }
                });
            }
        });
        
        // 更新が必要な場合は保存
        if (needsUpdate) {
            localStorage.setItem('fields', JSON.stringify(allFields));
            console.log('フィールド順序を初期化しました');
        }
        
        // 順序ソートを優先するように変更
        currentSortBy = 'order';
        
    } catch (error) {
        console.error('フィールド順序の初期化に失敗:', error);
    }
}

// インライン編集フォームでの区画削除確認
function deleteFieldInline(fieldId) {
    const field = getFieldById(fieldId);
    if (!field) {
        console.error('削除対象の区画が見つかりません:', fieldId);
        return;
    }
    
    if (confirm(`区画「${field.name}」を削除してもよろしいですか？この操作は元に戻せません。`)) {
        try {
            // 区画の削除
            deleteField(fieldId);
            
            console.log('区画を削除しました:', fieldId);
            
            // 現在表示中の区画が削除された場合
            if (currentFieldId === fieldId) {
                if (typeof clearDrawing === 'function') {
                    clearDrawing();
                }
                if (currentFieldNameEl) {
                    currentFieldNameEl.textContent = '';
                }
                currentFieldId = null;
            }
            
            // 選択リストからも削除
            selectedFields = selectedFields.filter(id => id !== fieldId);
            updateMultiSelectionPanel();
            
            // リストを更新
            renderDirectoriesList();
            renderFieldsList();
            
            // マップ上の保存済み圃場も更新
            if (typeof loadSavedFields === 'function') {
                loadSavedFields();
            }
            
            // 成功メッセージ
            if (typeof showToast === 'function') {
                showToast('成功', '区画を削除しました');
            }
        } catch (error) {
            console.error('区画削除エラー:', error);
            if (typeof showToast === 'function') {
                showToast('エラー', `区画の削除に失敗しました: ${error.message}`);
            }
        }
    }
}

// インライン編集フォームでの区画保存
function saveInlineEditField(fieldId) {
    const form = document.querySelector(`.field-edit-form[data-field-id="${fieldId}"]`);
    if (!form) {
        console.error('編集フォームが見つかりません:', fieldId);
        return;
    }
    
    const nameInput = form.querySelector('.edit-field-name-input');
    const memoInput = form.querySelector('.edit-field-memo-input');
    const cropInput = form.querySelector('.edit-field-crop-input');
    const directorySelect = form.querySelector('.edit-field-directory-select');
    
    // 入力チェック
    if (!nameInput || !nameInput.value.trim()) {
        if (typeof showToast === 'function') {
            showToast('エラー', '圃場名を入力してください');
        }
        if (nameInput) nameInput.focus();
        return;
    }
    
    try {
        // 区画の更新
        const updatedField = updateField(fieldId, {
            name: nameInput.value.trim(),
            memo: memoInput ? memoInput.value.trim() : '',
            crop: cropInput ? cropInput.value.trim() : '',
            directoryId: directorySelect ? directorySelect.value : currentDirectoryId
        });
        
        console.log('区画情報を更新しました:', updatedField);
        
        // インライン編集フォームを非表示
        hideInlineEditFieldForm(fieldId);
        
        // リストを更新（表示中のディレクトリと所属ディレクトリが異なる場合は切り替え）
        if (currentDirectoryId !== updatedField.directoryId) {
            activateDirectory(updatedField.directoryId);
        } else {
            renderDirectoriesList();
            renderFieldsList();
        }
        
        // 表示中の区画名も更新
        if (currentFieldId === updatedField.id && currentFieldNameEl) {
            currentFieldNameEl.textContent = updatedField.name;
        }
        
        // マップ上の保存済み圃場も更新
        if (typeof loadSavedFields === 'function') {
            loadSavedFields();
        }
        
        // 成功メッセージ
        if (typeof showToast === 'function') {
            showToast('成功', '区画情報を更新しました');
        }
    } catch (error) {
        console.error('区画更新エラー:', error);
        if (typeof showToast === 'function') {
            showToast('エラー', `区画の更新に失敗しました: ${error.message}`);
        }
    }
}