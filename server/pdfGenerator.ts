import PDFDocument from "pdfkit";
import type { Response } from "express";
import type { Property, Lead } from "@shared/schema";
import fs from "fs";
import path from "path";

function formatPriceINR(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const num = Number(raw);
  if (Number.isNaN(num)) return raw; // fallback to raw string
  // Use "Rs." instead of "₹" because the default PDFKit font
  // does not support the rupee symbol (which caused the weird ¹).
  return `Rs. ${num.toLocaleString("en-IN")}`;
}

/**
 * Resolve a property.image path to a local filesystem path
 * for PDFKit to embed.
 */
function resolveLocalImagePath(imagePath: string): string | null {
  if (!imagePath) return null;

  // Example stored values:
  //  - "local-uploads/<id>"
  //  - "/api/documents/upload-proxy/<id>"
  // Normalise both to ./local_uploads/<id>
  if (imagePath.startsWith("local-uploads/")) {
    const id = imagePath.split("/").slice(1).join("/");
    return path.join(process.cwd(), "local_uploads", id);
  }

  if (imagePath.includes("/upload-proxy/")) {
    const id = imagePath.substring(imagePath.lastIndexOf("/") + 1);
    return path.join(process.cwd(), "local_uploads", id);
  }

  // If someone manually stored a full absolute path and it exists,
  // just return it.
  if (path.isAbsolute(imagePath) && fs.existsSync(imagePath)) {
    return imagePath;
  }

  return null;
}

function drawImageIfExists(
  doc: PDFKit.PDFDocument,
  imageSource: string,
  x: number,
  y: number,
  options: PDFKit.Mixins.ImageOption
) {
  try {
    if (!imageSource) return;

    // 1) Handle base64 data URLs: data:image/jpeg;base64,....
    if (imageSource.startsWith("data:image")) {
      const commaIndex = imageSource.indexOf(",");
      if (commaIndex === -1) {
        console.warn(
          "Invalid data URL for brochure image:",
          imageSource.slice(0, 50)
        );
        return;
      }

      const base64 = imageSource.substring(commaIndex + 1);
      const buffer = Buffer.from(base64, "base64");

      doc.image(buffer, x, y, options);
      return;
    }

    // 2) Old behaviour: treat it as a local file path (local-uploads, upload-proxy, etc.)
    const resolved = resolveLocalImagePath(imageSource);
    if (!resolved || !fs.existsSync(resolved)) {
      console.warn(
        "Brochure image not found on disk:",
        imageSource,
        "->",
        resolved
      );
      return;
    }

    doc.image(resolved, x, y, options);
  } catch (err) {
    console.error("Error embedding brochure image:", err);
  }
}

export class PDFGenerator {
  // ---------------------------------------------------------------------------
  // Property brochure
  // ---------------------------------------------------------------------------
  static async generatePropertyBrochure(property: Property, res: Response) {
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    // HTTP headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=property-${property.id}.pdf`
    );

    doc.pipe(res);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const contentX = doc.page.margins.left;

    // ---------------------- PAGE 1: IMAGES ONLY ----------------------
    // Header
    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor("#1e40af")
      .text("Sangli Properties LLP", {
        align: "center",
      })
      .moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#111827")
      .text(property.title || "Property Details", {
        align: "center",
      })
      .moveDown(0.3);

    doc
      .moveTo(contentX, doc.y + 5)
      .lineTo(contentX + pageWidth, doc.y + 5)
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .stroke();

    doc.moveDown(1);

    const imagesArray = Array.isArray(property.images)
      ? property.images.filter(Boolean)
      : [];

    // If there are no images at all, we still keep a clean cover page.
    if (imagesArray.length > 0) {
      const heroHeight = 220;
      const heroWidth = pageWidth;
      const radius = 12;

      let y = doc.y;

      // Hero container
      doc
        .roundedRect(contentX, y, heroWidth, heroHeight, radius)
        .lineWidth(1)
        .strokeColor("#e5e7eb")
        .stroke();

      const inset = 8;
      drawImageIfExists(doc, imagesArray[0], contentX + inset, y + inset, {
        fit: [heroWidth - inset * 2, heroHeight - inset * 2],
        align: "center",
        valign: "center",
      });

      y += heroHeight + 20;

      // Thumbnails row: remaining images (show all remaining)
      const remaining = imagesArray.slice(1);
      if (remaining.length > 0) {
        const gap = 16;
        const thumbHeight = 130;
        const cols =
          remaining.length === 1 ? 1 : Math.min(2, remaining.length);
        const thumbWidth =
          cols === 1 ? heroWidth : (heroWidth - gap) / 2;

        // 🔴 CHANGED: removed .slice(0, 4) so we render ALL remaining images
        remaining.forEach((img, index) => {
          const col = index % 2;
          const row = Math.floor(index / 2);

          const boxX =
            cols === 1
              ? contentX
              : contentX + col * (thumbWidth + gap);
          const boxY = y + row * (thumbHeight + 12);

          doc
            .roundedRect(boxX, boxY, thumbWidth, thumbHeight, 10)
            .lineWidth(1)
            .strokeColor("#e5e7eb")
            .stroke();

          drawImageIfExists(doc, img, boxX + 6, boxY + 6, {
            fit: [thumbWidth - 12, thumbHeight - 12],
            align: "center",
            valign: "center",
          });
        });
      }
    }

    // ---------------------- PAGE 2: PROPERTY INFO + FOOTER ----------------------
    doc.addPage();

    // Title on second page
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#111827")
      .text("Property Information", {
        align: "center",
      })
      .moveDown(1);

    const labelValueWidth = pageWidth;

    const writeRow = (label: string, value?: string | null) => {
      if (!value) return;
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor("#111827")
        .text(`${label}:`, contentX, doc.y, {
          continued: true,
          width: labelValueWidth,
        });
      doc
        .font("Helvetica")
        .fontSize(14)
        .fillColor("#111827")
        .text(` ${value}`, {
          width: labelValueWidth,
        });
      doc.moveDown(0.5);
    };

    writeRow("Type", property.type || "N/A");
    writeRow("Location", property.location || "N/A");
    writeRow("Price", formatPriceINR(property.price) || "N/A");
    writeRow("Area", property.area ? `${property.area} sqft` : "N/A");
    writeRow("Transaction", property.transactionType || "N/A");
    writeRow("Status", property.status || "N/A");

    // ---------------------- FOOTER (BOTTOM OF PAGE 2) ----------------------
    const footerY = doc.page.height - doc.page.margins.bottom - 40;

    // Make sure we don't accidentally overwrite the info text:
    if (doc.y > footerY - 40) {
      doc.addPage();
    }

    doc
      .moveTo(contentX, footerY - 10)
      .lineTo(contentX + pageWidth, footerY - 10)
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .stroke();

    const footerWidth = pageWidth;

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#9ca3af")
      .text("Generated by Sangli Properties CRM", contentX, footerY, {
        width: footerWidth,
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#9ca3af")
      .text(
        `Date: ${new Date().toLocaleDateString("en-IN")}`,
        contentX,
        footerY + 14,
        {
          width: footerWidth,
          align: "center",
        }
      );

    // Finalise
    doc.end();
  }

  // ---------------------------------------------------------------------------
  // Leads report
  // ---------------------------------------------------------------------------
  static async generateLeadsReport(leads: Lead[], res: Response) {
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=leads-report-${Date.now()}.pdf`
    );

    doc.pipe(res);

    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor("#1e40af")
      .text("Sangli Properties LLP", { align: "center" })
      .moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#000000")
      .text("Leads Report", { align: "center" })
      .moveDown(1);

    doc.font("Helvetica").fontSize(12).fillColor("#6b7280");
    doc.text(`Total Leads: ${leads.length}`);
    doc.text(`Report Generated: ${new Date().toLocaleDateString("en-IN")}`);
    doc.moveDown(1);

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#6b7280")
      .text("Lead Details", { underline: true });
    doc.moveDown(0.5);

    leads.forEach((lead, index) => {
      if (index > 0) {
        doc.moveDown(0.5);
        doc
          .strokeColor("#e5e7eb")
          .moveTo(50, doc.y)
          .lineTo(550, doc.y)
          .stroke();
        doc.moveDown(0.5);
      }

      doc.font("Helvetica").fontSize(12).fillColor("#000000");
      doc.text(`Name: ${lead.name}`);
      doc.text(`Phone: ${lead.phone}`);
      if (lead.email) doc.text(`Email: ${lead.email}`);
      doc.text(`Source: ${lead.source}`);
      doc.text(`Stage: ${lead.stage}`);
      if (lead.budget) {
        const formattedBudget = formatPriceINR(lead.budget) || lead.budget;
        doc.text(`Budget: ${formattedBudget}`);
      }
      if (lead.preferredLocation) {
        doc.text(`Preferred Location: ${lead.preferredLocation}`);
      }

      if (doc.y > 700) {
        doc.addPage();
      }
    });

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#9ca3af")
      .text("Generated by Sangli Properties CRM", { align: "center" });

    doc.end();
  }

  // ---------------------------------------------------------------------------
  // Sales summary report
  // ---------------------------------------------------------------------------
  static async generateSalesSummary(data: any, res: Response) {
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-summary-${Date.now()}.pdf`
    );

    doc.pipe(res);

    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor("#1e40af")
      .text("Sangli Properties LLP", { align: "center" })
      .moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#000000")
      .text("Sales Summary Report", { align: "center" })
      .moveDown(1);

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#6b7280")
      .text("Summary", { underline: true });
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(12).fillColor("#000000");
    doc.text(`Total Leads: ${data.totalLeads || 0}`);
    doc.text(`Active Leads: ${data.activeLeads || 0}`);
    doc.text(`Closed Deals: ${data.closedDeals || 0}`);
    doc.text(`Total Properties: ${data.totalProperties || 0}`);
    doc.text(`Available Properties: ${data.availableProperties || 0}`);
    doc.moveDown(1);

    if (data.monthlySales && data.monthlySales.length > 0) {
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor("#6b7280")
        .text("Monthly Sales", { underline: true });
      doc.moveDown(0.5);

      data.monthlySales.forEach((item: any) => {
        doc
          .font("Helvetica")
          .fontSize(12)
          .fillColor("#000000")
          .text(`${item.month}: ${item.count} deals`);
      });
      doc.moveDown(1);
    }

    if (data.topAgents && data.topAgents.length > 0) {
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor("#6b7280")
        .text("Top Performing Agents", { underline: true });
      doc.moveDown(0.5);

      data.topAgents.forEach((agent: any, index: number) => {
        doc
          .font("Helvetica")
          .fontSize(12)
          .fillColor("#000000")
          .text(`${index + 1}. ${agent.name}: ${agent.closedDeals} closed deals`);
      });
      doc.moveDown(1);
    }

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#9ca3af")
      .text(
        `Report Generated: ${new Date().toLocaleDateString("en-IN")}`,
        { align: "center" }
      )
      .moveDown(0.5);

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#9ca3af")
      .text("Generated by Sangli Properties CRM", { align: "center" });

    doc.end();
  }
}
