// DOM要素の参照
const processingModal = document.getElementById('processingModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const progressBar = document.getElementById('progressBar');
const progressBarContainer = document.getElementById('progressBarContainer');
const modalSpinner = document.getElementById('modalSpinner');
const modalCheck = document.getElementById('modalCheck');
const closeModalBtn = document.getElementById('closeModalBtn');
const toast = document.getElementById('toast');
const toastTitle = document.getElementById('toastTitle');
const toastMessage = document.getElementById('toastMessage');

// 処理中モーダルの表示
function showProcessingModal(title = "処理中", message = "しばらくお待ちください...") {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    progressBar.style.width = '0%';
    progressBarContainer.classList.remove('hidden');
    modalSpinner.classList.remove('hidden');
    modalCheck.classList.add('hidden');
    closeModalBtn.classList.add('hidden');
    processingModal.classList.remove('hidden');
}

// プログレスバーの更新
function updateProgressBar(percentage) {
    progressBar.style.width = `${Math.min(percentage, 100)}%`;
}

// 完了モーダルの表示
function showCompletionModal(title = "完了", message = "処理が完了しました。") {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    progressBarContainer.classList.add('hidden');
    modalSpinner.classList.add('hidden');
    modalCheck.classList.remove('hidden');
    closeModalBtn.classList.remove('hidden');
    processingModal.classList.remove('hidden');
}

// トースト通知の表示
function showToast(title = "完了", message = "処理が完了しました", duration = 5000) {
    // モーダルを閉じる
    hideProcessingModal();
    
    // トーストの内容を設定
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // トーストを表示
    toast.classList.add('show');
    
    // 指定時間後にトーストを非表示
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// 処理中モーダルを非表示
function hideProcessingModal() {
    processingModal.classList.add('hidden');
}

// モーダルのイベントリスナー設定
function setupModalEventListeners() {
    closeModalBtn.addEventListener('click', () => {
        processingModal.classList.add('hidden');
    });
}

// DOMContentLoadedイベントでリスナー設定
document.addEventListener('DOMContentLoaded', () => {
    setupModalEventListeners();
    
    // Escキーを押した時にモーダルを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !processingModal.classList.contains('hidden')) {
            hideProcessingModal();
        }
    });
}); 