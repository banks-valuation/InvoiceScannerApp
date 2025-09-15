interface OCRResponse {
  documents: Array<{
    data: {
      customer_name?: string;
      invoice_date?: string;
      total?: number;
    };
  }>;
}

export class OCRService {
  private static readonly API_URL = 'https://worker.formextractorai.com/v2/extract';
  private static readonly EXTRACTOR_ID = 'c72158dd-f8d4-41c1-8441-b50961b5a762';
  private static readonly TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZXNvdXJjZV9vd25lcl9pZCI6IjNlZjMzM2E1LTZkZWYtNGY5Ny04Y2MxLWZhN2Y1NTBkYmU2NCIsIndvcmtlcl90b2tlbl9pZCI6IjM5YmNiZDAxLWEwYjItNGNmZC1hZmIxLTg0ZWViMzAyNjc1MSJ9.wgMBS3qQSGxXfkfmxfhz0t-U-am0Vhp164WQezqCDEY';

  static async extractInvoiceData(file: File): Promise<{
    customer_name?: string;
    invoice_date?: string;
    invoice_amount?: string;
  }> {
    try {
      // Convert file to the appropriate format for the API
      const fileBuffer = await file.arrayBuffer();
      
      // Determine content type based on file type
      let contentType = 'image/jpeg';
      if (file.type === 'application/pdf') {
        contentType = 'application/pdf';
      } else if (file.type === 'image/png') {
        contentType = 'image/png';
      } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        contentType = 'image/jpeg';
      }

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'X-WORKER-EXTRACTOR-ID': this.EXTRACTOR_ID,
          'X-WORKER-TOKEN': this.TOKEN,
        },
        body: fileBuffer,
      });

      if (!response.ok) {
        throw new Error(`OCR API request failed: ${response.status} ${response.statusText}`);
      }

      const data: OCRResponse = await response.json();
      
      // Extract the relevant fields from the response
      const extractedData = data.documents?.[0]?.data;
      
      if (!extractedData) {
        throw new Error('No data extracted from the document');
      }
      console.log("extractedData:", JSON.stringify(extractedData, null, 2));
      
      // Format the extracted data to match our form structure
      const result: {
        customer_name?: string;
        invoice_date?: string;
        invoice_amount?: string;
      } = {};

      if (extractedData.customer_name) {
        result.customer_name = this.toProperCase(extractedData.customer_name.trim());
      }

      if (extractedData.invoice_date) {
        // Try to format the date to YYYY-MM-DD format for the date input
        const dateStr = extractedData.invoice_date.trim();
        const formattedDate = this.formatDateForInput(dateStr);
        if (formattedDate) {
          result.invoice_date = formattedDate;
        }
      }

      if (extractedData.total !== undefined && extractedData.total !== null) {
        // Convert to string and ensure it's a valid number
        const amount = parseFloat(extractedData.total.toString());
        if (!isNaN(amount)) {
          result.invoice_amount = amount.toFixed(2);
        }
      }

      return result;
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw new Error(`Failed to extract invoice data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static formatDateForInput(dateStr: string): string | null {
    try {
      // Try to parse various date formats and convert to YYYY-MM-DD
      const date = new Date(dateStr);
      
      if (isNaN(date.getTime())) {
        // Try parsing common formats manually
        const formats = [
          /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // MM/DD/YYYY or DD/MM/YYYY
          /(\d{1,2})-(\d{1,2})-(\d{4})/,   // MM-DD-YYYY or DD-MM-YYYY
          /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
          /(\d{1,2})\.(\d{1,2})\.(\d{4})/  // MM.DD.YYYY or DD.MM.YYYY
        ];

        for (const format of formats) {
          const match = dateStr.match(format);
          if (match) {
            const [, part1, part2, part3] = match;
            
            // For YYYY-MM-DD format
            if (format === formats[2]) {
              console.log("format is YYYY-MN-DD:", ${part1}-${part2.padStart(2, '0')}-${part3.padStart(2, '0')});
              return `${part1}-${part2.padStart(2, '0')}-${part3.padStart(2, '0')}`;
            }
            
            // For other formats, assume MM/DD/YYYY (US format)
            const month = parseInt(part1);
            const day = parseInt(part2);
            const year = parseInt(part3);
            
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              console.log("returning: ", ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')});
              return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            }
          }
        }
        return null;
      }

      // If Date constructor worked, format it
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      console.log("returning final: ", ${year}-${month}-${day});
      return `${year}-${month}-${day}`;
    } catch {
      return null;
    }
  }

  private static toProperCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  }
}