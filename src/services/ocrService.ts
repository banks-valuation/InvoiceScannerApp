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
  private static readonly API_URL =
    "https://worker.formextractorai.com/v2/extract";
  private static readonly EXTRACTOR_ID = "fe1be97d-22fb-4d6d-afa3-a79169f7fd9a";
  private static readonly TOKEN =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZXNvdXJjZV9vd25lcl9pZCI6IjBmMzI5MmY3LTYwZDgtNDc4NS05MTBjLWZkNzU5NjljMGNmNCIsIndvcmtlcl90b2tlbl9pZCI6ImNhOTk3ODg3LWRkZWQtNDViNi05NDJhLTQ2ZTRhNjYwMTBmZCJ9.ao198QWBLms0JD8CrI-egI5YtFkZnyBixB_DLb1Vz9o";

  static async extractInvoiceData(file: File): Promise<{
    customer_name?: string;
    invoice_date?: string;
    invoice_amount?: string;
  }> {
    try {
      // Convert file to the appropriate format for the API
      const fileBuffer = await file.arrayBuffer();

      // Determine content type based on file type
      let contentType = "image/jpeg";
      if (file.type === "application/pdf") {
        contentType = "application/pdf";
      } else if (file.type === "image/png") {
        contentType = "image/png";
      } else if (file.type === "image/jpeg" || file.type === "image/jpg") {
        contentType = "image/jpeg";
      }

      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          "X-WORKER-EXTRACTOR-ID": this.EXTRACTOR_ID,
          "X-WORKER-TOKEN": this.TOKEN,
        },
        body: fileBuffer,
      });

      if (!response.ok) {
        throw new Error(
          `OCR API request failed: ${response.status} ${response.statusText}`,
        );
      }

      const data: OCRResponse = await response.json();

      // Extract the relevant fields from the response
      const extractedData = data.documents?.[0]?.data;

      if (!extractedData) {
        throw new Error("No data extracted from the document");
      }
      console.log("extractedData:", JSON.stringify(extractedData, null, 2));

      // Format the extracted data to match our form structure
      const result: {
        customer_name?: string;
        invoice_date?: string;
        invoice_amount?: string;
      } = {};

      if (extractedData.customer_name) {
        result.customer_name = this.toProperCase(
          extractedData.customer_name.trim(),
        );
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
      console.error("OCR extraction failed:", error);
      throw new Error(
        `Failed to extract invoice data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private static formatDateForInput(dateStr: string): string | null {
    try {
      // Try to parse with the Date constructor first
      const date = new Date(dateStr);

      if (!isNaN(date.getTime())) {
        // Use UTC getters to avoid timezone shift
        const year = date.getUTCFullYear();
        const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
        const day = date.getUTCDate().toString().padStart(2, "0");
        console.log(`returning final (UTC): ${year}-${month}-${day}`);
        return `${year}-${month}-${day}`;
      }

      // Fallback: parse manually with regex
      const formats = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY or DD/MM/YYYY
        /(\d{1,2})-(\d{1,2})-(\d{4})/, // MM-DD-YYYY or DD-MM-YYYY
        /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
        /(\d{1,2})\.(\d{1,2})\.(\d{4})/, // MM.DD.YYYY or DD.MM.YYYY
      ];

      for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
          const [, part1, part2, part3] = match;

          // YYYY-MM-DD case
          if (format === formats[2]) {
            return `${part1}-${part2.padStart(2, "0")}-${part3.padStart(2, "0")}`;
          }

          // Other cases: assume MM/DD/YYYY
          const month = parseInt(part1);
          const day = parseInt(part2);
          const year = parseInt(part3);

          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private static toProperCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
