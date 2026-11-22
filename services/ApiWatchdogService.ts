
export const ApiWatchdogService = {
  // Lưu trạng thái cần test lại sau khi reload
  setPendingTest: () => {
    sessionStorage.setItem('API_TEST_PENDING', 'true');
    const count = parseInt(sessionStorage.getItem('API_TEST_RETRY') || '0');
    sessionStorage.setItem('API_TEST_RETRY', (count + 1).toString());
  },
  
  // Kiểm tra xem có cần chạy lại test không
  shouldRecover: () => {
    const isPending = sessionStorage.getItem('API_TEST_PENDING') === 'true';
    const retryCount = parseInt(sessionStorage.getItem('API_TEST_RETRY') || '0');
    return isPending && retryCount <= 1; // Chỉ tự động reload 1 lần
  },

  // Xóa trạng thái sau khi đã phục hồi
  clearFlags: () => {
    sessionStorage.removeItem('API_TEST_PENDING');
    // Chỉ xóa retry count nếu không còn trong trạng thái cần recover
    if (!ApiWatchdogService.shouldRecover()) {
        sessionStorage.removeItem('API_TEST_RETRY');
    }
  }
};
