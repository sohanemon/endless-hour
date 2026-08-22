// INFO: Central registry of chrome.storage.local keys. Every feature store
// and the CLEAR_ALL_STORAGE wipe must reference keys from here so a rename on
// one side can never silently orphan or clobber the other.
export const URL_LIST_KEY = 'urlList';
