export interface AppSettings {
  onedrive: {
    invoiceDirectory: string;
    excelFileName: string;
    excelFilePath?: string;
  };
  general: {
    defaultCategory: string;
    autoExtractOCR: boolean;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  onedrive: {
    invoiceDirectory: 'Invoices',
    excelFileName: 'Invoice_Tracker.xlsx',
    excelFilePath: '',
  },
  general: {
    defaultCategory: 'Massage Therapy',
    autoExtractOCR: true,
  },
};