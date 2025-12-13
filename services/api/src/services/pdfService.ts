import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { logger } from '../utils/logger';

interface PaymentReceiptData {
  receiptId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  description: string;
  items?: Array<{ name: string; quantity: number; price: number; total: number }>;
  organizerName?: string;
  organizerEmail?: string;
  tripDetails?: {
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
  };
}

interface SubscriptionReceiptData {
  receiptId: string;
  userName: string;
  userEmail: string;
  paymentDate: Date;
  amount: number;
  transactionId: string;
  planName: string;
  planTrips: number;
  validFrom: Date;
  validUntil: Date;
}

/**
 * PDF Service for generating payment receipts
 */
class PDFService {
  private readonly BRAND_COLOR = '#10b981';
  private readonly SECONDARY_COLOR = '#059669';
  private readonly GRAY_COLOR = '#6b7280';
  private readonly DARK_COLOR = '#111827';

  /**
   * Generate a payment receipt PDF
   */
  async generatePaymentReceipt(data: PaymentReceiptData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          size: 'A4', 
          margin: 50,
          info: {
            Title: `Receipt ${data.receiptId}`,
            Author: 'Trek-Tribe',
            Subject: 'Payment Receipt',
          }
        });

        const chunks: Buffer[] = [];
        
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header with logo and branding
        this.addHeader(doc);

        // Receipt title
        doc.fontSize(24)
           .fillColor(this.DARK_COLOR)
           .text('PAYMENT RECEIPT', 50, 150, { align: 'center' });

        doc.fontSize(12)
           .fillColor(this.GRAY_COLOR)
           .text(`Receipt #${data.receiptId}`, 50, 180, { align: 'center' });

        // Horizontal line
        doc.moveTo(50, 210)
           .lineTo(545, 210)
           .strokeColor(this.BRAND_COLOR)
           .lineWidth(2)
           .stroke();

        // Receipt Details Section
        let yPosition = 240;

        // Customer Information
        doc.fontSize(14)
           .fillColor(this.DARK_COLOR)
           .text('Customer Information', 50, yPosition);
        yPosition += 25;

        doc.fontSize(10)
           .fillColor(this.GRAY_COLOR);
        
        doc.text(`Name: ${data.userName}`, 50, yPosition);
        yPosition += 15;
        doc.text(`Email: ${data.userEmail}`, 50, yPosition);
        if (data.userPhone) {
          yPosition += 15;
          doc.text(`Phone: ${data.userPhone}`, 50, yPosition);
        }

        yPosition += 30;

        // Payment Information
        doc.fontSize(14)
           .fillColor(this.DARK_COLOR)
           .text('Payment Information', 50, yPosition);
        yPosition += 25;

        doc.fontSize(10)
           .fillColor(this.GRAY_COLOR);

        const formattedDate = data.paymentDate.toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        doc.text(`Date: ${formattedDate}`, 50, yPosition);
        yPosition += 15;
        doc.text(`Payment Method: ${data.paymentMethod}`, 50, yPosition);
        yPosition += 15;
        doc.text(`Transaction ID: ${data.transactionId}`, 50, yPosition);
        yPosition += 15;
        doc.text(`Description: ${data.description}`, 50, yPosition);

        yPosition += 30;

        // Trip Details if available
        if (data.tripDetails) {
          doc.fontSize(14)
             .fillColor(this.DARK_COLOR)
             .text('Trip Details', 50, yPosition);
          yPosition += 25;

          doc.fontSize(10)
             .fillColor(this.GRAY_COLOR);
          
          doc.text(`Trip: ${data.tripDetails.title}`, 50, yPosition);
          yPosition += 15;
          doc.text(`Destination: ${data.tripDetails.destination}`, 50, yPosition);
          yPosition += 15;
          doc.text(`Dates: ${data.tripDetails.startDate} to ${data.tripDetails.endDate}`, 50, yPosition);
          
          yPosition += 30;
        }

        // Organizer Details if available
        if (data.organizerName) {
          doc.fontSize(14)
             .fillColor(this.DARK_COLOR)
             .text('Organizer Information', 50, yPosition);
          yPosition += 25;

          doc.fontSize(10)
             .fillColor(this.GRAY_COLOR);
          
          doc.text(`Organizer: ${data.organizerName}`, 50, yPosition);
          yPosition += 15;
          if (data.organizerEmail) {
            doc.text(`Email: ${data.organizerEmail}`, 50, yPosition);
            yPosition += 15;
          }
          
          yPosition += 20;
        }

        // Items breakdown if provided
        if (data.items && data.items.length > 0) {
          doc.fontSize(14)
             .fillColor(this.DARK_COLOR)
             .text('Items', 50, yPosition);
          yPosition += 25;

          // Table header
          doc.fontSize(10)
             .fillColor(this.DARK_COLOR);
          doc.text('Item', 50, yPosition);
          doc.text('Qty', 320, yPosition);
          doc.text('Price', 380, yPosition);
          doc.text('Total', 480, yPosition);
          yPosition += 20;

          // Horizontal line
          doc.moveTo(50, yPosition)
             .lineTo(545, yPosition)
             .strokeColor(this.GRAY_COLOR)
             .lineWidth(1)
             .stroke();
          yPosition += 10;

          // Items
          doc.fontSize(10)
             .fillColor(this.GRAY_COLOR);
          
          data.items.forEach(item => {
            doc.text(item.name, 50, yPosition, { width: 250 });
            doc.text(item.quantity.toString(), 320, yPosition);
            doc.text(`₹${item.price.toLocaleString('en-IN')}`, 380, yPosition);
            doc.text(`₹${item.total.toLocaleString('en-IN')}`, 480, yPosition);
            yPosition += 20;
          });

          yPosition += 10;
        }

        // Total Amount Box
        const boxY = yPosition;
        doc.rect(350, boxY, 195, 60)
           .fillAndStroke(this.BRAND_COLOR, this.BRAND_COLOR);

        doc.fontSize(12)
           .fillColor('#ffffff')
           .text('TOTAL AMOUNT PAID', 360, boxY + 15);

        doc.fontSize(20)
           .fillColor('#ffffff')
           .text(`₹${data.amount.toLocaleString('en-IN')}`, 360, boxY + 35);

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error: any) {
        logger.error('Error generating payment receipt PDF', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Generate a subscription receipt PDF
   */
  async generateSubscriptionReceipt(data: SubscriptionReceiptData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          size: 'A4', 
          margin: 50,
          info: {
            Title: `Subscription Receipt ${data.receiptId}`,
            Author: 'Trek-Tribe',
            Subject: 'Subscription Payment Receipt',
          }
        });

        const chunks: Buffer[] = [];
        
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc);

        // Receipt title
        doc.fontSize(24)
           .fillColor(this.DARK_COLOR)
           .text('SUBSCRIPTION RECEIPT', 50, 150, { align: 'center' });

        doc.fontSize(12)
           .fillColor(this.GRAY_COLOR)
           .text(`Receipt #${data.receiptId}`, 50, 180, { align: 'center' });

        // Horizontal line
        doc.moveTo(50, 210)
           .lineTo(545, 210)
           .strokeColor(this.BRAND_COLOR)
           .lineWidth(2)
           .stroke();

        let yPosition = 240;

        // Customer Information
        doc.fontSize(14)
           .fillColor(this.DARK_COLOR)
           .text('Customer Information', 50, yPosition);
        yPosition += 25;

        doc.fontSize(10)
           .fillColor(this.GRAY_COLOR);
        
        doc.text(`Name: ${data.userName}`, 50, yPosition);
        yPosition += 15;
        doc.text(`Email: ${data.userEmail}`, 50, yPosition);
        yPosition += 30;

        // Subscription Details
        doc.fontSize(14)
           .fillColor(this.DARK_COLOR)
           .text('Subscription Details', 50, yPosition);
        yPosition += 25;

        doc.fontSize(10)
           .fillColor(this.GRAY_COLOR);

        doc.text(`Plan: ${data.planName}`, 50, yPosition);
        yPosition += 15;
        doc.text(`Trip Allowance: ${data.planTrips} trips`, 50, yPosition);
        yPosition += 15;
        doc.text(`Valid From: ${data.validFrom.toLocaleDateString('en-IN')}`, 50, yPosition);
        yPosition += 15;
        doc.text(`Valid Until: ${data.validUntil.toLocaleDateString('en-IN')}`, 50, yPosition);
        yPosition += 30;

        // Payment Information
        doc.fontSize(14)
           .fillColor(this.DARK_COLOR)
           .text('Payment Information', 50, yPosition);
        yPosition += 25;

        doc.fontSize(10)
           .fillColor(this.GRAY_COLOR);

        const formattedDate = data.paymentDate.toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        doc.text(`Date: ${formattedDate}`, 50, yPosition);
        yPosition += 15;
        doc.text(`Transaction ID: ${data.transactionId}`, 50, yPosition);
        yPosition += 40;

        // Total Amount Box
        const boxY = yPosition;
        doc.rect(350, boxY, 195, 60)
           .fillAndStroke(this.BRAND_COLOR, this.BRAND_COLOR);

        doc.fontSize(12)
           .fillColor('#ffffff')
           .text('AMOUNT PAID', 360, boxY + 15);

        doc.fontSize(20)
           .fillColor('#ffffff')
           .text(`₹${data.amount.toLocaleString('en-IN')}`, 360, boxY + 35);

        // Footer
        this.addFooter(doc);

        doc.end();
      } catch (error: any) {
        logger.error('Error generating subscription receipt PDF', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Add header to PDF
   */
  private addHeader(doc: InstanceType<typeof PDFDocument>) {
    // Logo/Brand
    doc.fontSize(28)
       .fillColor(this.BRAND_COLOR)
       .text('🏔️ Trek-Tribe', 50, 50);

    doc.fontSize(10)
       .fillColor(this.GRAY_COLOR)
       .text('Connect, Explore, Adventure Together', 50, 85);

    // Company details (right aligned)
    doc.fontSize(9)
       .fillColor(this.GRAY_COLOR)
       .text('Trek-Tribe Platform', 400, 50, { align: 'right' })
       .text('support@trek-tribe.com', 400, 65, { align: 'right' })
       .text('www.trek-tribe.com', 400, 80, { align: 'right' });
  }

  /**
   * Add footer to PDF
   */
  private addFooter(doc: InstanceType<typeof PDFDocument>) {
    const pageHeight = doc.page.height;
    
    // Horizontal line
    doc.moveTo(50, pageHeight - 100)
       .lineTo(545, pageHeight - 100)
       .strokeColor(this.GRAY_COLOR)
       .lineWidth(0.5)
       .stroke();

    // Footer text
    doc.fontSize(9)
       .fillColor(this.GRAY_COLOR)
       .text(
         'Thank you for choosing Trek-Tribe! For questions about this receipt, contact support@trek-tribe.com',
         50,
         pageHeight - 80,
         { align: 'center', width: 495 }
       );

    doc.fontSize(8)
       .fillColor(this.GRAY_COLOR)
       .text(
         `© ${new Date().getFullYear()} Trek-Tribe. All rights reserved.`,
         50,
         pageHeight - 50,
         { align: 'center', width: 495 }
       );

    // Page number
    doc.fontSize(8)
       .fillColor(this.GRAY_COLOR)
       .text(
         `Generated on ${new Date().toLocaleDateString('en-IN')}`,
         50,
         pageHeight - 30,
         { align: 'center', width: 495 }
       );
  }
}

export const pdfService = new PDFService();
