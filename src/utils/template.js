/**
 * Generate a professional HTML template for the quotation.
 * @param {Object} data - Quotation version details
 * @returns {string} - HTML string
 */
export const generateQuotationHTML = (data) => {
  const {
    quotationVersionNo,
    locationName,
    rangeName,
    dwellingTypeName,
    floorPlan: rawFloorPlan,
    facade: rawFacade,
    package: rawPkg,
    structuralEngineer,
    quotationVersionItems = [],
    totalPackageCost = 0,
    totalPricelistCost = 0,
    grandTotalCost = 0,
    leadContacts = [],
    propertyDetail: rawPropertyDetail,
    createdAt,
  } = data;

  const floorPlan = rawFloorPlan || {};
  const facade = rawFacade || {};
  const pkg = rawPkg || {};
  const propertyDetail = rawPropertyDetail || {};
  const contact = leadContacts[0] || {};
  const date = new Date(createdAt).toLocaleDateString();

  const itemsHtml = quotationVersionItems
    .map(
      (item) => `
    <tr>
      <td>${item.priceListItemDescription || (item.packageId ? "Package Item" : "Miscellaneous")}</td>
      <td style="text-align: center;">${item.quantity || 1}</td>
      <td style="text-align: right;">$${parseFloat(item.priceListItemCost || item.packageCost || 0).toLocaleString()}</td>
      <td style="text-align: right;">$${parseFloat(item.totalPrice || item.packageCost || 0).toLocaleString()}</td>
    </tr>
  `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quotation v${quotationVersionNo}</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.5; margin: 0; padding: 40px; }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #0056b3; padding-bottom: 20px; margin-bottom: 40px; }
        .logo { font-size: 28px; font-weight: bold; color: #0056b3; letter-spacing: -1px; }
        .quote-info { text-align: right; }
        .section { margin-bottom: 40px; page-break-inside: avoid; }
        .section-title { font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #0056b3; text-transform: uppercase; border-bottom: 1px solid #dee2e6; padding-bottom: 8px; }
        
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .data-list { list-style: none; padding: 0; margin: 0; }
        .data-list li { margin-bottom: 8px; font-size: 14px; }
        .data-list strong { color: #555; width: 140px; display: inline-block; }

        .image-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f8f9fa; padding: 20px; border-radius: 8px; }
        .image-box { text-align: center; background: #fff; padding: 10px; border: 1px solid #eee; border-radius: 4px; }
        .image-box img { max-width: 100%; height: auto; border-radius: 2px; max-height: 250px; object-fit: contain; }
        .image-label { font-size: 13px; font-weight: bold; margin-top: 10px; color: #666; }

        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
        th { background-color: #f8f9fa; border-bottom: 2px solid #0056b3; padding: 12px 10px; text-align: left; color: #0056b3; }
        td { border-bottom: 1px solid #efefef; padding: 12px 100px; padding: 12px 10px; }
        
        .totals-container { display: flex; justify-content: flex-end; margin-top: 30px; }
        .totals-table { width: 350px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
        .grand-total { font-size: 18px; font-weight: bold; color: #0056b3; border-top: 2px solid #0056b3; margin-top: 10px; padding-top: 10px; }

        .footer { margin-top: 60px; font-size: 11px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
        .page-break { page-break-before: always; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">inBuildify</div>
        <div class="quote-info">
            <h1 style="margin: 0; color: #0056b3; font-size: 32px;">QUOTATION</h1>
            <p style="margin: 5px 0;">Version: <strong>${quotationVersionNo}</strong></p>
            <p style="margin: 5px 0;">Date: <strong>${date}</strong></p>
        </div>
    </div>

    <div class="section">
        <div class="grid">
            <div>
                <div class="section-title">Customer Information</div>
                <ul class="data-list">
                    <li><strong>Customer Name:</strong> ${contact.name || "N/A"}</li>
                    <li><strong>Email Address:</strong> ${contact.email || "N/A"}</li>
                    <li><strong>Phone Number:</strong> ${contact.phone || "N/A"}</li>
                </ul>
            </div>
            <div>
                <div class="section-title">Property Information</div>
                <ul class="data-list">
                    <li><strong>Lot Number:</strong> ${propertyDetail.lotNumber || "N/A"}</li>
                    <li><strong>Street:</strong> ${propertyDetail.street || "N/A"}</li>
                    <li><strong>City / Suburb:</strong> ${propertyDetail.city || "N/A"}</li>
                    <li><strong>Postal Code:</strong> ${propertyDetail.zipCode || "N/A"}</li>
                    <li><strong>Estate Name:</strong> ${propertyDetail.estateName || "N/A"}</li>
                </ul>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Design & Facade Options</div>
        <div class="image-section">
            <div class="image-box">
                ${floorPlan.detailedImage || floorPlan.simpleImage ?
    `<img src="${floorPlan.detailedImage || floorPlan.simpleImage}" alt="Floor Plan">` :
    "<div style=\"height: 150px; display: flex; align-items: center; justify-content: center; color: #ccc;\">No Floor Plan Image Available</div>"
}
                <div class="image-label">FLOOR PLAN: ${floorPlan.name || "N/A"}</div>
                <div style="font-size: 11px; color: #888;">Area: ${floorPlan.totalArea || "N/A"} sqm</div>
            </div>
            <div class="image-box">
                ${facade.image ?
    `<img src="${facade.image}" alt="Facade">` :
    "<div style=\"height: 150px; display: flex; align-items: center; justify-content: center; color: #ccc;\">No Facade Image Available</div>"
}
                <div class="image-label">FACADE: ${facade.name || "N/A"}</div>
                <div style="font-size: 11px; color: #888;">Style: ${dwellingTypeName || "N/A"}</div>
            </div>
        </div>
    </div>

    ${pkg?.name ? `
    <div class="section">
        <div class="section-title">Selected Package</div>
        <div style="background: #f0f7ff; padding: 15px; border-radius: 4px; border-left: 4px solid #0056b3;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 16px; font-weight: bold; color: #0056b3;">${pkg.name}</span>
                <span style="font-size: 16px; font-weight: bold;">$${parseFloat(pkg.cost || 0).toLocaleString()}</span>
            </div>
        </div>
    </div>
    ` : ""}

    ${structuralEngineer ? `
    <div class="section">
        <div class="section-title">Structural Engineer</div>
        <div style="background: #f8f9fa; padding: 12px; border-radius: 4px; display: flex; justify-content: space-between; font-size: 14px;">
            <span><strong>Engineer:</strong> ${structuralEngineer?.name}</span>
            <span><strong>Service Price:</strong> $${parseFloat(structuralEngineer?.price || 0).toLocaleString()}</span>
        </div>
    </div>
    ` : ""}



    <div class="section">
        <div class="section-title">Quotation Inclusions & Items</div>
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th style="text-align: center; width: 60px;">Qty</th>
                    <th style="text-align: right; width: 120px;">Unit Price</th>
                    <th style="text-align: right; width: 120px;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>
    </div>

    <div class="totals-container">
        <div class="totals-table">
            <div class="total-row">
                <span>Value of Inclusions:</span>
                <span>$${parseFloat(totalPricelistCost).toLocaleString()}</span>
            </div>
            ${totalPackageCost > 0 ? `
            <div class="total-row">
                <span>Value of Package:</span>
                <span>$${parseFloat(totalPackageCost).toLocaleString()}</span>
            </div>
            ` : ""}
            ${structuralEngineer ? `
            <div class="total-row">
                <span>Structural Engineer Charges:</span>
                <span>$${parseFloat(structuralEngineer.price || 0).toLocaleString()}</span>
            </div>
            ` : ""}
            <div class="grand-total total-row">
                <span>Grand Total:</span>
                <span>$${parseFloat(grandTotalCost).toLocaleString()}</span>
            </div>
        </div>
    </div>

    <div class="footer">
        <p>This quotation is valid for 30 days from the date of issue. All prices are in AUD and inclusive of GST where applicable.</p>
        <p><strong>inBuildify</strong> | Your Partner in Efficient Property Management</p>
    </div>
</body>
</html>
  `;
};
